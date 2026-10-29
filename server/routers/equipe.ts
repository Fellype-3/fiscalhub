import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { inicioDoDia, somarDias } from "../services/calendario";
import { db } from "../db/client";
import { clientes, historico, sessoes, usuarios } from "../db/schema";
import { procedimentoAdmin, procedimentoEquipe, router } from "../trpc";
import { registrar } from "../services/historico";
import { gerarHashSenha, senhaTemporaria } from "../services/seguranca";
import { PAPEIS, PAPEL_LABEL } from "../../shared/dominio";

const camposPublicos = {
  id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, clienteId: usuarios.clienteId,
  ativo: usuarios.ativo, totpAtivo: usuarios.totpAtivo, trocarSenha: usuarios.trocarSenha, ultimoAcesso: usuarios.ultimoAcesso, criadoEm: usuarios.criadoEm,
};

export const equipeRouter = router({
  /** Lista curta para seletores de responsável/revisor. */
  pessoas: procedimentoEquipe.query(() =>
    db().select({ id: usuarios.id, nome: usuarios.nome, papel: usuarios.papel }).from(usuarios)
      .where(and(eq(usuarios.ativo, true), sql`${usuarios.papel} in ('admin','fiscal')`)).orderBy(asc(usuarios.nome))),

  listar: procedimentoAdmin.query(async () => {
    const lista = await db().select({ ...camposPublicos, cliente: clientes.razaoSocial }).from(usuarios).leftJoin(clientes, eq(clientes.id, usuarios.clienteId)).orderBy(asc(usuarios.papel), asc(usuarios.nome));
    return lista;
  }),

  criar: procedimentoAdmin.input(z.object({
    nome: z.string().trim().min(2, "informe o nome").max(120),
    email: z.string().trim().toLowerCase().email("e-mail inválido").max(255),
    papel: z.enum(PAPEIS),
    clienteId: z.number().int().positive().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (input.papel === "cliente" && !input.clienteId) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário do portal precisa estar ligado a um cliente." });
    const [existe] = await db().select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, input.email));
    if (existe) throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este e-mail." });
    const senha = senhaTemporaria();
    const [novo] = await db().insert(usuarios).values({
      nome: input.nome, email: input.email, papel: input.papel, clienteId: input.papel === "cliente" ? input.clienteId : null,
      senhaHash: await gerarHashSenha(senha), trocarSenha: true,
    }).returning(camposPublicos);
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "usuario_criado", entidade: "usuario", entidadeId: novo.id, clienteId: novo.clienteId, resumo: `Criou o acesso de ${novo.nome} (${PAPEL_LABEL[novo.papel]})` });
    return { usuario: novo, senhaTemporaria: senha };
  }),

  atualizar: procedimentoAdmin.input(z.object({
    id: z.number().int(),
    nome: z.string().trim().min(2).max(120).optional(),
    papel: z.enum(PAPEIS).optional(),
    ativo: z.boolean().optional(),
    clienteId: z.number().int().positive().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...dados } = input;
    if (id === ctx.usuario.id && (dados.ativo === false || (dados.papel && dados.papel !== "admin"))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode desativar nem rebaixar o próprio acesso." });
    }
    const [antes] = await db().select().from(usuarios).where(eq(usuarios.id, id));
    if (!antes) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    const papel = dados.papel ?? antes.papel;
    const clienteId = dados.clienteId !== undefined ? dados.clienteId : antes.clienteId;
    if (papel === "cliente" && !clienteId) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário do portal precisa estar ligado a um cliente." });
    const [depois] = await db().update(usuarios).set({ ...dados, clienteId: papel === "cliente" ? clienteId : null }).where(eq(usuarios.id, id)).returning(camposPublicos);
    if (dados.ativo === false) await db().delete(sessoes).where(eq(sessoes.usuarioId, id));
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "usuario_alterado", entidade: "usuario", entidadeId: id, resumo: `Alterou o acesso de ${depois.nome}${dados.ativo === false ? " (desativado)" : dados.ativo ? " (reativado)" : ""}` });
    return depois;
  }),

  redefinirSenha: procedimentoAdmin.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const senha = senhaTemporaria();
    const [u] = await db().update(usuarios).set({ senhaHash: await gerarHashSenha(senha), trocarSenha: true }).where(eq(usuarios.id, input.id)).returning({ nome: usuarios.nome });
    if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    await db().delete(sessoes).where(eq(sessoes.usuarioId, input.id));
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "senha_redefinida", entidade: "usuario", entidadeId: input.id, resumo: `Redefiniu a senha de ${u.nome}` });
    return { senhaTemporaria: senha };
  }),

  zerar2fa: procedimentoAdmin.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const [u] = await db().update(usuarios).set({ totpAtivo: false, totpSegredo: null }).where(eq(usuarios.id, input.id)).returning({ nome: usuarios.nome });
    if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    await registrar({ usuarioId: ctx.usuario.id, ip: ctx.ip }, { acao: "2fa_zerado", entidade: "usuario", entidadeId: input.id, resumo: `Removeu a verificação em duas etapas de ${u.nome} (celular perdido/trocado)` });
    return { ok: true };
  }),

  historico: procedimentoEquipe.input(z.object({
    clienteId: z.number().optional(), usuarioId: z.number().optional(), entidade: z.string().optional(), entidadeId: z.number().optional(),
    de: z.string().optional(), ate: z.string().optional(), pagina: z.number().int().min(0).default(0),
  })).query(async ({ ctx, input }) => {
    const c = [];
    if (input.clienteId) c.push(eq(historico.clienteId, input.clienteId));
    if (input.usuarioId) c.push(eq(historico.usuarioId, input.usuarioId));
    if (input.entidade) c.push(eq(historico.entidade, input.entidade));
    if (input.entidadeId) c.push(eq(historico.entidadeId, input.entidadeId));
    if (input.de) c.push(gte(historico.criadoEm, inicioDoDia(input.de)));
    if (input.ate) c.push(lt(historico.criadoEm, inicioDoDia(somarDias(input.ate, 1))));
    // Tentativas de login e dados de IP só para administradores
    if (ctx.usuario.papel !== "admin") c.push(sql`${historico.acao} not in ('login','login_falhou')`);
    const tamanho = 50;
    const linhas = await db().select({
      id: historico.id, acao: historico.acao, entidade: historico.entidade, entidadeId: historico.entidadeId, resumo: historico.resumo,
      criadoEm: historico.criadoEm, ip: historico.ip, usuario: usuarios.nome, cliente: clientes.razaoSocial, clienteId: historico.clienteId,
    }).from(historico)
      .leftJoin(usuarios, eq(usuarios.id, historico.usuarioId))
      .leftJoin(clientes, eq(clientes.id, historico.clienteId))
      .where(c.length ? and(...c) : undefined)
      .orderBy(desc(historico.criadoEm), desc(historico.id))
      .limit(tamanho + 1).offset(input.pagina * tamanho);
    return {
      linhas: linhas.slice(0, tamanho).map(l => (ctx.usuario.papel === "admin" ? l : { ...l, ip: null })),
      temMais: linhas.length > tamanho,
    };
  }),
});
