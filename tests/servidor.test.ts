import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { prepararBanco, sessaoPara } from "./apoio";
import { db, desconectar } from "../server/db/client";
import { excecoesRegra, regras, tarefas } from "../server/db/schema";
import { gerarCompetencia } from "../server/services/gerador";
import { criarApp } from "../server/app";
import { appRouter } from "../server/routers";

let ctx: Awaited<ReturnType<typeof prepararBanco>>;
let servidor: Server;
let base = "";

beforeAll(async () => {
  process.env.DATA_DIR = "./data-teste";
  ctx = await prepararBanco();
  servidor = criarApp().listen(0);
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
afterAll(async () => {
  servidor?.close();
  await desconectar();
  fs.rmSync("./data-teste", { recursive: true, force: true });
});

const chamador = (usuario: any) => appRouter.createCaller({ req: { cookies: {}, headers: {} } as any, res: { cookie() {}, clearCookie() {} } as any, usuario, ip: "127.0.0.1" });

describe("gerador de obrigações", () => {
  it("gera só regras completas e aplicáveis, sem duplicar", async () => {
    const r1 = await gerarCompetencia("2026-09");
    expect(r1.regrasIncompletas.length).toBeGreaterThan(0);
    const nomesA = r1.itens.filter(i => i.cliente === "Empresa A").map(i => i.obrigacao).sort();
    expect(nomesA).toEqual(["DCTFWeb", "EFD-Contribuições", "EFD-Reinf", "PIS/COFINS — DARF"]);
    const nomesB = r1.itens.filter(i => i.cliente === "Empresa B").map(i => i.obrigacao).sort();
    expect(nomesB).toEqual(["DCTFWeb", "PGDAS-D e DAS (Simples Nacional)"]);
    expect(r1.semRevisao).toBe(r1.criadas);
    const r2 = await gerarCompetencia("2026-09");
    expect(r2.criadas).toBe(0);
    expect(r2.jaExistiam).toBe(r1.criadas);
  });
  it("respeita a dispensa de uma obrigação no cliente", async () => {
    const [dctf] = await db().select().from(regras).where(eq(regras.nome, "DCTFWeb"));
    await db().insert(excecoesRegra).values({ clienteId: ctx.b.id, regraId: dctf.id, ativa: false });
    const r = await gerarCompetencia("2026-10", { simular: true });
    expect(r.itens.some(i => i.cliente === "Empresa B" && i.obrigacao === "DCTFWeb")).toBe(false);
  });
  it("revisar a regra limpa o alerta das tarefas", async () => {
    const api = chamador({ id: ctx.admin.id, nome: "Admin", email: "admin@t", papel: "admin", clienteId: null, trocarSenha: false, totpAtivo: false });
    const [reinf] = await db().select().from(regras).where(eq(regras.nome, "EFD-Reinf"));
    await api.regras.revisar({ id: reinf.id });
    const t = await db().select().from(tarefas).where(eq(tarefas.regraId, reinf.id));
    expect(t.every(x => !x.regraNaoRevisada)).toBe(true);
  });
});

describe("isolamento do portal do cliente", () => {
  it("cliente não acessa rotas internas", async () => {
    const api = chamador({ id: ctx.portalA.id, nome: "Portal A", email: "a@t", papel: "cliente", clienteId: ctx.a.id, trocarSenha: false, totpAtivo: false });
    await expect(api.clientes.listar()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.tarefas.listar({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.painel.resumo({ somenteMeus: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const r = await api.portal.resumo();
    expect(r.cliente.razaoSocial).toBe("Empresa A");
  });

  it("cliente só baixa documento da própria empresa e liberado", async () => {
    const tokenAdmin = await sessaoPara(ctx.admin.id);
    const tokenPortal = await sessaoPara(ctx.portalA.id);
    const enviar = async (token: string, clienteId: number, nome: string, visivel: boolean) => {
      const fd = new FormData();
      fd.append("clienteId", String(clienteId));
      fd.append("categoria", "guia");
      fd.append("visivelCliente", String(visivel));
      fd.append("arquivos", new Blob([`conteudo ${nome} ${Math.random()}`]), nome);
      const res = await fetch(`${base}/api/arquivos`, { method: "POST", body: fd, headers: { cookie: `fh_sessao=${token}` } });
      return res.json() as Promise<any>;
    };
    const docB = await enviar(tokenAdmin, ctx.b.id, "guia-b.pdf", true);
    const docAOculto = await enviar(tokenAdmin, ctx.a.id, "interno-a.pdf", false);
    const docALiberado = await enviar(tokenAdmin, ctx.a.id, "guia-a.pdf", true);
    const baixar = (id: number, token: string) => fetch(`${base}/api/arquivos/${id}`, { headers: { cookie: `fh_sessao=${token}` } });

    expect((await baixar(docALiberado.resultados[0].id, tokenPortal)).status).toBe(200);
    expect((await baixar(docB.resultados[0].id, tokenPortal)).status).toBe(404);
    expect((await baixar(docAOculto.resultados[0].id, tokenPortal)).status).toBe(404);
    expect((await baixar(docB.resultados[0].id, tokenAdmin)).status).toBe(200);
    expect((await fetch(`${base}/api/arquivos/${docB.resultados[0].id}`)).status).toBe(401);

    // Cliente tentando enviar para outra empresa: o servidor força a própria empresa
    const forcado = await enviar(tokenPortal, ctx.b.id, "tentativa.pdf", false);
    const api = chamador({ id: ctx.admin.id, nome: "Admin", email: "admin@t", papel: "admin", clienteId: null, trocarSenha: false, totpAtivo: false });
    const docs = await api.documentos.listar({ clienteId: ctx.b.id });
    expect(docs.some(d => d.id === forcado.resultados[0].id)).toBe(false);
  });

  it("bloqueia envio vindo de outro site (CSRF)", async () => {
    const token = await sessaoPara(ctx.admin.id);
    const res = await fetch(`${base}/api/trpc/auth.sair`, { method: "POST", headers: { cookie: `fh_sessao=${token}`, origin: "https://site-malicioso.exemplo", "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(403);
  });
});

describe("cadastro de clientes", () => {
  it("recusa CNPJ inválido e duplicado", async () => {
    const api = chamador({ id: ctx.admin.id, nome: "Admin", email: "admin@t", papel: "admin", clienteId: null, trocarSenha: false, totpAtivo: false });
    await expect(api.clientes.criar({ razaoSocial: "Empresa X", documento: "11.222.333/0001-80", uf: "GO", municipio: "Goiânia", regime: "simples", atividades: [] })).rejects.toThrow(/inválido/);
    await expect(api.clientes.criar({ razaoSocial: "Empresa X", documento: ctx.a.documento.toLowerCase(), uf: "GO", municipio: "Goiânia", regime: "simples", atividades: [] })).rejects.toThrow(/Já existe/);
    const novo = await api.clientes.criar({ razaoSocial: "Nova Alfanumérica", documento: "12.abc.345/01de-35", uf: "GO", municipio: "Goiânia", regime: "simples", atividades: [] });
    expect(novo.documento).toBe("12ABC34501DE35");
  });
});
