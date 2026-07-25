import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  __sql?: Sql;
  __schemaReady?: Promise<void>;
};

function createClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Crie um arquivo .env.local com a string de conexão do Postgres (veja o README)."
    );
  }
  const isLocal = /@(localhost|127\.0\.0\.1)/.test(url);
  return postgres(url, {
    // SSL é exigido pelo Vercel Postgres e Supabase; desativado só em localhost.
    ssl: isLocal ? false : "require",
    max: 3,
    // Poolers em modo transação (Supabase 6543 / Vercel pooled) não suportam
    // prepared statements persistentes.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

// Cliente criado sob demanda (nunca durante o build) e reaproveitado entre
// requisições — sobrevive ao hot-reload do dev e ao reuso de instâncias serverless.
function getClient(): Sql {
  return (globalForDb.__sql ??= createClient());
}

// Proxy preguiçoso: só conecta no primeiro uso real, mantendo a API `sql\`...\``.
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    // Chamada como tagged template (sql`...`) ou como função (sql(valor)).
    return (getClient() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function"
      ? (value as (...a: unknown[]) => unknown).bind(client)
      : value;
  },
}) as Sql;

export const DEFAULT_PRODUCTS: { name: string; price_cents: number }[] = [
  { name: "Água", price_cents: 300 },
  { name: "Refri", price_cents: 500 },
  { name: "Antarctica", price_cents: 600 },
  { name: "Heineken", price_cents: 1200 },
];

export const EVENT_TZ = process.env.EVENT_TZ || "America/Sao_Paulo";

/**
 * Cria as tabelas (se ainda não existirem) e insere os produtos padrão.
 * Idempotente e executado no máximo uma vez por processo.
 */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__schemaReady) {
    globalForDb.__schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS people (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS sales (
          id SERIAL PRIMARY KEY,
          total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
          payment_method TEXT NOT NULL
            CHECK (payment_method IN ('cartao','pix','dinheiro','marcado')),
          person_id INTEGER REFERENCES people(id),
          paid BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          paid_at TIMESTAMPTZ
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS sale_items (
          id SERIAL PRIMARY KEY,
          sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          product_name TEXT NOT NULL,
          unit_price_cents INTEGER NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0)
        )
      `;
      // Colunas de cancelamento (adicionadas em bancos já existentes também).
      await sql`
        ALTER TABLE sales ADD COLUMN IF NOT EXISTS canceled BOOLEAN NOT NULL DEFAULT FALSE
      `;
      await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ`;

      await sql`CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_sales_person ON sales (person_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items (sale_id)`;

      const [{ count }] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM products
      `;
      if (count === 0) {
        for (const p of DEFAULT_PRODUCTS) {
          await sql`
            INSERT INTO products (name, price_cents)
            VALUES (${p.name}, ${p.price_cents})
          `;
        }
      }
    })().catch((err) => {
      // Se falhar, permite nova tentativa na próxima requisição.
      globalForDb.__schemaReady = undefined;
      throw err;
    });
  }
  return globalForDb.__schemaReady;
}
