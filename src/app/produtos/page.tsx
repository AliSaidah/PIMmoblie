"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { formatBRL, reaisToCents } from "@/lib/money";
import { apiGet, apiSend } from "@/lib/client";

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ products: Product[] }>("/api/products");
      setProducts(data.products);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addProduct() {
    const name = newName.trim();
    const cents = reaisToCents(newPrice);
    if (!name) return setError("Informe o nome do produto.");
    if (cents === null) return setError("Preço inválido.");
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/products", "POST", { name, price_cents: cents });
      setNewName("");
      setNewPrice("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Product) {
    setEditId(p.id);
    setEditName(p.name);
    setEditPrice((p.price_cents / 100).toFixed(2).replace(".", ","));
    setError(null);
  }

  async function saveEdit(id: number) {
    const name = editName.trim();
    const cents = reaisToCents(editPrice);
    if (!name) return setError("Informe o nome do produto.");
    if (cents === null) return setError("Preço inválido.");
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/products/${id}`, "PATCH", { name, price_cents: cents });
      setEditId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(p: Product) {
    if (!confirm(`Remover "${p.name}"? Ele some da tela de venda (o histórico é mantido).`))
      return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/products/${p.id}`, "DELETE");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Produtos</h1>

      {error && (
        <div className="mb-3 rounded-xl border border-danger bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          ⚠️ {error}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="mb-2 font-semibold text-slate-700">Adicionar produto</p>
        <div className="flex flex-col gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome (ex.: Suco)"
            className="rounded-xl border border-slate-300 px-3 py-3"
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                R$
              </span>
              <input
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3"
              />
            </div>
            <button
              onClick={addProduct}
              disabled={busy}
              className="rounded-xl bg-success px-5 font-bold text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) =>
            editId === p.id ? (
              <div key={p.id} className="rounded-2xl border-2 border-navy bg-white p-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <div className="relative mb-2">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    R$
                  </span>
                  <input
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(p.id)}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-success py-2 font-bold text-white disabled:opacity-40"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="flex-1 rounded-xl bg-slate-100 py-2 font-bold text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div>
                  <p className="font-bold text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-500">{formatBRL(p.price_cents)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => removeProduct(p)}
                    className="rounded-xl bg-danger/10 px-4 py-2 font-semibold text-danger"
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          )}
          {products.length === 0 && (
            <p className="text-sm text-slate-400">Nenhum produto cadastrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
