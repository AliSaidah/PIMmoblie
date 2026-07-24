export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Converte um texto digitado (ex.: "3,50" ou "3.50") para centavos. */
export function reaisToCents(input: string): number | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
