import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const people = q
      ? await sql`
          SELECT id, name FROM people
          WHERE name ILIKE ${"%" + q + "%"}
          ORDER BY name ASC
          LIMIT 50
        `
      : await sql`SELECT id, name FROM people ORDER BY name ASC`;
    return NextResponse.json({ people });
  } catch (err) {
    console.error("GET /api/people", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as pessoas." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Informe o nome da pessoa." }, { status: 400 });
    }
    // Evita duplicar a mesma pessoa (comparação sem diferenciar maiúsculas).
    const [existing] = await sql`
      SELECT id, name FROM people WHERE lower(name) = lower(${name}) LIMIT 1
    `;
    if (existing) {
      return NextResponse.json({ person: existing, existed: true });
    }
    const [person] = await sql`
      INSERT INTO people (name) VALUES (${name})
      RETURNING id, name
    `;
    return NextResponse.json({ person }, { status: 201 });
  } catch (err) {
    console.error("POST /api/people", err);
    return NextResponse.json(
      { error: "Não foi possível salvar a pessoa." },
      { status: 500 }
    );
  }
}
