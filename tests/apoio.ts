import { conectar, db } from "../server/db/client";
import { clientes, regras, sessoes, usuarios, modeloChecklist } from "../server/db/schema";
import { gerarHashSenha, novoToken, sha256 } from "../server/services/seguranca";
import { REGRAS_INICIAIS, CHECKLIST_INICIAL } from "../server/services/regrasIniciais";
import { calcularDvCnpj } from "../shared/documento";

export const cnpj = (n: number) => { const b = `TEST${String(n).padStart(4, "0")}0001`; return b + calcularDvCnpj(b); };

export async function prepararBanco() {
  process.env.DATA_DIR = process.env.DATA_DIR || "./data-teste";
  await conectar({ memoria: true });
  await db().insert(regras).values(REGRAS_INICIAIS);
  await db().insert(modeloChecklist).values(CHECKLIST_INICIAL.map((texto, ordem) => ({ texto, ordem })));
  const hash = await gerarHashSenha("Senha-teste-123");
  const [admin] = await db().insert(usuarios).values({ nome: "Admin", email: "admin@t", papel: "admin", senhaHash: hash, trocarSenha: false }).returning();
  const [a, b] = await db().insert(clientes).values([
    { razaoSocial: "Empresa A", documento: cnpj(1), uf: "GO", municipio: "Goiânia", regime: "presumido", atividades: ["comercio"], responsavelId: admin.id },
    { razaoSocial: "Empresa B", documento: cnpj(2), uf: "SP", municipio: "São Paulo", regime: "simples", atividades: ["servicos"] },
  ]).returning();
  const [portalA] = await db().insert(usuarios).values({ nome: "Portal A", email: "a@t", papel: "cliente", clienteId: a.id, senhaHash: hash, trocarSenha: false }).returning();
  return { admin, a, b, portalA };
}

export async function sessaoPara(usuarioId: number) {
  const token = novoToken();
  await db().insert(sessoes).values({ id: sha256(token), usuarioId, expiraEm: new Date(Date.now() + 3600_000) });
  return token;
}
