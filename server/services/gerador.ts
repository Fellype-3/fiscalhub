/**
 * Gerador de calendário: cria as obrigações (tarefas) e o checklist de fechamento
 * de uma competência a partir do cadastro dos clientes e das regras.
 * É idempotente: rodar de novo não duplica tarefas (índice único cliente × regra × competência).
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { checklist, clientes, excecoesRegra, feriados, modeloChecklist, regras, tarefas, type Cliente, type Regra } from "../db/schema";
import { calcularVencimento, criarEhDiaUtil, type FeriadoLocal } from "./calendario";

export function regraSeAplica(regra: Regra, cliente: Cliente, excecao?: boolean) {
  if (excecao === false) return false;
  if (excecao === true) return true;
  if (regra.regimes.length && !regra.regimes.includes(cliente.regime)) return false;
  if (regra.ufs.length && !regra.ufs.includes(cliente.uf)) return false;
  if (regra.municipios.length && !regra.municipios.some(m => m.toLowerCase() === cliente.municipio.toLowerCase())) return false;
  if (regra.atividades.length && !regra.atividades.some(a => cliente.atividades.includes(a))) return false;
  return true;
}

export function regraCompleta(regra: Pick<Regra, "tipoVencimento" | "dia">) {
  return regra.tipoVencimento === "ultimo_dia_util" || (!!regra.dia && regra.dia > 0);
}

export type ResultadoGeracao = {
  competencia: string;
  criadas: number;
  jaExistiam: number;
  clientes: number;
  checklistsCriados: number;
  regrasIncompletas: { id: number; nome: string }[];
  semRevisao: number;
  itens: { cliente: string; obrigacao: string; vencimento: string; nova: boolean }[];
};

export async function gerarCompetencia(competencia: string, opcoes: { clienteId?: number; simular?: boolean } = {}): Promise<ResultadoGeracao> {
  const banco = db();
  const listaClientes = await banco.select().from(clientes).where(
    opcoes.clienteId ? and(eq(clientes.ativo, true), eq(clientes.id, opcoes.clienteId)) : eq(clientes.ativo, true),
  );
  const listaRegras = await banco.select().from(regras).where(eq(regras.ativa, true));
  const excecoes = await banco.select().from(excecoesRegra);
  const locais: FeriadoLocal[] = (await banco.select().from(feriados)).map(f => ({ data: f.data, uf: f.uf, municipio: f.municipio }));
  const existentes = listaClientes.length
    ? await banco.select({ clienteId: tarefas.clienteId, regraId: tarefas.regraId }).from(tarefas)
        .where(and(eq(tarefas.competencia, competencia), inArray(tarefas.clienteId, listaClientes.map(c => c.id))))
    : [];
  const jaTem = new Set(existentes.map(e => `${e.clienteId}:${e.regraId}`));
  const modelo = await banco.select().from(modeloChecklist).where(eq(modeloChecklist.ativo, true)).orderBy(modeloChecklist.ordem);

  const incompletas = listaRegras.filter(r => !regraCompleta(r));
  const completas = listaRegras.filter(regraCompleta);
  const resultado: ResultadoGeracao = {
    competencia, criadas: 0, jaExistiam: 0, clientes: listaClientes.length, checklistsCriados: 0,
    regrasIncompletas: incompletas.map(r => ({ id: r.id, nome: r.nome })), semRevisao: 0, itens: [],
  };

  const novas: (typeof tarefas.$inferInsert)[] = [];
  for (const cliente of listaClientes) {
    for (const regra of completas) {
      const exc = excecoes.find(e => e.clienteId === cliente.id && e.regraId === regra.id);
      if (!regraSeAplica(regra, cliente, exc?.ativa)) continue;
      const local = regra.esfera === "federal" ? {} : regra.esfera === "estadual" ? { uf: cliente.uf } : { uf: cliente.uf, municipio: cliente.municipio };
      const vencimento = calcularVencimento(regra, competencia, criarEhDiaUtil(locais, local));
      if (!vencimento) continue;
      const chave = `${cliente.id}:${regra.id}`;
      const nova = !jaTem.has(chave);
      resultado.itens.push({ cliente: cliente.razaoSocial, obrigacao: regra.nome, vencimento, nova });
      if (!nova) { resultado.jaExistiam++; continue; }
      if (!regra.revisadaEm) resultado.semRevisao++;
      novas.push({
        clienteId: cliente.id, regraId: regra.id, competencia, titulo: regra.nome, vencimento,
        responsavelId: cliente.responsavelId, revisorId: cliente.revisorId, regraNaoRevisada: !regra.revisadaEm,
      });
    }
  }
  resultado.criadas = novas.length;

  if (opcoes.simular) return resultado;

  await banco.transaction(async tx => {
    if (novas.length) await tx.insert(tarefas).values(novas).onConflictDoNothing();
    if (modelo.length && listaClientes.length) {
      const comChecklist = await tx.selectDistinct({ clienteId: checklist.clienteId }).from(checklist)
        .where(and(eq(checklist.competencia, competencia), inArray(checklist.clienteId, listaClientes.map(c => c.id))));
      const possui = new Set(comChecklist.map(c => c.clienteId));
      const itens = listaClientes.filter(c => !possui.has(c.id)).flatMap(c => modelo.map(m => ({ clienteId: c.id, competencia, texto: m.texto, ordem: m.ordem })));
      if (itens.length) await tx.insert(checklist).values(itens);
      resultado.checklistsCriados = listaClientes.length - possui.size;
    }
  });
  return resultado;
}
