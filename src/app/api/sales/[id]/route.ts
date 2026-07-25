import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cancela (desfaz) uma venda. Ela sai dos totais, relatórios e marcações,
 *  mas continua registrada como cancelada para o histórico/backup. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const saleId = Number(id);
    if (!Number.isInteger(saleId)) {
      return NextResponse.json({ error: "Venda inválida." }, { status: 400 });
    }
    const [sale] = await sql`
      UPDATE sales
      SET canceled = TRUE, canceled_at = now()
      WHERE id = ${saleId} AND canceled = FALSE
      RETURNING id
    `;
    if (!sale) {
      return NextResponse.json(
        { error: "Venda não encontrada ou já cancelada." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/[id]", err);
    return NextResponse.json(
      { error: "Não foi possível desfazer a venda." },
      { status: 500 }
    );
  }
}
