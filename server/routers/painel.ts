import { z } from "zod";
import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { clientes, demandas, documentos, historico, regras, tarefas, usuarios } from "../db/schema";
import { procedimentoEquipe, router } from "../trpc";
import { dataLocal, diferencaDias, hojeIso, inicioDoDia, somarDias } from "../services/calendario";
import { competenciaEmFechamento, competenciaValida } from "../../shared/competencia";
import { STATUS_DEMANDA_ABERTOS, STATUS_TAREFA_ABERTOS } from "../../shared/dominio";

export const painelRouter = router({
  info: procedimentoEquipe.query(async () => {
    const [r] = await db().select({ demo: sql<number>`count(*) filter (where ${clientes.demo})::int` }).from(clientes);
    return { demo: (r?.demo ?? 0) > 0 };
  }),

  resumo: procedimentoEquipe
    .input(z.object({ competencia: z.string().refine(competenciaValida).optional(), somenteMeus: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const hoje = hojeIso();
      const competencia = input.competencia ?? competenciaEmFechamento(new Date(`${hoje}T12:00:00`));
      const meu = input.somenteMeus ? ctx.usuario.id : null;

      const listaClientes = await db().select({ id: clientes.id, uf: clientes.uf, razaoSocial: clientes.razaoSocial, responsavelId: clientes.responsavelId }).from(clientes).where(eq(clientes.ativo, true));
      const clientesFiltrados = meu ? listaClientes.filter(c => c.responsavelId === meu) : listaClientes;

      const tarefasComp = await db().select({ id: tarefas.id, clienteId: tarefas.clienteId, status: tarefas.status, vencimento: tarefas.vencimento, entregueEm: tarefas.entregueEm, responsavelId: tarefas.responsavelId })
        .from(tarefas).where(and(eq(tarefas.competencia, competencia), meu ? eq(tarefas.responsavelId, meu) : undefined));
      const validas = tarefasComp.filter(t => t.status !== "nao_aplicavel");
      const entregues = validas.filter(t => t.status === "entregue");
      const noPrazo = entregues.filter(t => t.entregueEm && dataLocal(t.entregueEm) <= t.vencimento);

      // Todas as tarefas abertas (qualquer competência) — base do radar e dos alertas
      const abertas = await db().select({
        id: tarefas.id, titulo: tarefas.titulo, competencia: tarefas.competencia, vencimento: tarefas.vencimento, status: tarefas.status,
        prioridade: tarefas.prioridade, regraNaoRevisada: tarefas.regraNaoRevisada, responsavelId: tarefas.responsavelId,
        clienteId: clientes.id, cliente: clientes.razaoSocial, uf: clientes.uf, responsavel: usuarios.nome,
      }).from(tarefas)
        .innerJoin(clientes, eq(clientes.id, tarefas.clienteId))
        .leftJoin(usuarios, eq(usuarios.id, tarefas.responsavelId))
        .where(and(inArray(tarefas.status, STATUS_TAREFA_ABERTOS), meu ? eq(tarefas.responsavelId, meu) : undefined));

      const demandasAbertas = await db().select({
        id: demandas.id, titulo: demandas.titulo, tipo: demandas.tipo, origem: demandas.origem, status: demandas.status, prioridade: demandas.prioridade,
        recebidaEm: demandas.recebidaEm, prazoLegal: demandas.prazoLegal, prazoInterno: demandas.prazoInterno, responsavelId: demandas.responsavelId,
        clienteId: clientes.id, cliente: clientes.razaoSocial, uf: clientes.uf, responsavel: usuarios.nome,
      }).from(demandas)
        .innerJoin(clientes, eq(clientes.id, demandas.clienteId))
        .leftJoin(usuarios, eq(usuarios.id, demandas.responsavelId))
        .where(and(inArray(demandas.status, STATUS_DEMANDA_ABERTOS), meu ? eq(demandas.responsavelId, meu) : undefined));

      const d5 = somarDias(hoje, 5);
      const tarefasVencidas = abertas.filter(t => t.vencimento < hoje);
      const tarefasHoje = abertas.filter(t => t.vencimento === hoje);
      const tarefasD5 = abertas.filter(t => t.vencimento > hoje && t.vencimento <= d5);
      const aguardandoCliente = abertas.filter(t => t.status === "aguardando_cliente");

      // Demanda em alerta: passou da metade do prazo legal (ou interno) sem conclusão
      const alertaDemanda = (d: (typeof demandasAbertas)[number]) => {
        const limite = d.prazoLegal ?? d.prazoInterno;
        const total = Math.max(1, diferencaDias(d.recebidaEm, limite));
        return diferencaDias(d.recebidaEm, hoje) >= total / 2;
      };
      const demandasVencidas = demandasAbertas.filter(d => d.prazoInterno < hoje);
      const demandasAlerta = demandasAbertas.filter(d => d.prazoInterno >= hoje && alertaDemanda(d));

      const limiteRadar = somarDias(hoje, 7);
      const radar = [
        ...abertas.filter(t => t.vencimento <= limiteRadar).map(t => ({ origem: "tarefa" as const, id: t.id, titulo: t.titulo, cliente: t.cliente, clienteId: t.clienteId, uf: t.uf, data: t.vencimento, status: t.status as string, prioridade: t.prioridade, responsavel: t.responsavel, competencia: t.competencia, alerta: t.regraNaoRevisada })),
        ...demandasAbertas.filter(d => d.prazoInterno <= limiteRadar || alertaDemanda(d)).map(d => ({ origem: "demanda" as const, id: d.id, titulo: d.titulo, cliente: d.cliente, clienteId: d.clienteId, uf: d.uf, data: d.prazoInterno, status: d.status as string, prioridade: d.prioridade, responsavel: d.responsavel, competencia: null, alerta: alertaDemanda(d) })),
      ].sort((a, b) => a.data.localeCompare(b.data) || (a.prioridade === "alta" ? -1 : 1)).slice(0, 14);

      // Cobertura por UF (competência atual)
      const ufDe = new Map(listaClientes.map(c => [c.id, c.uf]));
      const porUfMapa = new Map<string, { uf: string; clientes: number; total: number; entregues: number }>();
      for (const c of clientesFiltrados) {
        const r = porUfMapa.get(c.uf) ?? { uf: c.uf, clientes: 0, total: 0, entregues: 0 };
        r.clientes++;
        porUfMapa.set(c.uf, r);
      }
      for (const t of validas) {
        const uf = ufDe.get(t.clienteId);
        if (!uf) continue;
        const r = porUfMapa.get(uf) ?? { uf, clientes: 0, total: 0, entregues: 0 };
        r.total++;
        if (t.status === "entregue") r.entregues++;
        porUfMapa.set(uf, r);
      }
      const porUf = [...porUfMapa.values()].sort((a, b) => b.clientes - a.clientes);

      // Carga por pessoa
      const pessoas = await db().select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(and(eq(usuarios.ativo, true), notInArray(usuarios.papel, ["cliente"])));
      const porPessoa = pessoas.map(p => ({
        id: p.id, nome: p.nome,
        abertas: abertas.filter(t => t.responsavelId === p.id).length,
        vencidas: tarefasVencidas.filter(t => t.responsavelId === p.id).length + demandasVencidas.filter(d => d.responsavelId === p.id).length,
        demandas: demandasAbertas.filter(d => d.responsavelId === p.id).length,
      })).filter(p => p.abertas || p.demandas || !meu).sort((a, b) => b.abertas + b.demandas - (a.abertas + a.demandas));
      const semResponsavel = abertas.filter(t => !t.responsavelId).length + demandasAbertas.filter(d => !d.responsavelId).length;

      const atividade = await db().select({ id: historico.id, resumo: historico.resumo, criadoEm: historico.criadoEm, usuario: usuarios.nome, clienteId: historico.clienteId })
        .from(historico).leftJoin(usuarios, eq(usuarios.id, historico.usuarioId))
        .where(sql`${historico.acao} not in ('login','login_falhou')`)
        .orderBy(desc(historico.criadoEm)).limit(8);

      const [regrasPend] = await db().select({
        semRevisao: sql<number>`count(*) filter (where ${regras.revisadaEm} is null)::int`,
        incompletas: sql<number>`count(*) filter (where ${regras.tipoVencimento} <> 'ultimo_dia_util' and ${regras.dia} is null)::int`,
      }).from(regras).where(eq(regras.ativa, true));

      const [docsHoje] = await db().select({ n: sql<number>`count(*)::int` }).from(documentos).where(gte(documentos.criadoEm, inicioDoDia(hoje)));

      return {
        hoje, competencia,
        fechamento: { total: validas.length, entregues: entregues.length, noPrazo: noPrazo.length, abertas: validas.length - entregues.length, clientes: new Set(validas.map(t => t.clienteId)).size },
        alertas: {
          tarefasVencidas: tarefasVencidas.length, tarefasHoje: tarefasHoje.length, tarefasD5: tarefasD5.length,
          aguardandoCliente: aguardandoCliente.length, clientesAguardando: new Set(aguardandoCliente.map(t => t.clienteId)).size,
          demandasAbertas: demandasAbertas.length, demandasVencidas: demandasVencidas.length, demandasAlerta: demandasAlerta.length,
          semResponsavel, docsHoje: docsHoje?.n ?? 0,
        },
        radar, porUf, porPessoa, atividade,
        regras: { semRevisao: regrasPend?.semRevisao ?? 0, incompletas: regrasPend?.incompletas ?? 0 },
        totalClientes: clientesFiltrados.length,
        competenciaGerada: tarefasComp.length > 0,
      };
    }),
});
