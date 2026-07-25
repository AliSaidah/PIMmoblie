import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();

    // Total em aberto por pessoa (vendas marcadas ainda não pagas).
    const rows = await sql<
      { id: number; name: string; open_cents: number; open_sales: number }[]
    >`
      SELECT p.id, p.name,
             COALESCE(SUM(s.total_cents), 0)::int AS open_cents,
             COUNT(s.id)::int AS open_sales
      FROM people p
      LEFT JOIN sales s
        ON s.person_id = p.id
       AND s.payment_method = 'marcado'
       AND s.paid = FALSE
       AND s.canceled = FALSE
      GROUP BY p.id, p.name
      ORDER BY p.name ASC
    `;

    const openPeople = rows.filter((r) => r.open_sales > 0);
    const clearPeople = rows
      .filter((r) => r.open_sales === 0)
      .map((r) => ({ id: r.id, name: r.name }));

    // Itens em aberto agrupados por pessoa.
    let itemsByPerson = new Map<
      number,
      { product_name: string; quantity: number }[]
    >();
    if (openPeople.length > 0) {
      const ids = openPeople.map((p) => p.id);
      const items = await sql<
        { person_id: number; product_name: string; quantity: number }[]
      >`
        SELECT s.person_id,
               si.product_name,
               SUM(si.quantity)::int AS quantity
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        WHERE s.payment_method = 'marcado'
          AND s.paid = FALSE
          AND s.canceled = FALSE
          AND s.person_id IN ${sql(ids)}
        GROUP BY s.person_id, si.product_name
        ORDER BY si.product_name ASC
      `;
      for (const it of items) {
        const arr = itemsByPerson.get(it.person_id) || [];
        arr.push({ product_name: it.product_name, quantity: it.quantity });
        itemsByPerson.set(it.person_id, arr);
      }
    }

    const open = openPeople.map((p) => ({
      id: p.id,
      name: p.name,
      open_cents: p.open_cents,
      items: itemsByPerson.get(p.id) || [],
    }));

    return NextResponse.json({ open, clear: clearPeople });
  } catch (err) {
    console.error("GET /api/marcacoes", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as marcações." },
      { status: 500 }
    );
  }
}
