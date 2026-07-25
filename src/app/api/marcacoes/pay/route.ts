import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quita todas as vendas marcadas em aberto de uma pessoa. */
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const personId = Number(body?.person_id);
    if (!Number.isInteger(personId)) {
      return NextResponse.json({ error: "Pessoa inválida." }, { status: 400 });
    }
    const updated = await sql`
      UPDATE sales
      SET paid = TRUE, paid_at = now()
      WHERE person_id = ${personId}
        AND payment_method = 'marcado'
        AND paid = FALSE
      RETURNING id
    `;
    return NextResponse.json({ ok: true, settled: updated.length });
  } catch (err) {
    console.error("POST /api/marcacoes/pay", err);
    return NextResponse.json(
      { error: "Não foi possível marcar como pago." },
      { status: 500 }
    );
  }
}
