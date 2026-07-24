"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person } from "@/lib/types";
import { apiGet, apiSend } from "@/lib/client";

export default function PersonPicker({
  selected,
  onSelect,
}: {
  selected: Person | null;
  onSelect: (p: Person | null) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiGet<{ people: Person[] }>("/api/people");
      setPeople(data.people);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  async function addPerson() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiSend<{ person: Person }>("/api/people", "POST", { name });
      setNewName("");
      setPeople((prev) =>
        prev.some((p) => p.id === data.person.id) ? prev : [...prev, data.person]
      );
      onSelect(data.person);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      {selected ? (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-success/10 px-3 py-2">
          <span className="font-semibold text-success">👤 {selected.name}</span>
          <button
            onClick={() => onSelect(null)}
            className="text-sm font-medium text-slate-500 underline"
          >
            trocar
          </button>
        </div>
      ) : (
        <p className="mb-2 text-sm font-medium text-slate-500">
          Selecione a pessoa que ficou marcada:
        </p>
      )}

      {people.length > 10 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome…"
          className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2"
        />
      )}

      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">Nenhuma pessoa encontrada.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={`rounded-xl px-3 py-2 text-left ${
                  selected?.id === p.id
                    ? "bg-success text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addPerson();
          }}
          placeholder="Cadastrar nova pessoa…"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2"
        />
        <button
          onClick={addPerson}
          disabled={busy || !newName.trim()}
          className="rounded-xl bg-navy px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
