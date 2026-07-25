import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isInteger(productId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const priceCents = Number(body?.price_cents);
    if (!name) {
      return NextResponse.json({ error: "Informe o nome do produto." }, { status: 400 });
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }
    const [product] = await sql`
      UPDATE products
      SET name = ${name}, price_cents = ${priceCents}
      WHERE id = ${productId} AND active = TRUE
      RETURNING id, name, price_cents, active
    `;
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (err) {
    console.error("PATCH /api/products/[id]", err);
    return NextResponse.json(
      { error: "Não foi possível atualizar o produto." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const productId = Number(id);
    if (!Number.isInteger(productId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    // Soft delete: preserva o histórico de vendas que referenciam o produto.
    const [product] = await sql`
      UPDATE products SET active = FALSE
      WHERE id = ${productId}
      RETURNING id
    `;
    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/products/[id]", err);
    return NextResponse.json(
      { error: "Não foi possível remover o produto." },
      { status: 500 }
    );
  }
}
