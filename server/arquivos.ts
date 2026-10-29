/** Rotas HTTP de envio e download de arquivos (multipart não passa pelo tRPC). */
import express, { type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { clientes, demandas, documentos, tarefas } from "./db/schema";
import { ENV } from "./env";
import { ipDe, usuarioDaRequisicao } from "./trpc";
import { registrar } from "./services/historico";
import { lerArquivo, salvarArquivo } from "./services/armazenamento";
import { analisarXml } from "./services/xml";
import { sha256 } from "./services/seguranca";
import { CATEGORIAS_DOC, CATEGORIA_DOC_LABEL, type CategoriaDoc } from "../shared/dominio";
import { competenciaParaExibicao, competenciaValida } from "../shared/competencia";

const EXTENSOES = new Set([".xml", ".pdf", ".png", ".jpg", ".jpeg", ".txt", ".csv", ".xlsx", ".xls", ".docx", ".doc", ".zip", ".ofx"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ENV.maxUploadMb * 1024 * 1024, files: 50 },
});

export const rotasArquivos = express.Router();

rotasArquivos.post("/api/arquivos", (req, res, next) => {
  upload.array("arquivos", 50)(req, res, err => {
    if (err) return res.status(400).json({ erro: err.code === "LIMIT_FILE_SIZE" ? `Arquivo maior que ${ENV.maxUploadMb} MB.` : "Falha ao receber os arquivos." });
    next();
  });
}, async (req: Request, res: Response) => {
  const usuario = await usuarioDaRequisicao(req);
  if (!usuario || usuario.trocarSenha) return res.status(401).json({ erro: "Faça login para enviar arquivos." });
  const ehCliente = usuario.papel === "cliente";
  const arquivos = (req.files as Express.Multer.File[]) ?? [];
  if (!arquivos.length) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

  const clienteId = ehCliente ? usuario.clienteId! : Number(req.body.clienteId);
  const [cliente] = clienteId ? await db().select().from(clientes).where(eq(clientes.id, clienteId)) : [];
  if (!cliente) return res.status(400).json({ erro: "Selecione o cliente." });

  const competencia = req.body.competencia && competenciaValida(req.body.competencia) ? String(req.body.competencia) : null;
  let categoria = (CATEGORIAS_DOC as readonly string[]).includes(req.body.categoria) ? (req.body.categoria as CategoriaDoc) : null;
  if (ehCliente && categoria && !["xml_nfe", "xml_cte", "xml_nfse", "xml_outro", "outro"].includes(categoria)) categoria = "outro";

  // Vínculos opcionais: precisam ser do mesmo cliente
  let tarefaId: number | null = null;
  let demandaId: number | null = null;
  if (req.body.tarefaId) {
    const [t] = await db().select({ id: tarefas.id }).from(tarefas).where(and(eq(tarefas.id, Number(req.body.tarefaId)), eq(tarefas.clienteId, cliente.id)));
    if (!t) return res.status(400).json({ erro: "Tarefa não pertence a este cliente." });
    tarefaId = t.id;
  }
  if (req.body.demandaId && !ehCliente) {
    const [d] = await db().select({ id: demandas.id }).from(demandas).where(and(eq(demandas.id, Number(req.body.demandaId)), eq(demandas.clienteId, cliente.id)));
    if (!d) return res.status(400).json({ erro: "Demanda não pertence a este cliente." });
    demandaId = d.id;
  }
  const visivelCliente = ehCliente ? true : req.body.visivelCliente === "true";

  const resultados: { nome: string; ok: boolean; mensagem: string; alertas?: string[]; id?: number }[] = [];
  for (const arq of arquivos) {
    const nome = Buffer.from(arq.originalname, "latin1").toString("utf8").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 200);
    const ext = path.extname(nome).toLowerCase();
    if (!EXTENSOES.has(ext)) { resultados.push({ nome, ok: false, mensagem: `Tipo de arquivo não aceito (${ext || "sem extensão"}).` }); continue; }
    const hash = sha256(arq.buffer);
    const [dup] = await db().select({ id: documentos.id, criadoEm: documentos.criadoEm }).from(documentos).where(and(eq(documentos.clienteId, cliente.id), eq(documentos.sha256, hash)));
    if (dup) { resultados.push({ nome, ok: false, mensagem: `Arquivo idêntico já enviado em ${dup.criadoEm.toLocaleDateString("pt-BR")}.` }); continue; }

    let cat: CategoriaDoc = categoria ?? "outro";
    let infoXml = null;
    if (ext === ".xml") {
      const r = analisarXml(arq.buffer, cliente.documento);
      if (!r.ok) { resultados.push({ nome, ok: false, mensagem: r.erro }); continue; }
      infoXml = r.info;
      if (!categoria || categoria.startsWith("xml")) cat = r.categoria;
    }
    const chave = await salvarArquivo(cliente.id, nome, arq.buffer);
    const [doc] = await db().insert(documentos).values({
      clienteId: cliente.id, tarefaId, demandaId, competencia, categoria: cat, nomeOriginal: nome, chaveArmazenamento: chave,
      tipoMime: arq.mimetype?.slice(0, 120) ?? null, tamanho: arq.size, sha256: hash, infoXml, visivelCliente, enviadoPorId: usuario.id,
    }).returning({ id: documentos.id });
    resultados.push({ nome, ok: true, mensagem: infoXml ? `${infoXml.tipo} recebido` : `${CATEGORIA_DOC_LABEL[cat]} recebido`, alertas: infoXml?.alertas, id: doc.id });
  }

  const enviados = resultados.filter(r => r.ok).length;
  if (enviados) {
    await registrar({ usuarioId: usuario.id, ip: ipDe(req) }, {
      acao: "documentos_enviados", entidade: tarefaId ? "tarefa" : demandaId ? "demanda" : "documento", entidadeId: tarefaId ?? demandaId,
      clienteId: cliente.id, resumo: `${ehCliente ? "Cliente enviou" : "Anexou"} ${enviados} arquivo(s) em ${cliente.razaoSocial}${competencia ? ` · ${competenciaParaExibicao(competencia)}` : ""}`,
    });
  }
  res.json({ enviados, resultados });
});

rotasArquivos.get("/api/arquivos/:id", async (req: Request, res: Response) => {
  const usuario = await usuarioDaRequisicao(req);
  if (!usuario || usuario.trocarSenha) return res.status(401).send("Faça login para baixar arquivos.");
  const [doc] = await db().select().from(documentos).where(eq(documentos.id, Number(req.params.id)));
  if (!doc) return res.status(404).send("Documento não encontrado.");
  if (usuario.papel === "cliente") {
    const permitido = doc.clienteId === usuario.clienteId && (doc.visivelCliente || doc.enviadoPorId === usuario.id);
    if (!permitido) {
      await registrar({ usuarioId: usuario.id, ip: ipDe(req) }, { acao: "acesso_negado", entidade: "documento", entidadeId: doc.id, clienteId: usuario.clienteId, resumo: `Tentativa de baixar documento de outra empresa ou não liberado (#${doc.id})` });
      return res.status(404).send("Documento não encontrado.");
    }
  } else if (usuario.papel !== "admin" && usuario.papel !== "fiscal") {
    return res.status(403).send("Sem permissão.");
  }
  const conteudo = await lerArquivo(doc.chaveArmazenamento);
  if (sha256(conteudo) !== doc.sha256) console.error(`[arquivos] hash divergente no documento ${doc.id}`);
  await registrar({ usuarioId: usuario.id, ip: ipDe(req) }, { acao: "documento_baixado", entidade: "documento", entidadeId: doc.id, clienteId: doc.clienteId, resumo: `Baixou ${doc.nomeOriginal}` });
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(doc.nomeOriginal)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(conteudo);
});
