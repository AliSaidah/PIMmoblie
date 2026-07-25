"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBRL } from "@/lib/money";
import { apiGet } from "@/lib/client";
import { PAYMENT_LABELS, PaymentMethod } from "@/lib/types";

interface ReportSale {
  id: number;
  total_cents: number;
  payment_method: PaymentMethod;
  paid: boolean;
  created_at: string;
  person_name: string | null;
  items: { product_name: string; quantity: number }[];
}

interface Report {
  day: string;
  today: string;
  availableDays: string[];
  totalCents: number;
  salesCount: number;
  byPayment: { payment_method: PaymentMethod; total_cents: number; count: number }[];
  byProduct: { product_name: string; quantity: number; total_cents: number }[];
  sales: ReportSale[];
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function RelatorioPage() {
  const [day, setDay] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Report>(`/api/report${d ? `?day=${d}` : ""}`);
      setReport(data);
      setDay(data.day);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  return (
    <div className="px-4 pt-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Relatório</h1>
        <a
          href="/api/backup"
          className="rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white"
        >
          ⬇︎ Backup CSV
        </a>
      </div>

      {report && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-500">
            Dia do evento
          </label>
          <select
            value={day}
            onChange={(e) => load(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
          >
            {(report.availableDays.includes(day)
              ? report.availableDays
              : [day, ...report.availableDays]
            ).map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
                {d === report.today ? " (hoje)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border-2 border-danger bg-danger/10 p-4 text-danger">
          <p className="font-bold">⚠️ {error}</p>
          <button
            onClick={() => load(day)}
            className="mt-2 rounded-xl bg-danger px-4 py-2 font-semibold text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : report ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-navy p-4 text-white">
              <p className="text-sm text-white/70">Total do dia</p>
              <p className="text-2xl font-extrabold">{formatBRL(report.totalCents)}</p>
            </div>
            <div className="rounded-2xl bg-navy p-4 text-white">
              <p className="text-sm text-white/70">Vendas</p>
              <p className="text-2xl font-extrabold">{report.salesCount}</p>
            </div>
          </div>

          <section>
            <h2 className="mb-2 font-bold text-slate-800">Por forma de pagamento</h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {report.byPayment.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Sem vendas neste dia.</p>
              ) : (
                report.byPayment.map((row) => (
                  <div
                    key={row.payment_method}
                    className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <span className="font-medium">
                      {PAYMENT_LABELS[row.payment_method]}{" "}
                      <span className="text-slate-400">({row.count})</span>
                    </span>
                    <span className="font-bold">{formatBRL(row.total_cents)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-bold text-slate-800">Por produto</h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {report.byProduct.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">Sem vendas neste dia.</p>
              ) : (
                report.byProduct.map((row) => (
                  <div
                    key={row.product_name}
                    className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <span className="font-medium">
                      {row.quantity}× {row.product_name}
                    </span>
                    <span className="font-bold">{formatBRL(row.total_cents)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 font-bold text-slate-800">Últimas vendas</h2>
            <div className="space-y-2">
              {report.sales.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma venda registrada.</p>
              ) : (
                report.sales.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        {formatTime(s.created_at)}
                      </span>
                      <span className="font-bold">{formatBRL(s.total_cents)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      {s.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          s.payment_method === "marcado"
                            ? s.paid
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {PAYMENT_LABELS[s.payment_method]}
                        {s.payment_method === "marcado" && !s.paid ? " • em aberto" : ""}
                      </span>
                      {s.person_name && (
                        <span className="text-slate-500">👤 {s.person_name}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
