"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBRL } from "@/lib/money";
import { apiGet, apiSend } from "@/lib/client";

interface OpenPerson {
  id: number;
  name: string;
  open_cents: number;
  items: { product_name: string; quantity: number }[];
}

interface MarcacoesData {
  open: OpenPerson[];
  clear: { id: number; name: string }[];
}

export default function MarcacoesPage() {
  const [data, setData] = useState<MarcacoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<MarcacoesData>("/api/marcacoes");
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addPerson() {
    const name = newName.trim();
    if (!name || addBusy) return;
    setAddBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiSend<{ existed?: boolean }>("/api/people", "POST", { name });
      setNewName("");
      setNotice(res.existed ? "Pessoa já estava cadastrada." : "Pessoa cadastrada.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function markPaid(person: OpenPerson) {
    if (
      !confirm(
        `Confirmar que ${person.name} pagou ${formatBRL(person.open_cents)}?`
      )
    )
      return;
    setPayingId(person.id);
    setError(null);
    setNotice(null);
    try {
      await apiSend("/api/marcacoes/pay", "POST", { person_id: person.id });
      setNotice(`${person.name} — marcado como pago.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPayingId(null);
    }
  }

  const totalOpen = useMemo(
    () => (data?.open || []).reduce((s, p) => s + p.open_cents, 0),
    [data]
  );

  const filteredOpen = useMemo(() => {
    const list = data?.open || [];
    const q = query.trim().toLowerCase();
    if (list.length <= 10 || !q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [data, query]);

  const filteredClear = useMemo(() => {
    const list = data?.clear || [];
    const q = query.trim().toLowerCase();
    if (list.length <= 10 || !q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [data, query]);

  const showSearch =
    (data?.open.length || 0) + (data?.clear.length || 0) > 10;

  return (
    <div className="px-4 pt-5">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Marcações</h1>

      <div className="mb-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addPerson();
          }}
          placeholder="Cadastrar nova pessoa…"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-3"
        />
        <button
          onClick={addPerson}
          disabled={addBusy || !newName.trim()}
          className="rounded-xl bg-navy px-4 font-semibold text-white disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      {notice && (
        <div className="mb-3 rounded-xl bg-success/10 px-3 py-2 text-sm font-medium text-success">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-xl border border-danger bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          ⚠️ {error}
        </div>
      )}

      {showSearch && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome…"
          className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-3"
        />
      )}

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <>
          <div className="mb-3 rounded-2xl bg-danger p-4 text-white">
            <p className="text-sm text-white/80">Total em aberto</p>
            <p className="text-2xl font-extrabold">{formatBRL(totalOpen)}</p>
          </div>

          <section className="mb-6">
            <h2 className="mb-2 font-bold text-slate-800">
              Em aberto ({filteredOpen.length})
            </h2>
            {filteredOpen.length === 0 ? (
              <p className="text-sm text-slate-400">Ninguém com conta em aberto. 🎉</p>
            ) : (
              <div className="space-y-2">
                {filteredOpen.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border-2 border-danger/30 bg-white p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <p className="text-sm text-slate-500">
                          {p.items
                            .map((i) => `${i.quantity}× ${i.product_name}`)
                            .join(", ")}
                        </p>
                      </div>
                      <span className="text-lg font-extrabold text-danger">
                        {formatBRL(p.open_cents)}
                      </span>
                    </div>
                    <button
                      onClick={() => markPaid(p)}
                      disabled={payingId === p.id}
                      className="mt-3 w-full rounded-xl bg-success py-3 font-bold text-white disabled:opacity-50"
                    >
                      {payingId === p.id ? "Confirmando…" : "✓ Marcar como pago"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-bold text-slate-800">
              Cadastradas sem conta em aberto ({filteredClear.length})
            </h2>
            {filteredClear.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma pessoa nesta lista.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredClear.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
