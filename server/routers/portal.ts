import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { clientes, demandas, documentos, tarefas } from "../db/schema";
import { procedimentoCliente, router } from "../trpc";
import { competenciaEmFechamento } from "../../shared/competencia";

/** Portal do cliente: tudo aqui é filtrado pelo clienteId do usuário logado. */
export const portalRouter = router({
  resumo: procedimentoCliente.query(async ({ ctx }) => {
    const [cliente] = await db().select({ razaoSocial: clientes.razaoSocial, documento: clientes.documento, uf: clientes.uf, municipio: clientes.municipio })
      .from(clientes).where(eq(clientes.id, ctx.clienteId));
    const pendencias = await db().select({ id: tarefas.id, titulo: tarefas.titulo, competencia: tarefas.competencia, vencimento: tarefas.vencimento, observacoes: tarefas.observacoes })
      .from(tarefas).where(and(eq(tarefas.clienteId, ctx.clienteId), eq(tarefas.status, "aguardando_cliente"))).orderBy(asc(tarefas.vencimento));
    const solicitacoes = await db().select({ id: demandas.id, titulo: demandas.titulo, prazoInterno: demandas.prazoInterno })
      .from(demandas).where(and(eq(demandas.clienteId, ctx.clienteId), eq(demandas.status, "aguardando_cliente"))).orderBy(asc(demandas.prazoInterno));
    const docs = await db().select({ id: documentos.id, nomeOriginal: documentos.nomeOriginal, categoria: documentos.categoria, competencia: documentos.competencia, tamanho: documentos.tamanho, criadoEm: documentos.criadoEm, enviadoPorMim: sql<boolean>`coalesce(${documentos.enviadoPorId} = ${ctx.usuario.id}, false)`, infoXml: documentos.infoXml })
      .from(documentos)
      .where(and(eq(documentos.clienteId, ctx.clienteId), or(eq(documentos.visivelCliente, true), eq(documentos.enviadoPorId, ctx.usuario.id))))
      .orderBy(desc(documentos.criadoEm)).limit(200);
    return { cliente, pendencias, solicitacoes, documentos: docs, competenciaSugerida: competenciaEmFechamento() };
  }),
});
