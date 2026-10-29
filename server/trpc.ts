import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import superjson from "superjson";
import { and, eq, gt } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "./db/client";
import { sessoes, usuarios, type Usuario } from "./db/schema";
import { sha256 } from "./services/seguranca";

export const COOKIE_SESSAO = "fh_sessao";

export type UsuarioSessao = Pick<Usuario, "id" | "nome" | "email" | "papel" | "clienteId" | "trocarSenha" | "totpAtivo">;

export async function usuarioDaRequisicao(req: Request): Promise<UsuarioSessao | null> {
  const token = req.cookies?.[COOKIE_SESSAO];
  if (!token || typeof token !== "string") return null;
  const [linha] = await db()
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, papel: usuarios.papel, clienteId: usuarios.clienteId, trocarSenha: usuarios.trocarSenha, totpAtivo: usuarios.totpAtivo })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .where(and(eq(sessoes.id, sha256(token)), gt(sessoes.expiraEm, new Date()), eq(usuarios.ativo, true)))
    .limit(1);
  return linha ?? null;
}

export function ipDe(req: Request) {
  return (req.ip || req.socket?.remoteAddress || "").slice(0, 64);
}

export async function criarContexto({ req, res }: { req: Request; res: Response }) {
  const usuario = await usuarioDaRequisicao(req);
  return { req, res, usuario, ip: ipDe(req) };
}
export type Contexto = Awaited<ReturnType<typeof criarContexto>>;
export const criarContextoExpress = (o: CreateExpressContextOptions) => criarContexto({ req: o.req as Request, res: o.res as Response });

const t = initTRPC.context<Contexto>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Mensagens de validação em português, sem detalhes internos
    if (error.code === "BAD_REQUEST" && error.cause && "issues" in (error.cause as any)) {
      const primeira = (error.cause as any).issues?.[0];
      return { ...shape, message: primeira?.message ? `Dado inválido: ${primeira.message}` : "Dados inválidos." };
    }
    if (error.code === "INTERNAL_SERVER_ERROR") {
      console.error(error);
      return { ...shape, message: "Erro interno. Tente novamente ou fale com o administrador." };
    }
    return shape;
  },
});

export const router = t.router;
export const procedimentoPublico = t.procedure;
export const criarChamador = t.createCallerFactory;

export const NAO_AUTENTICADO = "Faça login para continuar.";

const exigirLogin = t.middleware(({ ctx, next }) => {
  if (!ctx.usuario) throw new TRPCError({ code: "UNAUTHORIZED", message: NAO_AUTENTICADO });
  return next({ ctx: { ...ctx, usuario: ctx.usuario } });
});

/** Qualquer usuário logado (inclusive com troca de senha pendente). */
export const procedimentoLogado = t.procedure.use(exigirLogin);

const exigirSenhaOk = exigirLogin.unstable_pipe(({ ctx, next }) => {
  if (ctx.usuario.trocarSenha) throw new TRPCError({ code: "FORBIDDEN", message: "Troque sua senha temporária para continuar." });
  return next();
});

/** Equipe interna (administrador ou fiscal). Cliente do portal nunca passa daqui. */
export const procedimentoEquipe = t.procedure.use(exigirSenhaOk).use(({ ctx, next }) => {
  if (ctx.usuario!.papel !== "admin" && ctx.usuario!.papel !== "fiscal") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à equipe do escritório." });
  return next({ ctx: { ...ctx, usuario: ctx.usuario! } });
});

export const procedimentoAdmin = t.procedure.use(exigirSenhaOk).use(({ ctx, next }) => {
  if (ctx.usuario!.papel !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem fazer isso." });
  return next({ ctx: { ...ctx, usuario: ctx.usuario! } });
});

/** Cliente do portal: sempre limitado à própria empresa (usuario.clienteId). */
export const procedimentoCliente = t.procedure.use(exigirSenhaOk).use(({ ctx, next }) => {
  const u = ctx.usuario!;
  if (u.papel !== "cliente" || !u.clienteId) throw new TRPCError({ code: "FORBIDDEN", message: "Área exclusiva do portal do cliente." });
  return next({ ctx: { ...ctx, usuario: u, clienteId: u.clienteId } });
});
