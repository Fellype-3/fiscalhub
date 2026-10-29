import { ENV, validarAmbiente } from "./env";
import { conectar } from "./db/client";
import { criarApp } from "./app";
import { db } from "./db/client";
import { sessoes } from "./db/schema";
import { lt } from "drizzle-orm";

async function iniciar() {
  validarAmbiente();
  await conectar();
  const app = criarApp();
  app.listen(ENV.porta, () => {
    console.log(`FiscalHub rodando em http://localhost:${ENV.porta} (${ENV.databaseUrl ? "PostgreSQL" : "banco embutido em " + ENV.dataDir})`);
  });
  // Limpa sessões expiradas a cada hora
  setInterval(() => db().delete(sessoes).where(lt(sessoes.expiraEm, new Date())).catch(() => {}), 3600_000).unref();
}

iniciar().catch(err => {
  console.error("Falha ao iniciar:", err);
  process.exit(1);
});
