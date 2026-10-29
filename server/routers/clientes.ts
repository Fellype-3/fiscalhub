import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { clientes, demandas, documentos, excecoesRegra, historico, regras, tarefas, usuarios } from "../db/schema";
import { procedimentoEquipe, router } from "../trpc";
import { diferencas, registrar } from "../services/historico";
import { regraCompleta, regraSeAplica } from "../services/gerador";
import { hojeIso } from "../services/calendario";
import { formatarDocumento, validarDocumento } from "../../shared/documento";
import { ATIVIDADES, REGIMES, UFS } from "../../shared/dominio";

const dadosCliente = z.object({
  razaoSocial: z.string().trim().min(2, "informe a razão social").max(255),
  nomeFantasia: z.string().trim().max(255).optional().nullable(),
  documento: z.string().trim().min(11, "informe o CNPJ ou CPF").max(20),
  inscricaoEstadual: z.string().trim().max(30).optional().nullable(),
  inscricaoMunicipal: z.string().trim().max(30).optional().nullable(),
  uf: z.enum(UFS, { errorMap: () => ({ message: "UF inválida" }) }),
  municipio: z.string().trim().min(2, "informe o município").max(120),
  regime: z.enum(REGIMES),
  atividades: z.array(z.enum(ATIVIDADES)).default([]),
  responsavelId: z.number().int().positive().optional().nullable(),
  revisorId: z.number().int().positive().optional().nullable(),
  contatoNome: z.string().trim().max(120).optional().nullable(),
  contatoEmail: z.string().trim().email("e-mail de contato inválido").max(255).optional().nullable().or(z.literal("")),
  contatoTelefone: z.string().trim().max(30).optional().nullable(),
  observacoes: z.string().max(4000).optional().nullable(),
});

function normalizarDocumento(valor: string) {
  const r = validarDocumento(valor);
  if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.erro });
  return r.numero;
}

async function garantirDocumentoUnico(documento: string, ignorarId?: number) {
  const [existente] = await db().select({ id: clientes.id, razaoSocial: clientes.razaoSocial }).from(clientes).where(eq(clientes.documento, documento));
  if (existente && existente.id !== ignorarId) {
    throw new TRPCError({ code: "CONFLICT", message: `Já existe um cliente com o documento ${formatarDocumento(documento)}: ${existente.razaoSocial}.` });
  }
}

export const clientesRouter = router({
  listar: procedimentoEquipe
    .input(z.object({ busca: z.string().optional(), uf: z.string().optional(), regime: z.string().optional(), responsavelId: z.number().optional(), incluirInativos: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const f = input ?? {};
      const condicoes = [];
      if (!f.incluirInativos) condicoes.push(eq(clientes.ativo, true));
      if (f.uf) condicoes.push(eq(clientes.uf, f.uf));
      if (f.regime) condicoes.push(eq(clientes.regime, f.regime as any));
      if (f.responsavelId) condicoes.push(eq(clientes.responsavelId, f.responsavelId));
      if (f.busca?.trim()) {
        const termo = `%${f.busca.trim()}%`;
        const soDoc = f.busca.toUpperCase().replace(/[^0-9A-Z]/g, "");
        condicoes.push(or(ilike(clientes.razaoSocial, termo), ilike(clientes.nomeFantasia, termo), ilike(clientes.municipio, termo), soDoc.length >= 3 ? ilike(clientes.documento, `%${soDoc}%`) : sql`false`)!);
      }
      const linhas = await db().select().from(clientes).where(condicoes.length ? and(...condicoes) : undefined).orderBy(asc(clientes.razaoSocial));
      // Pendências abertas por cliente (tarefas vencidas e demandas abertas)
      const abertas = await db().execute(sql`
        select cliente_id as "clienteId",
          count(*) filter (where status not in ('entregue','nao_aplicavel') and vencimento < ${hojeIso()})::int as "vencidas",
          count(*) filter (where status = 'aguardando_cliente')::int as "aguardandoCliente"
        from tarefas group by cliente_id`);
      const mapa = new Map<number, { vencidas: number; aguardandoCliente: number }>();
      for (const r of (abertas as any).rows as any[]) mapa.set(Number(r.clienteId), { vencidas: Number(r.vencidas), aguardandoCliente: Number(r.aguardandoCliente) });
      return linhas.map(c => ({ ...c, pendencias: mapa.get(c.id) ?? { vencidas: 0, aguardandoCliente: 0 } }));
    }),

  obter: procedimentoEquipe.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const [cliente] = await db().select().from(clientes).where(eq(clientes.id, input.id));
    if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
    const todasRegras = await db().select().from(regras).where(eq(regras.ativa, true)).orderBy(asc(regras.esfera), asc(regras.nome));
    const exc = await db().select().from(excecoesRegra).where(eq(excecoesRegra.clienteId, cliente.id));
    const regrasCliente = todasRegras.map(r => {
      const e = exc.find(x => x.regraId === r.id);
      return {
        id: r.id, nome: r.nome, esfera: r.esfera,
        padrao: regraSeAplica(r, cliente), excecao: e ? e.ativa : null,
        aplica: regraSeAplica(r, cliente, e?.ativa), completa: regraCompleta(r), revisada: !!r.revisadaEm,
      };
    });
    const [tarefasCli, demandasCli, docsCli, hist] = await Promise.all([
      db().select().from(tarefas).where(eq(tarefas.clienteId, cliente.id)).orderBy(desc(tarefas.competencia), asc(tarefas.vencimento)).limit(60),
      db().select().from(demandas).where(eq(demandas.clienteId, cliente.id)).orderBy(desc(demandas.criadoEm)).limit(30),
      db().select().from(documentos).where(eq(documentos.clienteId, cliente.id)).orderBy(desc(documentos.criadoEm)).limit(30),
      db().select({ id: historico.id, resumo: historico.resumo, criadoEm: historico.criadoEm, usuario: usuarios.nome })
        .from(historico).leftJoin(usuarios, eq(usuarios.id, historico.usuarioId))
        .where(eq(historico.clienteId, cliente.id)).orderBy(desc(historico.criadoEm)).limit(30),
    ]);
    return { cliente, regras: regrasCliente, tarefas: tarefasCli, demandas: demandasCli, documentos: docsCli, historico: hist };
  }),

  criar: procedimentoEquipe.input(dadosCliente).mutation(async ({ ctx, input }) => {
    const documento = normalizarDocumento(input.documento);
    await garantirDocumentoUnico(documento);
    const [novo] = await db().insert(clientes).values({ ...input, documento, contatoEmail: input.contatoEmail || null }).returning();
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "cliente_criado", entidade: "cliente", entidadeId: novo.id, clienteId: novo.id, resumo: `Cadastrou ${novo.razaoSocial} (${formatarDocumento(documento)})` });
    return novo;
  }),

  atualizar: procedimentoEquipe.input(dadosCliente.partial().extend({ id: z.number().int(), ativo: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const { id, ...dados } = input;
    const [antes] = await db().select().from(clientes).where(eq(clientes.id, id));
    if (!antes) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
    const mudancas: Record<string, unknown> = { ...dados };
    if (dados.documento !== undefined) {
      mudancas.documento = normalizarDocumento(dados.documento);
      await garantirDocumentoUnico(mudancas.documento as string, id);
    }
    if (dados.contatoEmail === "") mudancas.contatoEmail = null;
    const [depois] = await db().update(clientes).set(mudancas).where(eq(clientes.id, id)).returning();
    const dif = diferencas(antes, mudancas as any);
    if (Object.keys(dif).length) {
      await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "cliente_alterado", entidade: "cliente", entidadeId: id, clienteId: id, resumo: `Alterou o cadastro de ${depois.razaoSocial}: ${Object.keys(dif).join(", ")}`, detalhes: dif });
    }
    return depois;
  }),

  /** Liga/desliga uma obrigação para um cliente específico (null = volta ao padrão da regra). */
  definirRegra: procedimentoEquipe.input(z.object({ clienteId: z.number().int(), regraId: z.number().int(), ativa: z.boolean().nullable() })).mutation(async ({ ctx, input }) => {
    if (input.ativa === null) {
      await db().delete(excecoesRegra).where(and(eq(excecoesRegra.clienteId, input.clienteId), eq(excecoesRegra.regraId, input.regraId)));
    } else {
      await db().insert(excecoesRegra).values(input as { clienteId: number; regraId: number; ativa: boolean })
        .onConflictDoUpdate({ target: [excecoesRegra.clienteId, excecoesRegra.regraId], set: { ativa: input.ativa } });
    }
    const [r] = await db().select({ nome: regras.nome }).from(regras).where(eq(regras.id, input.regraId));
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "obrigacao_cliente", entidade: "cliente", entidadeId: input.clienteId, clienteId: input.clienteId, resumo: `${input.ativa === null ? "Voltou ao padrão" : input.ativa ? "Incluiu" : "Dispensou"} a obrigação ${r?.nome ?? input.regraId}` });
    return { ok: true };
  }),
});
