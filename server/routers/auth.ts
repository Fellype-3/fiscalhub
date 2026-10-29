import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "../db/client";
import { sessoes, usuarios } from "../db/schema";
import { ENV } from "../env";
import { COOKIE_SESSAO, procedimentoLogado, procedimentoPublico, router } from "../trpc";
import { registrar } from "../services/historico";
import {
  bloqueadoPorTentativas, conferirSenha, conferirTotp, criptografar, descriptografar, gerarHashSenha,
  limparFalhas, novoSegredoTotp, novoToken, politicaSenha, registrarFalha, sha256, totpUri,
} from "../services/seguranca";

const GENERICO = "E-mail ou senha incorretos.";
// Hash fictício: mantém o tempo de resposta igual quando o e-mail não existe
let hashFicticio: Promise<string> | null = null;
const obterHashFicticio = () => (hashFicticio ??= gerarHashSenha(novoToken()));

export const authRouter = router({
  eu: procedimentoPublico.query(({ ctx }) => ctx.usuario),

  entrar: procedimentoPublico
    .input(z.object({ email: z.string().email("e-mail inválido").max(255), senha: z.string().min(1).max(200), codigo: z.string().max(10).optional() }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();
      const chaveLimite = `${ctx.ip}|${email}`;
      if (bloqueadoPorTentativas(chaveLimite)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde 15 minutos e tente novamente." });
      }
      const [u] = await db().select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
      const senhaOk = u ? await conferirSenha(input.senha, u.senhaHash) : (await conferirSenha(input.senha, await obterHashFicticio()), false);
      if (!u || !u.ativo || !senhaOk) {
        registrarFalha(chaveLimite);
        await registrar({ usuarioId: u?.id, ip: ctx.ip }, { acao: "login_falhou", entidade: "usuario", entidadeId: u?.id, resumo: `Tentativa de login sem sucesso para ${email}` });
        throw new TRPCError({ code: "UNAUTHORIZED", message: GENERICO });
      }
      if (u.totpAtivo && u.totpSegredo) {
        if (!input.codigo) return { precisaCodigo: true as const };
        if (!conferirTotp(descriptografar(u.totpSegredo), input.codigo)) {
          registrarFalha(chaveLimite);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Código de verificação inválido." });
        }
      }
      limparFalhas(chaveLimite);
      const token = novoToken();
      const expiraEm = new Date(Date.now() + ENV.sessaoHoras * 3600_000);
      await db().insert(sessoes).values({ id: sha256(token), usuarioId: u.id, expiraEm, ip: ctx.ip, agente: String(ctx.req.headers["user-agent"] ?? "").slice(0, 255) });
      await db().update(usuarios).set({ ultimoAcesso: new Date() }).where(eq(usuarios.id, u.id));
      ctx.res.cookie(COOKIE_SESSAO, token, { httpOnly: true, sameSite: "lax", secure: ENV.producao, expires: expiraEm, path: "/" });
      await registrar({ usuarioId: u.id, ip: ctx.ip }, { acao: "login", entidade: "usuario", entidadeId: u.id, resumo: `${u.nome} entrou no sistema` });
      return { precisaCodigo: false as const, papel: u.papel, trocarSenha: u.trocarSenha };
    }),

  sair: procedimentoPublico.mutation(async ({ ctx }) => {
    const token = ctx.req.cookies?.[COOKIE_SESSAO];
    if (token) await db().delete(sessoes).where(eq(sessoes.id, sha256(String(token))));
    ctx.res.clearCookie(COOKIE_SESSAO, { path: "/" });
    return { ok: true };
  }),

  trocarSenha: procedimentoLogado
    .input(z.object({ atual: z.string().min(1), nova: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const [u] = await db().select().from(usuarios).where(eq(usuarios.id, ctx.usuario.id));
      if (!(await conferirSenha(input.atual, u.senhaHash))) throw new TRPCError({ code: "BAD_REQUEST", message: "Senha atual incorreta." });
      const problema = politicaSenha(input.nova);
      if (problema) throw new TRPCError({ code: "BAD_REQUEST", message: problema });
      if (input.nova === input.atual) throw new TRPCError({ code: "BAD_REQUEST", message: "A nova senha precisa ser diferente da atual." });
      await db().update(usuarios).set({ senhaHash: await gerarHashSenha(input.nova), trocarSenha: false }).where(eq(usuarios.id, u.id));
      // Encerra as outras sessões do usuário
      const atual = sha256(String(ctx.req.cookies?.[COOKIE_SESSAO] ?? ""));
      await db().delete(sessoes).where(and(eq(sessoes.usuarioId, u.id), ne(sessoes.id, atual)));
      await registrar({ usuarioId: u.id, ip: ctx.ip }, { acao: "senha_alterada", entidade: "usuario", entidadeId: u.id, resumo: `${u.nome} alterou a própria senha` });
      return { ok: true };
    }),

  iniciar2fa: procedimentoLogado.mutation(async ({ ctx }) => {
    const segredo = novoSegredoTotp();
    await db().update(usuarios).set({ totpSegredo: criptografar(segredo), totpAtivo: false }).where(eq(usuarios.id, ctx.usuario.id));
    const uri = totpUri(segredo, ctx.usuario.email);
    return { segredo, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }),

  ativar2fa: procedimentoLogado.input(z.object({ codigo: z.string().min(6).max(10) })).mutation(async ({ ctx, input }) => {
    const [u] = await db().select().from(usuarios).where(eq(usuarios.id, ctx.usuario.id));
    if (!u.totpSegredo || !conferirTotp(descriptografar(u.totpSegredo), input.codigo)) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido. Confira o horário do celular e tente de novo." });
    await db().update(usuarios).set({ totpAtivo: true }).where(eq(usuarios.id, u.id));
    await registrar({ usuarioId: u.id, ip: ctx.ip }, { acao: "2fa_ativado", entidade: "usuario", entidadeId: u.id, resumo: `${u.nome} ativou a verificação em duas etapas` });
    return { ok: true };
  }),

  desativar2fa: procedimentoLogado.input(z.object({ senha: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const [u] = await db().select().from(usuarios).where(eq(usuarios.id, ctx.usuario.id));
    if (!(await conferirSenha(input.senha, u.senhaHash))) throw new TRPCError({ code: "BAD_REQUEST", message: "Senha incorreta." });
    await db().update(usuarios).set({ totpAtivo: false, totpSegredo: null }).where(eq(usuarios.id, u.id));
    await registrar({ usuarioId: u.id, ip: ctx.ip }, { acao: "2fa_desativado", entidade: "usuario", entidadeId: u.id, resumo: `${u.nome} desativou a verificação em duas etapas` });
    return { ok: true };
  }),
});
