import { sql, ensureSchema, EVENT_TZ } from "@/lib/db";
import { PAYMENT_LABELS, PaymentMethod } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function reais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET() {
  try {
    await ensureSchema();

    const rows = await sql<
      {
        sale_id: number;
        created_local: string;
        payment_method: PaymentMethod;
        paid: boolean;
        canceled: boolean;
        person_name: string | null;
        product_name: string;
        unit_price_cents: number;
        quantity: number;
        total_cents: number;
      }[]
    >`
      SELECT s.id AS sale_id,
             to_char(s.created_at AT TIME ZONE ${EVENT_TZ}, 'YYYY-MM-DD HH24:MI:SS') AS created_local,
             s.payment_method,
             s.paid,
             s.canceled,
             p.name AS person_name,
             si.product_name,
             si.unit_price_cents,
             si.quantity,
             s.total_cents
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN people p ON p.id = s.person_id
      ORDER BY s.id ASC, si.id ASC
    `;

    const header = [
      "venda_id",
      "data_hora",
      "forma_pagamento",
      "pago",
      "cancelada",
      "pessoa",
      "produto",
      "preco_unit",
      "quantidade",
      "subtotal_item",
      "total_venda",
    ];

    const lines = [header.join(";")];
    for (const r of rows) {
      lines.push(
        [
          r.sale_id,
          r.created_local,
          PAYMENT_LABELS[r.payment_method] ?? r.payment_method,
          r.paid ? "sim" : "não",
          r.canceled ? "sim" : "não",
          r.person_name ?? "",
          r.product_name,
          reais(r.unit_price_cents),
          r.quantity,
          reais(r.unit_price_cents * r.quantity),
          reais(r.total_cents),
        ]
          .map(csvField)
          .join(";")
      );
    }

    // BOM para o Excel abrir com acentuação correta.
    const csv = "﻿" + lines.join("\r\n") + "\r\n";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup-caixa-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/backup", err);
    return new Response("Não foi possível gerar o backup.", { status: 500 });
  }
}
