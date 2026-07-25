import { NextResponse } from "next/server";
import { sql, ensureSchema, EVENT_TZ } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    let day = (searchParams.get("day") || "").trim();

    // Dia atual no fuso do evento, usado como padrão.
    const [{ today }] = await sql<{ today: string }[]>`
      SELECT (now() AT TIME ZONE ${EVENT_TZ})::date::text AS today
    `;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      day = today;
    }

    // Dias que têm vendas (para o seletor de dia do relatório).
    const daysRows = await sql<{ day: string }[]>`
      SELECT DISTINCT (created_at AT TIME ZONE ${EVENT_TZ})::date::text AS day
      FROM sales
      ORDER BY day DESC
    `;
    const availableDays = daysRows.map((r) => r.day);

    const [totals] = await sql<{ total_cents: number; sales_count: number }[]>`
      SELECT COALESCE(SUM(total_cents), 0)::int AS total_cents,
             COUNT(*)::int AS sales_count
      FROM sales
      WHERE (created_at AT TIME ZONE ${EVENT_TZ})::date = ${day}::date
    `;

    const byPayment = await sql<
      { payment_method: string; total_cents: number; count: number }[]
    >`
      SELECT payment_method,
             COALESCE(SUM(total_cents), 0)::int AS total_cents,
             COUNT(*)::int AS count
      FROM sales
      WHERE (created_at AT TIME ZONE ${EVENT_TZ})::date = ${day}::date
      GROUP BY payment_method
    `;

    const byProduct = await sql<
      { product_name: string; quantity: number; total_cents: number }[]
    >`
      SELECT si.product_name,
             SUM(si.quantity)::int AS quantity,
             SUM(si.quantity * si.unit_price_cents)::int AS total_cents
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE (s.created_at AT TIME ZONE ${EVENT_TZ})::date = ${day}::date
      GROUP BY si.product_name
      ORDER BY quantity DESC
    `;

    const salesRows = await sql<
      {
        id: number;
        total_cents: number;
        payment_method: string;
        paid: boolean;
        created_at: string;
        person_name: string | null;
      }[]
    >`
      SELECT s.id, s.total_cents, s.payment_method, s.paid, s.created_at,
             p.name AS person_name
      FROM sales s
      LEFT JOIN people p ON p.id = s.person_id
      WHERE (s.created_at AT TIME ZONE ${EVENT_TZ})::date = ${day}::date
      ORDER BY s.created_at DESC
    `;

    let items: { sale_id: number; product_name: string; quantity: number }[] = [];
    if (salesRows.length > 0) {
      const saleIds = salesRows.map((s) => s.id);
      items = await sql`
        SELECT sale_id, product_name, quantity
        FROM sale_items
        WHERE sale_id IN ${sql(saleIds)}
        ORDER BY id ASC
      `;
    }
    const itemsBySale = new Map<number, { product_name: string; quantity: number }[]>();
    for (const it of items) {
      const arr = itemsBySale.get(it.sale_id) || [];
      arr.push({ product_name: it.product_name, quantity: it.quantity });
      itemsBySale.set(it.sale_id, arr);
    }

    const sales = salesRows.map((s) => ({
      ...s,
      items: itemsBySale.get(s.id) || [],
    }));

    return NextResponse.json({
      day,
      today,
      availableDays,
      totalCents: totals.total_cents,
      salesCount: totals.sales_count,
      byPayment,
      byProduct,
      sales,
    });
  } catch (err) {
    console.error("GET /api/report", err);
    return NextResponse.json(
      { error: "Não foi possível carregar o relatório." },
      { status: 500 }
    );
  }
}
