import { db } from "../db/client";
import { historico } from "../db/schema";

export type EntradaHistorico = {
  acao: string;
  entidade: string;
  entidadeId?: number | null;
  clienteId?: number | null;
  resumo: string;
  detalhes?: unknown;
};

/** Grava uma linha no histórico (quem, o quê, quando, de onde). Nunca derruba a operação principal. */
export async function registrar(ator: { usuarioId?: number | null; ip?: string }, e: EntradaHistorico) {
  try {
    await db().insert(historico).values({
      usuarioId: ator.usuarioId ?? null,
      ip: ator.ip ?? null,
      acao: e.acao,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      clienteId: e.clienteId ?? null,
      resumo: e.resumo,
      detalhes: (e.detalhes ?? null) as any,
    });
  } catch (err) {
    console.error("[histórico] falha ao registrar", err);
  }
}

/** Lista campos que mudaram entre dois objetos (para o histórico). */
export function diferencas<T extends Record<string, any>>(antes: T, depois: Partial<T>) {
  const mudou: Record<string, { de: unknown; para: unknown }> = {};
  for (const [k, v] of Object.entries(depois)) {
    if (v === undefined) continue;
    const a = antes[k];
    const iguais = a instanceof Date || v instanceof Date ? String(a) === String(v) : JSON.stringify(a) === JSON.stringify(v);
    if (!iguais) mudou[k] = { de: a, para: v };
  }
  return mudou;
}
