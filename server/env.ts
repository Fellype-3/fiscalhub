import fs from "node:fs";
import path from "node:path";

// Carrega .env simples (CHAVE=valor) sem dependência extra.
const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  for (const linha of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const producao = process.env.NODE_ENV === "production";

export const ENV = {
  producao,
  porta: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || "",
  databaseUrl: process.env.DATABASE_URL || "",
  dataDir: path.resolve(process.env.DATA_DIR || "./data"),
  encryptionKey: process.env.ENCRYPTION_KEY || "",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 20),
  sessaoHoras: Number(process.env.SESSION_HOURS || 12),
};

export function validarAmbiente() {
  if (ENV.producao && !/^[0-9a-f]{64}$/i.test(ENV.encryptionKey)) {
    throw new Error("ENCRYPTION_KEY ausente ou inválida (precisa de 64 caracteres hexadecimais). Veja .env.example.");
  }
  if (!ENV.producao && !ENV.encryptionKey) {
    console.warn("[aviso] ENCRYPTION_KEY não definida — usando chave de desenvolvimento. Não use assim em produção.");
  }
}
