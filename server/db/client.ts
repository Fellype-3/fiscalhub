import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";
import { ENV } from "../env";

export type DB = NodePgDatabase<typeof schema>;

let _db: DB | null = null;
let _fechar: (() => Promise<void>) | null = null;

function pastaMigracoes() {
  const candidatos = [
    path.resolve(process.cwd(), "drizzle"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle"),
  ];
  const achada = candidatos.find(p => fs.existsSync(path.join(p, "meta/_journal.json")));
  if (!achada) throw new Error("Pasta de migrações 'drizzle/' não encontrada.");
  return achada;
}

/**
 * Conecta ao banco e aplica as migrações pendentes.
 * - DATABASE_URL definida → PostgreSQL (produção).
 * - Sem DATABASE_URL → PGlite (Postgres embutido) em DATA_DIR/pglite.
 * - opcoes.memoria → PGlite em memória (testes).
 */
export async function conectar(opcoes: { memoria?: boolean } = {}): Promise<DB> {
  if (_db) return _db;
  const migrationsFolder = pastaMigracoes();
  if (ENV.databaseUrl && !opcoes.memoria) {
    const pool = new pg.Pool({ connectionString: ENV.databaseUrl, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    _db = db;
    _fechar = () => pool.end();
  } else {
    let cliente: PGlite;
    if (opcoes.memoria) {
      cliente = new PGlite();
    } else {
      const dir = path.join(ENV.dataDir, "pglite");
      fs.mkdirSync(dir, { recursive: true });
      cliente = new PGlite(dir);
    }
    const db = drizzlePglite(cliente, { schema });
    await migratePglite(db, { migrationsFolder });
    _db = db as unknown as DB;
    _fechar = () => cliente.close();
  }
  return _db;
}

export function db(): DB {
  if (!_db) throw new Error("Banco não conectado. Chame conectar() antes.");
  return _db;
}

export async function desconectar() {
  if (_fechar) await _fechar();
  _db = null;
  _fechar = null;
}
