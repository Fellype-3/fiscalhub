import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { feriados, modeloChecklist, regras, tarefas, usuarios } from "../db/schema";
import { procedimentoAdmin, procedimentoEquipe, router } from "../trpc";
import { diferencas, registrar } from "../services/historico";
import { calcularVencimento, criarEhDiaUtil, feriadosNacionais } from "../services/calendario";
import { regraCompleta } from "../services/gerador";
import { AJUSTES, ATIVIDADES, ESFERAS, REGIMES, TIPOS_VENCIMENTO, UFS } from "../../shared/dominio";
import { competenciaEmFechamento } from "../../shared/competencia";

const dadosRegra = z.object({
  nome: z.string().trim().min(2, "informe o nome").max(160),
  esfera: z.enum(ESFERAS),
  regimes: z.array(z.enum(REGIMES)).min(1, "escolha ao menos um regime"),
  ufs: z.array(z.enum(UFS)).default([]),
  municipios: z.array(z.string().trim().min(2).max(120)).default([]),
  atividades: z.array(z.enum(ATIVIDADES)).default([]),
  tipoVencimento: z.enum(TIPOS_VENCIMENTO),
  dia: z.number().int().min(1).max(31).nullable(),
  mesesApos: z.number().int().min(0).max(12),
  ajuste: z.enum(AJUSTES),
  fonteUrl: z.string().trim().url("link da fonte inválido").max(500).nullable().or(z.literal("")),
  fonteNota: z.string().max(2000).nullable().optional(),
  ativa: z.boolean().default(true),
});

export const regrasRouter = router({
  listar: procedimentoEquipe.query(async () => {
    const linhas = await db().select({
      regra: regras, revisadaPor: usuarios.nome,
      tarefas: sql<number>`(select count(*)::int from ${tarefas} t where t.regra_id = ${regras.id})`,
    }).from(regras).leftJoin(usuarios, eq(usuarios.id, regras.revisadaPorId)).orderBy(asc(regras.esfera), asc(regras.nome));
    const comp = competenciaEmFechamento();
    const ehUtil = criarEhDiaUtil([]);
    return linhas.map(l => ({
      ...l.regra, revisadaPor: l.revisadaPor, tarefas: l.tarefas, completa: regraCompleta(l.regra),
      exemplo: { competencia: comp, vencimento: calcularVencimento(l.regra, comp, ehUtil) },
    }));
  }),

  salvar: procedimentoEquipe.input(dadosRegra.extend({ id: z.number().int().optional() })).mutation(async ({ ctx, input }) => {
    const { id, ...dados } = input;
    const valores = { ...dados, fonteUrl: dados.fonteUrl || null, dia: dados.tipoVencimento === "ultimo_dia_util" ? null : dados.dia };
    if (!id) {
      const [nova] = await db().insert(regras).values(valores).returning();
      await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "regra_criada", entidade: "regra", entidadeId: nova.id, resumo: `Criou a regra "${nova.nome}" (aguardando revisão)` });
      return nova;
    }
    const [antes] = await db().select().from(regras).where(eq(regras.id, id));
    if (!antes) throw new TRPCError({ code: "NOT_FOUND", message: "Regra não encontrada." });
    const dif = diferencas(antes, valores as any);
    // Mudou prazo ou abrangência? A revisão do contador volta a ser exigida.
    const camposCriticos = ["tipoVencimento", "dia", "mesesApos", "ajuste", "regimes", "ufs", "municipios", "atividades"];
    const exigeRevisao = Object.keys(dif).some(k => camposCriticos.includes(k));
    const [depois] = await db().update(regras).set({ ...valores, ...(exigeRevisao ? { revisadaEm: null, revisadaPorId: null } : {}) }).where(eq(regras.id, id)).returning();
    if (Object.keys(dif).length) {
      await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "regra_alterada", entidade: "regra", entidadeId: id, resumo: `Alterou a regra "${depois.nome}": ${Object.keys(dif).join(", ")}${exigeRevisao ? " — volta para revisão" : ""}`, detalhes: dif });
    }
    return depois;
  }),

  /** Revisão do contador responsável: só administradores. */
  revisar: procedimentoAdmin.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const [r] = await db().select().from(regras).where(eq(regras.id, input.id));
    if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Regra não encontrada." });
    if (!regraCompleta(r)) throw new TRPCError({ code: "BAD_REQUEST", message: "Complete o vencimento antes de marcar como revisada." });
    if (!r.fonteUrl && !r.fonteNota) throw new TRPCError({ code: "BAD_REQUEST", message: "Registre a fonte oficial (link ou referência) antes de revisar." });
    const [depois] = await db().update(regras).set({ revisadaEm: new Date(), revisadaPorId: ctx.usuario.id }).where(eq(regras.id, r.id)).returning();
    await db().update(tarefas).set({ regraNaoRevisada: false }).where(eq(tarefas.regraId, r.id));
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "regra_revisada", entidade: "regra", entidadeId: r.id, resumo: `Revisou a regra "${r.nome}"` });
    return depois;
  }),

  feriados: procedimentoEquipe.input(z.object({ ano: z.number().int().min(2000).max(2100) })).query(async ({ input }) => {
    const locais = await db().select().from(feriados).orderBy(asc(feriados.data));
    return {
      nacionais: feriadosNacionais(input.ano),
      locais: locais.filter(f => f.data.startsWith(String(input.ano))),
    };
  }),

  salvarFeriado: procedimentoEquipe.input(z.object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
    nome: z.string().trim().min(2).max(120),
    uf: z.enum(UFS).nullable(),
    municipio: z.string().trim().max(120).nullable(),
  })).mutation(async ({ ctx, input }) => {
    if (input.municipio && !input.uf) throw new TRPCError({ code: "BAD_REQUEST", message: "Feriado municipal precisa da UF." });
    const [f] = await db().insert(feriados).values({ ...input, municipio: input.municipio || null }).returning();
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "feriado_criado", entidade: "feriado", entidadeId: f.id, resumo: `Cadastrou o feriado ${f.nome} (${f.data}${f.uf ? ` · ${f.municipio ? f.municipio + "/" : ""}${f.uf}` : ""})` });
    return f;
  }),

  excluirFeriado: procedimentoEquipe.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const [f] = await db().delete(feriados).where(eq(feriados.id, input.id)).returning();
    if (f) await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "feriado_excluido", entidade: "feriado", entidadeId: f.id, resumo: `Excluiu o feriado ${f.nome} (${f.data})` });
    return { ok: true };
  }),

  modeloChecklist: procedimentoEquipe.query(() => db().select().from(modeloChecklist).orderBy(asc(modeloChecklist.ordem))),

  salvarModeloChecklist: procedimentoAdmin.input(z.array(z.object({ id: z.number().int().optional(), texto: z.string().trim().min(2).max(200), ativo: z.boolean() })).max(40))
    .mutation(async ({ ctx, input }) => {
      await db().transaction(async tx => {
        const existentes = await tx.select().from(modeloChecklist);
        const manter = new Set(input.filter(i => i.id).map(i => i.id));
        for (const e of existentes) if (!manter.has(e.id)) await tx.delete(modeloChecklist).where(eq(modeloChecklist.id, e.id));
        for (const [ordem, item] of input.entries()) {
          if (item.id) await tx.update(modeloChecklist).set({ texto: item.texto, ativo: item.ativo, ordem }).where(eq(modeloChecklist.id, item.id));
          else await tx.insert(modeloChecklist).values({ texto: item.texto, ativo: item.ativo, ordem });
        }
      });
      await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "checklist_modelo", entidade: "checklist", resumo: "Atualizou o modelo de checklist de fechamento (vale para as próximas competências)" });
      return { ok: true };
    }),
});
