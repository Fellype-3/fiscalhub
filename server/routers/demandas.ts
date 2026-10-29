import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { clientes, comentarios, demandas, documentos, historico, usuarios } from "../db/schema";
import { procedimentoEquipe, router } from "../trpc";
import { diferencas, registrar } from "../services/historico";
import { PRIORIDADES, STATUS_DEMANDA, STATUS_DEMANDA_LABEL, TIPOS_DEMANDA } from "../../shared/dominio";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");

export const demandasRouter = router({
  listar: procedimentoEquipe
    .input(z.object({ status: z.array(z.enum(STATUS_DEMANDA)).optional(), tipo: z.enum(TIPOS_DEMANDA).optional(), responsavelId: z.number().optional(), clienteId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const f = input ?? {};
      const c = [];
      if (f.status?.length) c.push(inArray(demandas.status, f.status));
      if (f.tipo) c.push(eq(demandas.tipo, f.tipo));
      if (f.responsavelId) c.push(eq(demandas.responsavelId, f.responsavelId));
      if (f.clienteId) c.push(eq(demandas.clienteId, f.clienteId));
      return db().select({
        id: demandas.id, tipo: demandas.tipo, origem: demandas.origem, titulo: demandas.titulo, status: demandas.status, prioridade: demandas.prioridade,
        recebidaEm: demandas.recebidaEm, prazoLegal: demandas.prazoLegal, prazoInterno: demandas.prazoInterno, concluidaEm: demandas.concluidaEm,
        clienteId: clientes.id, cliente: clientes.razaoSocial, uf: clientes.uf,
        responsavelId: demandas.responsavelId, responsavel: usuarios.nome,
      }).from(demandas)
        .innerJoin(clientes, eq(clientes.id, demandas.clienteId))
        .leftJoin(usuarios, eq(usuarios.id, demandas.responsavelId))
        .where(c.length ? and(...c) : undefined)
        .orderBy(asc(demandas.prazoInterno))
        .limit(1000);
    }),

  obter: procedimentoEquipe.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const [d] = await db().select().from(demandas).where(eq(demandas.id, input.id));
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Demanda não encontrada." });
    const [cli] = await db().select({ id: clientes.id, razaoSocial: clientes.razaoSocial, uf: clientes.uf, documento: clientes.documento }).from(clientes).where(eq(clientes.id, d.clienteId));
    const [coment, docs, hist] = await Promise.all([
      db().select({ id: comentarios.id, texto: comentarios.texto, criadoEm: comentarios.criadoEm, usuario: usuarios.nome })
        .from(comentarios).leftJoin(usuarios, eq(usuarios.id, comentarios.usuarioId)).where(eq(comentarios.demandaId, d.id)).orderBy(asc(comentarios.criadoEm)),
      db().select().from(documentos).where(eq(documentos.demandaId, d.id)).orderBy(desc(documentos.criadoEm)),
      db().select({ id: historico.id, resumo: historico.resumo, criadoEm: historico.criadoEm, usuario: usuarios.nome })
        .from(historico).leftJoin(usuarios, eq(usuarios.id, historico.usuarioId))
        .where(and(eq(historico.entidade, "demanda"), eq(historico.entidadeId, d.id))).orderBy(desc(historico.criadoEm)),
    ]);
    return { demanda: d, cliente: cli, comentarios: coment, documentos: docs, historico: hist };
  }),

  criar: procedimentoEquipe
    .input(z.object({
      clienteId: z.number().int().positive("selecione o cliente"),
      tipo: z.enum(TIPOS_DEMANDA),
      origem: z.string().trim().min(2, "informe a origem").max(120),
      titulo: z.string().trim().min(3, "descreva a demanda em poucas palavras").max(255),
      descricao: z.string().max(8000).optional(),
      recebidaEm: dataIso,
      prazoLegal: dataIso.nullable().optional(),
      prazoInterno: dataIso,
      prioridade: z.enum(PRIORIDADES).default("normal"),
      responsavelId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.prazoLegal && input.prazoInterno > input.prazoLegal) throw new TRPCError({ code: "BAD_REQUEST", message: "O prazo interno não pode ser depois do prazo legal." });
      const [cli] = await db().select().from(clientes).where(eq(clientes.id, input.clienteId));
      if (!cli) throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente não encontrado." });
      const [nova] = await db().insert(demandas).values({ ...input, responsavelId: input.responsavelId ?? cli.responsavelId, criadaPorId: ctx.usuario.id }).returning();
      await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "demanda_criada", entidade: "demanda", entidadeId: nova.id, clienteId: cli.id, resumo: `Registrou a demanda "${nova.titulo}" (${nova.origem}) para ${cli.razaoSocial}` });
      return nova;
    }),

  atualizar: procedimentoEquipe
    .input(z.object({
      id: z.number().int(),
      status: z.enum(STATUS_DEMANDA).optional(),
      prioridade: z.enum(PRIORIDADES).optional(),
      responsavelId: z.number().int().positive().nullable().optional(),
      prazoLegal: dataIso.nullable().optional(),
      prazoInterno: dataIso.optional(),
      titulo: z.string().trim().min(3).max(255).optional(),
      descricao: z.string().max(8000).nullable().optional(),
      origem: z.string().trim().min(2).max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [antes] = await db().select().from(demandas).where(eq(demandas.id, id));
      if (!antes) throw new TRPCError({ code: "NOT_FOUND", message: "Demanda não encontrada." });
      const mudancas: Record<string, unknown> = { ...dados };
      if (dados.status === "concluida" || dados.status === "cancelada") mudancas.concluidaEm = new Date();
      else if (dados.status) mudancas.concluidaEm = null;
      const [depois] = await db().update(demandas).set(mudancas).where(eq(demandas.id, id)).returning();
      const dif = diferencas(antes, dados as any);
      if (Object.keys(dif).length) {
        const partes = Object.entries(dif).map(([k, v]) => k === "status" ? `status: ${STATUS_DEMANDA_LABEL[v.de as keyof typeof STATUS_DEMANDA_LABEL]} → ${STATUS_DEMANDA_LABEL[v.para as keyof typeof STATUS_DEMANDA_LABEL]}` : k);
        await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "demanda_alterada", entidade: "demanda", entidadeId: id, clienteId: antes.clienteId, resumo: `"${antes.titulo}" — ${partes.join("; ")}`, detalhes: dif });
      }
      return depois;
    }),

  comentar: procedimentoEquipe.input(z.object({ demandaId: z.number().int(), texto: z.string().trim().min(1).max(8000) })).mutation(async ({ ctx, input }) => {
    const [d] = await db().select().from(demandas).where(eq(demandas.id, input.demandaId));
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Demanda não encontrada." });
    const [c] = await db().insert(comentarios).values({ demandaId: d.id, usuarioId: ctx.usuario.id, texto: input.texto }).returning();
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "demanda_comentario", entidade: "demanda", entidadeId: d.id, clienteId: d.clienteId, resumo: `Comentou em "${d.titulo}"` });
    return c;
  }),
});
