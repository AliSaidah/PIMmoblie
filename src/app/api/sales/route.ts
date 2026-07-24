import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import type { PaymentMethod } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro", "marcado"];

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();

    const paymentMethod = body?.payment_method as PaymentMethod;
    if (!VALID_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 });
    }

    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const requested: { productId: number; quantity: number }[] = [];
    for (const it of rawItems) {
      const productId = Number(it?.product_id);
      const quantity = Number(it?.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "Itens da venda inválidos." }, { status: 400 });
      }
      requested.push({ productId, quantity });
    }
    if (requested.length === 0) {
      return NextResponse.json({ error: "Adicione pelo menos um item." }, { status: 400 });
    }

    let personId: number | null = null;
    if (paymentMethod === "marcado") {
      personId = Number(body?.person_id);
      if (!Number.isInteger(personId)) {
        return NextResponse.json(
          { error: "Selecione a pessoa para a venda marcada." },
          { status: 400 }
        );
      }
    }

    // Preços são sempre lidos do banco (nunca confiamos no valor do cliente).
    const ids = requested.map((r) => r.productId);
    const products = await sql<
      { id: number; name: string; price_cents: number }[]
    >`SELECT id, name, price_cents FROM products WHERE id IN ${sql(ids)}`;
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines: {
      product_id: number;
      product_name: string;
      unit_price_cents: number;
      quantity: number;
    }[] = [];
    let totalCents = 0;
    for (const r of requested) {
      const p = byId.get(r.productId);
      if (!p) {
        return NextResponse.json(
          { error: "Um dos produtos não existe mais. Recarregue a tela." },
          { status: 400 }
        );
      }
      totalCents += p.price_cents * r.quantity;
      lines.push({
        product_id: p.id,
        product_name: p.name,
        unit_price_cents: p.price_cents,
        quantity: r.quantity,
      });
    }

    if (personId !== null) {
      const [person] = await sql`SELECT id FROM people WHERE id = ${personId}`;
      if (!person) {
        return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 400 });
      }
    }

    const paid = paymentMethod !== "marcado";

    // Transação: venda + itens gravam juntos ou nada é gravado.
    const sale = await sql.begin(async (tx) => {
      const [created] = await tx`
        INSERT INTO sales (total_cents, payment_method, person_id, paid, paid_at)
        VALUES (
          ${totalCents}, ${paymentMethod}, ${personId}, ${paid},
          ${paid ? tx`now()` : null}
        )
        RETURNING id, created_at
      `;
      for (const line of lines) {
        await tx`
          INSERT INTO sale_items
            (sale_id, product_id, product_name, unit_price_cents, quantity)
          VALUES
            (${created.id}, ${line.product_id}, ${line.product_name},
             ${line.unit_price_cents}, ${line.quantity})
        `;
      }
      return created;
    });

    return NextResponse.json(
      { sale: { id: sale.id, total_cents: totalCents, created_at: sale.created_at } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/sales", err);
    return NextResponse.json(
      { error: "A venda NÃO foi salva. Tente novamente." },
      { status: 500 }
    );
  }
}
