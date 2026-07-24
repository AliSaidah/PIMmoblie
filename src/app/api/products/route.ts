import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const products = await sql`
      SELECT id, name, price_cents, active
      FROM products
      WHERE active = TRUE
      ORDER BY id ASC
    `;
    return NextResponse.json({ products });
  } catch (err) {
    console.error("GET /api/products", err);
    return NextResponse.json(
      { error: "Não foi possível carregar os produtos." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
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
      INSERT INTO products (name, price_cents)
      VALUES (${name}, ${priceCents})
      RETURNING id, name, price_cents, active
    `;
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("POST /api/products", err);
    return NextResponse.json(
      { error: "Não foi possível salvar o produto." },
      { status: 500 }
    );
  }
}
