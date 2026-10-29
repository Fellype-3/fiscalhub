import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { checklist, clientes, documentos, tarefas, usuarios } from "../db/schema";
import { procedimentoEquipe, router } from "../trpc";
import { diferencas, registrar } from "../services/historico";
import { gerarCompetencia } from "../services/gerador";
import { competenciaParaExibicao, competenciaValida } from "../../shared/competencia";
import { PRIORIDADES, STATUS_TAREFA, STATUS_TAREFA_ABERTOS, STATUS_TAREFA_LABEL } from "../../shared/dominio";

const competencia = z.string().refine(competenciaValida, "competência inválida (use MM/AAAA)");
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");

const responsavel = alias(usuarios, "responsavel");
const revisor = alias(usuarios, "revisor");

function consultaTarefas(where: SQL | undefined) {
  return db()
    .select({
      id: tarefas.id, titulo: tarefas.titulo, competencia: tarefas.competencia, vencimento: tarefas.vencimento,
      status: tarefas.status, prioridade: tarefas.prioridade, regraId: tarefas.regraId, regraNaoRevisada: tarefas.regraNaoRevisada,
      observacoes: tarefas.observacoes, entregueEm: tarefas.entregueEm, atualizadoEm: tarefas.atualizadoEm,
      clienteId: clientes.id, cliente: clientes.razaoSocial, uf: clientes.uf, municipio: clientes.municipio, regime: clientes.regime,
      responsavelId: tarefas.responsavelId, responsavel: responsavel.nome,
      revisorId: tarefas.revisorId, revisor: revisor.nome,
      anexos: sql<number>`(select count(*)::int from ${documentos} d where d.tarefa_id = ${tarefas.id})`,
    })
    .from(tarefas)
    .innerJoin(clientes, eq(clientes.id, tarefas.clienteId))
    .leftJoin(responsavel, eq(responsavel.id, tarefas.responsavelId))
    .leftJoin(revisor, eq(revisor.id, tarefas.revisorId))
    .where(where)
    .orderBy(asc(tarefas.vencimento), asc(clientes.razaoSocial))
    .$dynamic();
}

export const tarefasRouter = router({
  obter: procedimentoEquipe.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const [t] = await consultaTarefas(eq(tarefas.id, input.id));
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
    return t;
  }),

  listar: procedimentoEquipe
    .input(z.object({
      competencia: competencia.optional(),
      status: z.array(z.enum(STATUS_TAREFA)).optional(),
      somenteAbertas: z.boolean().optional(),
      responsavelId: z.number().optional(),
      clienteId: z.number().optional(),
      uf: z.string().optional(),
      vencimentoAte: dataIso.optional(),
      vencimentoDe: dataIso.optional(),
    }))
    .query(async ({ input }) => {
      const c = [];
      if (input.competencia) c.push(eq(tarefas.competencia, input.competencia));
      if (input.status?.length) c.push(inArray(tarefas.status, input.status));
      if (input.somenteAbertas) c.push(inArray(tarefas.status, STATUS_TAREFA_ABERTOS));
      if (input.responsavelId) c.push(eq(tarefas.responsavelId, input.responsavelId));
      if (input.clienteId) c.push(eq(tarefas.clienteId, input.clienteId));
      if (input.uf) c.push(eq(clientes.uf, input.uf));
      if (input.vencimentoAte) c.push(lte(tarefas.vencimento, input.vencimentoAte));
      if (input.vencimentoDe) c.push(gte(tarefas.vencimento, input.vencimentoDe));
      return consultaTarefas(c.length ? and(...c) : undefined).limit(2000);
    }),

  criar: procedimentoEquipe
    .input(z.object({
      clienteId: z.number().int().positive("selecione o cliente"),
      titulo: z.string().trim().min(2, "informe o nome da tarefa").max(255),
      competencia,
      vencimento: dataIso,
      prioridade: z.enum(PRIORIDADES).default("normal"),
      responsavelId: z.number().int().positive().nullable().optional(),
      revisorId: z.number().int().positive().nullable().optional(),
      observacoes: z.string().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [cli] = await db().select().from(clientes).where(eq(clientes.id, input.clienteId));
      if (!cli) throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente não encontrado." });
      const [nova] = await db().insert(tarefas).values({
        ...input,
        responsavelId: input.responsavelId === undefined ? cli.responsavelId : input.responsavelId,
        revisorId: input.revisorId === undefined ? cli.revisorId : input.revisorId,
      }).returning();
      await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "tarefa_criada", entidade: "tarefa", entidadeId: nova.id, clienteId: cli.id, resumo: `Criou "${nova.titulo}" (${competenciaParaExibicao(nova.competencia)}) para ${cli.razaoSocial}` });
      return nova;
    }),

  atualizar: procedimentoEquipe
    .input(z.object({
      id: z.number().int(),
      status: z.enum(STATUS_TAREFA).optional(),
      prioridade: z.enum(PRIORIDADES).optional(),
      responsavelId: z.number().int().positive().nullable().optional(),
      revisorId: z.number().int().positive().nullable().optional(),
      vencimento: dataIso.optional(),
      observacoes: z.string().max(4000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [antes] = await db().select().from(tarefas).where(eq(tarefas.id, id));
      if (!antes) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
      const mudancas: Record<string, unknown> = { ...dados };
      if (dados.status === "entregue" && antes.status !== "entregue") mudancas.entregueEm = new Date();
      if (dados.status && dados.status !== "entregue") mudancas.entregueEm = null;
      const [depois] = await db().update(tarefas).set(mudancas).where(eq(tarefas.id, id)).returning();
      const dif = diferencas(antes, dados as any);
      if (Object.keys(dif).length) {
        const partes = Object.entries(dif).map(([campo, v]) =>
          campo === "status" ? `status: ${STATUS_TAREFA_LABEL[v.de as keyof typeof STATUS_TAREFA_LABEL]} → ${STATUS_TAREFA_LABEL[v.para as keyof typeof STATUS_TAREFA_LABEL]}` : campo);
        await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "tarefa_alterada", entidade: "tarefa", entidadeId: id, clienteId: antes.clienteId, resumo: `"${antes.titulo}" ${competenciaParaExibicao(antes.competencia)} — ${partes.join("; ")}`, detalhes: dif });
      }
      let aviso: string | null = null;
      if (dados.status === "entregue") {
        const [recibos] = await db().select({ n: sql<number>`count(*)::int` }).from(documentos).where(and(eq(documentos.tarefaId, id), eq(documentos.categoria, "recibo")));
        if (!recibos?.n) aviso = "Marcada como entregue, mas sem recibo anexado. Anexe o recibo de transmissão.";
      }
      return { tarefa: depois, aviso };
    }),

  excluir: procedimentoEquipe.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const [t] = await db().select().from(tarefas).where(eq(tarefas.id, input.id));
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada." });
    if (t.regraId) throw new TRPCError({ code: "BAD_REQUEST", message: "Tarefas geradas por regra não são excluídas: marque como \"Não se aplica\" ou dispense a obrigação no cadastro do cliente." });
    await db().delete(tarefas).where(eq(tarefas.id, input.id));
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "tarefa_excluida", entidade: "tarefa", entidadeId: t.id, clienteId: t.clienteId, resumo: `Excluiu a tarefa "${t.titulo}" (${competenciaParaExibicao(t.competencia)})` });
    return { ok: true };
  }),

  gerar: procedimentoEquipe
    .input(z.object({ competencia, clienteId: z.number().int().optional(), simular: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const r = await gerarCompetencia(input.competencia, { clienteId: input.clienteId, simular: input.simular });
      if (!input.simular && (r.criadas || r.checklistsCriados)) {
        await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "competencia_gerada", entidade: "competencia", clienteId: input.clienteId ?? null, resumo: `Gerou a competência ${competenciaParaExibicao(input.competencia)}: ${r.criadas} obrigações e ${r.checklistsCriados} checklists`, detalhes: { criadas: r.criadas, semRevisao: r.semRevisao } });
      }
      return r;
    }),

  checklist: procedimentoEquipe.input(z.object({ clienteId: z.number().int(), competencia })).query(async ({ input }) => {
    return db().select({ id: checklist.id, texto: checklist.texto, ordem: checklist.ordem, feitoEm: checklist.feitoEm, feitoPor: usuarios.nome })
      .from(checklist).leftJoin(usuarios, eq(usuarios.id, checklist.feitoPorId))
      .where(and(eq(checklist.clienteId, input.clienteId), eq(checklist.competencia, input.competencia)))
      .orderBy(asc(checklist.ordem), asc(checklist.id));
  }),

  resumoChecklist: procedimentoEquipe.input(z.object({ competencia })).query(async ({ input }) => {
    const linhas = await db().select({
      clienteId: checklist.clienteId,
      total: sql<number>`count(*)::int`,
      feitos: sql<number>`count(${checklist.feitoEm})::int`,
    }).from(checklist).where(eq(checklist.competencia, input.competencia)).groupBy(checklist.clienteId);
    return linhas;
  }),

  marcarChecklist: procedimentoEquipe.input(z.object({ id: z.number().int(), feito: z.boolean() })).mutation(async ({ ctx, input }) => {
    const [item] = await db().update(checklist)
      .set(input.feito ? { feitoEm: new Date(), feitoPorId: ctx.usuario.id } : { feitoEm: null, feitoPorId: null })
      .where(eq(checklist.id, input.id)).returning();
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado." });
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "checklist", entidade: "checklist", entidadeId: item.id, clienteId: item.clienteId, resumo: `${input.feito ? "Marcou" : "Desmarcou"} "${item.texto}" (${competenciaParaExibicao(item.competencia)})` });
    return item;
  }),
});
