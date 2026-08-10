import { Pool, type QueryResultRow } from "pg";
import { assertAppEnv } from "@/lib/env";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

export function getPool() {
  if (!globalForPg.pgPool) {
    const { databaseUrl } = assertAppEnv();
    globalForPg.pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
    });
  }

  return globalForPg.pgPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
