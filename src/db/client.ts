import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Driver-agnostic Drizzle database: PGlite locally, Neon in production. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

type Closable = { close?: () => Promise<void>; end?: () => Promise<void> };
type Store = { __workoutDb?: Promise<Database> };

const store = globalThis as unknown as Store;
const migrationsFolder = () => path.join(process.cwd(), "drizzle");

async function connectPglite(dataDir?: string): Promise<Database> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = drizzle({ client: new PGlite(dataDir), schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db as unknown as Database;
}

/** Applies the Node WebSocket constructor where no global WebSocket exists. */
export async function configureNeon() {
  const { neonConfig } = await import("@neondatabase/serverless");
  if (typeof WebSocket === "undefined") {
    neonConfig.webSocketConstructor = (await import("ws")).default;
  }
}

async function connectNeon(url: string): Promise<Database> {
  const [{ Pool }, { drizzle }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-serverless"),
  ]);
  await configureNeon();
  return drizzle({
    client: new Pool({ connectionString: url }),
    schema,
  }) as unknown as Database;
}

/**
 * One cached connection per process (survives Next dev HMR via globalThis).
 * DATABASE_URL unset -> embedded PGlite in .data/pglite, migrated on first use.
 */
export function getDb(): Promise<Database> {
  if (!store.__workoutDb) {
    const url = process.env.DATABASE_URL;
    const connecting = url
      ? connectNeon(url)
      : connectPglite(
          path.resolve(
            process.cwd(),
            process.env.PGLITE_DATA_DIR ?? ".data/pglite",
          ),
        );
    store.__workoutDb = connecting.catch((error) => {
      store.__workoutDb = undefined;
      throw error;
    });
  }
  return store.__workoutDb;
}

/** Closes the cached connection. Scripts call this so the process can exit. */
export async function closeDb(): Promise<void> {
  const pending = store.__workoutDb;
  store.__workoutDb = undefined;
  if (!pending) return;
  const db = (await pending) as unknown as { $client?: Closable };
  await (db.$client?.close?.() ?? db.$client?.end?.());
}

/** A fresh, migrated, in-memory PGlite database for tests. */
export function createTestDb(): Promise<Database> {
  return connectPglite();
}
