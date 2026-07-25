"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person, Product, PaymentMethod } from "@/lib/types";
import { PAYMENT_LABELS } from "@/lib/types";
import { formatBRL, reaisToCents } from "@/lib/money";
import { apiGet, apiSend } from "@/lib/client";
import PersonPicker from "@/components/PersonPicker";

const METHODS: PaymentMethod[] = ["cartao", "pix", "dinheiro", "marcado"];

export default function VendaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [qty, setQty] = useState<Record<number, number>>({});
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [cashReceived, setCashReceived] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiGet<{ products: Product[] }>("/api/products");
      setProducts(data.products);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function changeQty(id: number, delta: number) {
    setQty((prev) => {
      const next = Math.max(0, (prev[id] || 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
    setSuccess(null);
  }

  const cart = useMemo(
    () =>
      products
        .filter((p) => qty[p.id] > 0)
        .map((p) => ({ product: p, quantity: qty[p.id] })),
    [products, qty]
  );

  const totalCents = useMemo(
    () => cart.reduce((sum, c) => sum + c.product.price_cents * c.quantity, 0),
    [cart]
  );

  const canSubmit =
    !saving &&
    cart.length > 0 &&
    method !== null &&
    (method !== "marcado" || person !== null);

  async function submit() {
    if (!canSubmit || method === null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiSend("/api/sales", "POST", {
        payment_method: method,
        person_id: method === "marcado" ? person?.id : undefined,
        items: cart.map((c) => ({ product_id: c.product.id, quantity: c.quantity })),
      });
      // Só chega aqui se o banco confirmou a gravação (status 201).
      setSuccess(
        `Venda de ${formatBRL(totalCents)} salva com sucesso` +
          (method === "marcado" && person ? ` — marcada para ${person.name}.` : ".")
      );
      setQty({});
      setMethod(null);
      setPerson(null);
      setCashReceived("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Nova venda</h1>

      {success && (
        <div className="mb-4 rounded-2xl border-2 border-success bg-success/10 p-4 text-success">
          <p className="font-bold">✅ {success}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-2xl border-2 border-danger bg-danger/10 p-4 text-danger">
          <p className="font-bold">⚠️ {error}</p>
          <p className="text-sm">Confira a conexão e tente lançar de novo.</p>
        </div>
      )}

      {loadError && (
        <div className="mb-4 rounded-2xl border-2 border-danger bg-danger/10 p-4 text-danger">
          <p className="font-bold">Erro ao carregar produtos.</p>
          <p className="text-sm">{loadError}</p>
          <button
            onClick={loadProducts}
            className="mt-2 rounded-xl bg-danger px-4 py-2 font-semibold text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">Carregando produtos…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => {
            const q = qty[p.id] || 0;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border bg-white p-3 ${
                  q > 0 ? "border-success" : "border-slate-200"
                }`}
              >
                <div className="mb-2">
                  <p className="font-bold leading-tight text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-500">{formatBRL(p.price_cents)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => changeQty(p.id, -1)}
                    disabled={q === 0}
                    className="h-11 w-11 rounded-full bg-slate-100 text-2xl font-bold text-slate-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xl font-bold">{q}</span>
                  <button
                    onClick={() => changeQty(p.id, 1)}
                    className="h-11 w-11 rounded-full bg-success text-2xl font-bold text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="mt-5 rounded-2xl bg-navy p-4 text-white">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/70">
            Resumo do carrinho
          </p>
          <ul className="mb-3 space-y-1">
            {cart.map((c) => (
              <li key={c.product.id} className="flex justify-between text-sm">
                <span>
                  {c.quantity}× {c.product.name}
                </span>
                <span>{formatBRL(c.product.price_cents * c.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-white/20 pt-2">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-extrabold">{formatBRL(totalCents)}</span>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 font-semibold text-slate-700">Forma de pagamento</p>
          <div className="grid grid-cols-2 gap-3">
            {METHODS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  if (m !== "marcado") setPerson(null);
                  if (m !== "dinheiro") setCashReceived("");
                  setSuccess(null);
                }}
                className={`rounded-2xl py-4 text-lg font-bold ${
                  method === m
                    ? m === "marcado"
                      ? "bg-danger text-white"
                      : "bg-success text-white"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                {PAYMENT_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      )}

      {cart.length > 0 && method === "dinheiro" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 font-semibold text-slate-700">Calculadora de troco</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {[5, 10, 20, 50, 100, 200]
              .filter((b) => b * 100 >= totalCents)
              .map((b) => (
                <button
                  key={b}
                  onClick={() => setCashReceived(String(b))}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                >
                  R$ {b}
                </button>
              ))}
            <button
              onClick={() =>
                setCashReceived((totalCents / 100).toFixed(2).replace(".", ","))
              }
              className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
            >
              Valor exato
            </button>
          </div>
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              R$
            </span>
            <input
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              inputMode="decimal"
              placeholder="Valor recebido"
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-lg"
            />
          </div>
          {(() => {
            const received = reaisToCents(cashReceived);
            if (received === null) {
              return (
                <p className="text-sm text-slate-400">
                  Digite quanto o cliente deu para ver o troco.
                </p>
              );
            }
            const troco = received - totalCents;
            const positive = troco >= 0;
            return (
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-3 ${
                  positive ? "bg-success/10" : "bg-danger/10"
                }`}
              >
                <span
                  className={`font-semibold ${
                    positive ? "text-success" : "text-danger"
                  }`}
                >
                  {positive ? "Troco" : "Falta"}
                </span>
                <span
                  className={`text-2xl font-extrabold ${
                    positive ? "text-success" : "text-danger"
                  }`}
                >
                  {formatBRL(Math.abs(troco))}
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {cart.length > 0 && method === "marcado" && (
        <div className="mt-4">
          <PersonPicker selected={person} onSelect={setPerson} />
        </div>
      )}

      {cart.length > 0 && (
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-6 w-full rounded-2xl bg-success py-5 text-xl font-extrabold text-white shadow-lg disabled:opacity-40"
        >
          {saving ? "Salvando…" : `Lançar venda • ${formatBRL(totalCents)}`}
        </button>
      )}

      {cart.length > 0 && method === "marcado" && !person && (
        <p className="mt-2 text-center text-sm font-medium text-danger">
          Selecione a pessoa para lançar a venda marcada.
        </p>
      )}
    </div>
  );
}
