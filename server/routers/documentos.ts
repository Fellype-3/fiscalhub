import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { clientes, documentos, usuarios } from "../db/schema";
import { procedimentoAdmin, procedimentoEquipe, router } from "../trpc";
import { registrar } from "../services/historico";
import { apagarArquivo } from "../services/armazenamento";
import { CATEGORIAS_DOC } from "../../shared/dominio";
import { competenciaValida } from "../../shared/competencia";

export const documentosRouter = router({
  listar: procedimentoEquipe.input(z.object({
    clienteId: z.number().optional(), competencia: z.string().optional(), categoria: z.enum(CATEGORIAS_DOC).optional(),
    tarefaId: z.number().optional(), demandaId: z.number().optional(), limite: z.number().int().max(1000).default(300),
  }).optional()).query(async ({ input }) => {
    const f = input ?? { limite: 300 };
    const c = [];
    if (f.clienteId) c.push(eq(documentos.clienteId, f.clienteId));
    if (f.competencia) c.push(eq(documentos.competencia, f.competencia));
    if (f.categoria) c.push(eq(documentos.categoria, f.categoria));
    if (f.tarefaId) c.push(eq(documentos.tarefaId, f.tarefaId));
    if (f.demandaId) c.push(eq(documentos.demandaId, f.demandaId));
    return db().select({
      id: documentos.id, nomeOriginal: documentos.nomeOriginal, categoria: documentos.categoria, competencia: documentos.competencia,
      tamanho: documentos.tamanho, infoXml: documentos.infoXml, visivelCliente: documentos.visivelCliente, criadoEm: documentos.criadoEm,
      tarefaId: documentos.tarefaId, demandaId: documentos.demandaId, sha256: documentos.sha256,
      clienteId: clientes.id, cliente: clientes.razaoSocial, enviadoPor: usuarios.nome, enviadoPorPapel: usuarios.papel,
    }).from(documentos)
      .innerJoin(clientes, eq(clientes.id, documentos.clienteId))
      .leftJoin(usuarios, eq(usuarios.id, documentos.enviadoPorId))
      .where(c.length ? and(...c) : undefined)
      .orderBy(desc(documentos.criadoEm)).limit(f.limite ?? 300);
  }),

  atualizar: procedimentoEquipe.input(z.object({
    id: z.number().int(), categoria: z.enum(CATEGORIAS_DOC).optional(), visivelCliente: z.boolean().optional(),
    competencia: z.string().refine(competenciaValida).nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...dados } = input;
    const [d] = await db().update(documentos).set(dados).where(eq(documentos.id, id)).returning();
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "documento_alterado", entidade: "documento", entidadeId: id, clienteId: d.clienteId, resumo: `Alterou o documento ${d.nomeOriginal}${dados.visivelCliente !== undefined ? (dados.visivelCliente ? " (liberado no portal)" : " (oculto do portal)") : ""}` });
    return d;
  }),

  excluir: procedimentoAdmin.input(z.object({ id: z.number().int(), motivo: z.string().trim().min(5, "informe o motivo da exclusão").max(500) })).mutation(async ({ ctx, input }) => {
    const [d] = await db().delete(documentos).where(eq(documentos.id, input.id)).returning();
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });
    await apagarArquivo(d.chaveArmazenamento);
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "documento_excluido", entidade: "documento", entidadeId: d.id, clienteId: d.clienteId, resumo: `Excluiu o documento ${d.nomeOriginal}. Motivo: ${input.motivo}`, detalhes: { sha256: d.sha256 } });
    return { ok: true };
  }),
});
