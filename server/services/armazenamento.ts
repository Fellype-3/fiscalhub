/**
 * Armazenamento de arquivos em disco (DATA_DIR/arquivos).
 * O arquivo original é gravado sem alteração; o nome no disco é aleatório.
 * Para usar S3/R2/MinIO no futuro, basta reimplementar estas três funções.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ENV } from "../env";

const raiz = () => path.join(ENV.dataDir, "arquivos");

function caminhoSeguro(chave: string) {
  const p = path.resolve(raiz(), chave);
  if (!p.startsWith(path.resolve(raiz()) + path.sep)) throw new Error("Caminho de arquivo inválido");
  return p;
}

export async function salvarArquivo(clienteId: number, nomeOriginal: string, conteudo: Buffer) {
  const ext = path.extname(nomeOriginal).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const agora = new Date();
  const chave = `${clienteId}/${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}${ext}`;
  const destino = caminhoSeguro(chave);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, conteudo, { flag: "wx" });
  return chave;
}

export async function lerArquivo(chave: string) {
  return fs.readFile(caminhoSeguro(chave));
}

export async function apagarArquivo(chave: string) {
  await fs.rm(caminhoSeguro(chave), { force: true });
}
