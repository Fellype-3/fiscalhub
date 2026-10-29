/**
 * Preparação do banco.
 *   npm run seed            → cria o primeiro administrador, as regras iniciais e o modelo de checklist
 *   npm run seed:demo       → idem + dados de demonstração (clientes, equipe, tarefas, demandas, documentos)
 *   npm run demo:limpar     → remove tudo que for de demonstração
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { conectar, db, desconectar } from "../db/client";
import { checklist, clientes, comentarios, demandas, documentos, feriados, historico, modeloChecklist, regras, tarefas, usuarios } from "../db/schema";
import { gerarHashSenha, senhaTemporaria, sha256 } from "../services/seguranca";
import { apagarArquivo, salvarArquivo } from "../services/armazenamento";
import { gerarCompetencia } from "../services/gerador";
import { hojeIso, somarDias } from "../services/calendario";
import { analisarXml } from "../services/xml";
import { CHECKLIST_INICIAL, REGRAS_INICIAIS } from "../services/regrasIniciais";
import { calcularDvCnpj } from "../../shared/documento";
import { competenciaEmFechamento, deslocarCompetencia } from "../../shared/competencia";

async function prepararBase() {
  const banco = db();
  const [{ n: nRegras }] = await banco.select({ n: sql<number>`count(*)::int` }).from(regras);
  if (!nRegras) {
    await banco.insert(regras).values(REGRAS_INICIAIS);
    console.log(`✓ ${REGRAS_INICIAIS.length} regras iniciais cadastradas (todas aguardando revisão do contador).`);
  }
  const [{ n: nModelo }] = await banco.select({ n: sql<number>`count(*)::int` }).from(modeloChecklist);
  if (!nModelo) {
    await banco.insert(modeloChecklist).values(CHECKLIST_INICIAL.map((texto, ordem) => ({ texto, ordem })));
    console.log("✓ Modelo de checklist de fechamento criado.");
  }
  const [{ n: nAdmins }] = await banco.select({ n: sql<number>`count(*)::int` }).from(usuarios).where(eq(usuarios.papel, "admin"));
  if (!nAdmins) {
    const email = (process.env.ADMIN_EMAIL || "admin@escritorio.local").toLowerCase();
    const senhaInformada = process.env.ADMIN_PASSWORD;
    const senha = senhaInformada || senhaTemporaria();
    await banco.insert(usuarios).values({ nome: process.env.ADMIN_NAME || "Administrador", email, papel: "admin", senhaHash: await gerarHashSenha(senha), trocarSenha: !senhaInformada });
    console.log(`✓ Administrador criado: ${email}${senhaInformada ? " (senha do .env)" : `  ·  senha temporária: ${senha}  (troque no primeiro acesso)`}`);
  }
}

/* ── Demonstração ─────────────────────────────────────────────────── */
const SENHA_DEMO = "Demo-fiscal-2026";
const cnpjDemo = (n: number) => { const base = `DEMO${String(n).padStart(4, "0")}0001`; return base + calcularDvCnpj(base); };

function nfeFicticia(emitente: string, destinatario: string, numero: number, dataEmissao: string) {
  // Chave de 44 dígitos com DV válido; CNPJ alfanumérico não cabe na chave numérica, então usa zeros + número (claramente fictícia)
  const base43 = `52${dataEmissao.slice(2, 4)}${dataEmissao.slice(5, 7)}${"0".repeat(14)}55001${String(numero).padStart(9, "0")}1${String(numero).padStart(8, "0")}`;
  let soma = 0, peso = 2;
  for (let i = base43.length - 1; i >= 0; i--) { soma += Number(base43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  const chave = base43 + (r < 2 ? 0 : 11 - r);
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe${chave}" versao="4.00">
    <ide><cUF>52</cUF><natOp>VENDA DE MERCADORIA - DOCUMENTO FICTICIO DE DEMONSTRACAO</natOp><mod>55</mod><serie>1</serie><nNF>${numero}</nNF><dhEmi>${dataEmissao}T10:00:00-03:00</dhEmi></ide>
    <emit><CNPJ>${emitente}</CNPJ><xNome>FORNECEDOR FICTICIO DEMONSTRACAO LTDA</xNome></emit>
    <dest><CNPJ>${destinatario}</CNPJ><xNome>CLIENTE DEMONSTRACAO</xNome></dest>
    <total><ICMSTot><vNF>${(1234.5 + numero).toFixed(2)}</vNF></ICMSTot></total>
  </infNFe></NFe>
  <protNFe versao="4.00"><infProt><chNFe>${chave}</chNFe><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e (DEMONSTRACAO)</xMotivo></infProt></protNFe>
</nfeProc>`;
}

async function criarDemo() {
  const banco = db();
  const [{ n }] = await banco.select({ n: sql<number>`count(*)::int` }).from(clientes).where(eq(clientes.demo, true));
  if (n) { console.log("Dados de demonstração já existem. Rode `npm run demo:limpar` para recriar."); return; }

  const [admin] = await banco.select().from(usuarios).where(eq(usuarios.papel, "admin")).limit(1);
  const hash = await gerarHashSenha(SENHA_DEMO);
  const equipe = await banco.insert(usuarios).values([
    { nome: "Marina Barros", email: "marina@demo.fiscalhub", papel: "fiscal", senhaHash: hash, trocarSenha: false, demo: true },
    { nome: "Bruno Freitas", email: "bruno@demo.fiscalhub", papel: "fiscal", senhaHash: hash, trocarSenha: false, demo: true },
    { nome: "Caio Santos", email: "caio@demo.fiscalhub", papel: "fiscal", senhaHash: hash, trocarSenha: false, demo: true },
  ]).returning();
  const [marina, bruno, caio] = equipe;

  const cad: Omit<typeof clientes.$inferInsert, "documento">[] = [
    { razaoSocial: "Norte Logística Ltda.", nomeFantasia: "Norte Log", uf: "GO", municipio: "Goiânia", regime: "presumido", atividades: ["servicos", "comercio"], responsavelId: marina.id, revisorId: admin.id, contatoNome: "Renata (financeiro)", contatoEmail: "financeiro@norte.exemplo" },
    { razaoSocial: "Ativa Comércio de Alimentos Ltda.", nomeFantasia: "Ativa Alimentos", uf: "SP", municipio: "São Paulo", regime: "simples", atividades: ["comercio"], responsavelId: bruno.id, revisorId: marina.id },
    { razaoSocial: "Cerrado Sistemas S.A.", uf: "DF", municipio: "Brasília", regime: "real", atividades: ["servicos"], responsavelId: marina.id, revisorId: admin.id },
    { razaoSocial: "Tocantins Agropecuária Ltda.", uf: "TO", municipio: "Palmas", regime: "presumido", atividades: ["comercio", "industria"], responsavelId: caio.id, revisorId: marina.id },
    { razaoSocial: "Vértice Engenharia Ltda.", uf: "GO", municipio: "Aparecida de Goiânia", regime: "simples", atividades: ["servicos"], responsavelId: caio.id, revisorId: bruno.id },
    { razaoSocial: "Serra Dourada Distribuidora Ltda.", uf: "GO", municipio: "Anápolis", regime: "real", atividades: ["comercio"], responsavelId: bruno.id, revisorId: admin.id },
    { razaoSocial: "Ipê Clínica Odontológica Ltda.", uf: "GO", municipio: "Goiânia", regime: "presumido", atividades: ["servicos"], responsavelId: marina.id, revisorId: bruno.id },
    { razaoSocial: "Araguaia Móveis Ltda.", uf: "TO", municipio: "Araguaína", regime: "simples", atividades: ["industria"], responsavelId: caio.id, revisorId: marina.id },
    { razaoSocial: "Paulo Henrique Souza (MEI)", uf: "GO", municipio: "Goiânia", regime: "mei", atividades: ["servicos"], responsavelId: bruno.id },
  ];
  const lista = await banco.insert(clientes).values(cad.map((c, i) => ({ ...c, documento: cnpjDemo(i + 1), demo: true, observacoes: "Cliente fictício de demonstração." }))).returning();
  const [norte, ativa, cerrado, tocantins, vertice, serra, ipe] = lista;

  await banco.insert(usuarios).values({ nome: "Carla Mendes (Ativa Alimentos)", email: "cliente@demo.fiscalhub", papel: "cliente", clienteId: ativa.id, senhaHash: hash, trocarSenha: false, demo: true });

  const hoje = hojeIso();
  await banco.insert(feriados).values({ data: `${hoje.slice(0, 4)}-10-24`, nome: "Aniversário de Goiânia (exemplo — conferir)", uf: "GO", municipio: "Goiânia" });

  // Competências: a anterior (quase toda entregue) e a em fechamento (em andamento)
  const compAtual = competenciaEmFechamento(new Date(`${hoje}T12:00:00`));
  const compAnterior = deslocarCompetencia(compAtual, -1);
  await gerarCompetencia(compAnterior);
  await gerarCompetencia(compAtual);

  const todas = await banco.select().from(tarefas).where(inArray(tarefas.clienteId, lista.map(c => c.id)));
  let i = 0;
  for (const t of todas) {
    i++;
    let status: typeof t.status = "pendente";
    let entregueEm: Date | null = null;
    if (t.vencimento < hoje) {
      const atrasada = t.competencia === compAtual && i % 9 === 0;
      status = atrasada ? "em_andamento" : "entregue";
      if (!atrasada) entregueEm = new Date(`${somarDias(t.vencimento, i % 7 === 0 ? 1 : -1)}T15:00:00-03:00`);
    } else {
      status = (["em_andamento", "em_revisao", "aguardando_cliente", "pendente", "em_andamento", "pendente"] as const)[i % 6];
    }
    await banco.update(tarefas).set({ status, entregueEm, prioridade: t.vencimento <= somarDias(hoje, 2) ? "alta" : "normal" }).where(eq(tarefas.id, t.id));
  }
  await banco.update(tarefas).set({ status: "aguardando_cliente", observacoes: "Faltam os XML de entrada da 2ª quinzena." })
    .where(and(eq(tarefas.clienteId, ativa.id), eq(tarefas.competencia, compAtual), sql`${tarefas.vencimento} >= ${hoje}`));

  // Rotinas internas (sem prazo legal: prazos internos do escritório)
  const internas = [
    { c: norte, t: "Importação e conferência de XML de entradas", d: 2, s: "em_revisao" as const },
    { c: ativa, t: "Conferência de notas de entrada", d: 0, s: "aguardando_cliente" as const },
    { c: tocantins, t: "Conferência de notas de saída com ST", d: 1, s: "aguardando_cliente" as const },
    { c: serra, t: "Conciliação de créditos de ICMS", d: 4, s: "em_andamento" as const },
    { c: vertice, t: "Fechamento fiscal mensal", d: 6, s: "pendente" as const },
  ];
  for (const r of internas) {
    await banco.insert(tarefas).values({ clienteId: r.c.id, competencia: compAtual, titulo: r.t, vencimento: somarDias(hoje, r.d), status: r.s, prioridade: r.d <= 1 ? "alta" : "normal", responsavelId: r.c.responsavelId, revisorId: r.c.revisorId, observacoes: "Prazo interno do escritório." });
  }

  // Checklist: marca parte dos itens
  const itens = await banco.select().from(checklist).where(and(eq(checklist.competencia, compAtual), inArray(checklist.clienteId, lista.map(c => c.id))));
  for (const [k, item] of itens.entries()) {
    if ((k + item.clienteId) % 3 !== 0) {
      const cli = lista.find(c => c.id === item.clienteId)!;
      await banco.update(checklist).set({ feitoEm: new Date(`${somarDias(hoje, -(k % 5))}T11:00:00-03:00`), feitoPorId: cli.responsavelId }).where(eq(checklist.id, item.id));
    }
  }
  // Competência anterior: checklist completo
  await banco.update(checklist).set({ feitoEm: new Date(`${somarDias(hoje, -25)}T17:00:00-03:00`), feitoPorId: marina.id })
    .where(and(eq(checklist.competencia, compAnterior), isNull(checklist.feitoEm)));

  // Demandas variáveis
  const dem = await banco.insert(demandas).values([
    { clienteId: norte.id, tipo: "notificacao", origem: "SEFAZ-GO", titulo: "Notificação: divergência entre EFD e documentos emitidos", descricao: "Notificação recebida no domicílio tributário eletrônico. Prazo informado na própria notificação.", recebidaEm: somarDias(hoje, -12), prazoLegal: somarDias(hoje, 18), prazoInterno: somarDias(hoje, 8), status: "em_andamento", prioridade: "alta", responsavelId: marina.id, criadaPorId: marina.id },
    { clienteId: cerrado.id, tipo: "certidao", origem: "Cliente", titulo: "Emitir CND federal para participação em licitação", recebidaEm: somarDias(hoje, -2), prazoInterno: somarDias(hoje, 3), status: "nova", prioridade: "alta", responsavelId: marina.id, criadaPorId: admin.id },
    { clienteId: vertice.id, tipo: "parcelamento", origem: "Receita Federal", titulo: "Parcelamento de débitos do Simples Nacional", descricao: "Aguardando o cliente confirmar o número de parcelas.", recebidaEm: somarDias(hoje, -20), prazoInterno: somarDias(hoje, -1), status: "aguardando_cliente", prioridade: "normal", responsavelId: caio.id, criadaPorId: caio.id },
    { clienteId: tocantins.id, tipo: "consulta", origem: "Cliente (WhatsApp)", titulo: "Dúvida sobre nota de remessa para conserto", recebidaEm: somarDias(hoje, -3), prazoInterno: somarDias(hoje, 2), status: "em_andamento", prioridade: "normal", responsavelId: caio.id, criadaPorId: caio.id },
    { clienteId: serra.id, tipo: "retificacao", origem: "Interno", titulo: `Retificar EFD-Reinf ${compAnterior.slice(5)}/${compAnterior.slice(0, 4)}`, recebidaEm: somarDias(hoje, -6), prazoInterno: somarDias(hoje, 5), status: "aguardando_orgao", prioridade: "normal", responsavelId: bruno.id, criadaPorId: bruno.id },
    { clienteId: ipe.id, tipo: "notificacao", origem: "Receita Federal (e-CAC)", titulo: "Intimação: esclarecimentos sobre DCTFWeb", recebidaEm: somarDias(hoje, -1), prazoLegal: somarDias(hoje, 19), prazoInterno: somarDias(hoje, 9), status: "nova", prioridade: "alta", responsavelId: null, criadaPorId: admin.id },
    { clienteId: lista[7].id, tipo: "cadastro", origem: "Interno", titulo: "Onboarding: conferência cadastral e procurações", recebidaEm: somarDias(hoje, -30), prazoInterno: somarDias(hoje, -15), status: "concluida", concluidaEm: new Date(`${somarDias(hoje, -16)}T16:00:00-03:00`), prioridade: "normal", responsavelId: caio.id, criadaPorId: admin.id },
  ]).returning();
  await banco.insert(comentarios).values([
    { demandaId: dem[0].id, usuarioId: marina.id, texto: "Separei as notas citadas. Falta o relatório de saídas do mês para cruzar." },
    { demandaId: dem[0].id, usuarioId: admin.id, texto: "Prioridade: responder antes do prazo interno. Me chame para revisar." },
    { demandaId: dem[2].id, usuarioId: caio.id, texto: "Enviei a simulação ao cliente por e-mail. Aguardando retorno." },
  ]);

  // Documentos: 2 XML fictícios no cliente Ativa + 1 recibo numa tarefa entregue
  for (const [k, cli] of [[1, ativa], [2, ativa]] as const) {
    const xml = Buffer.from(nfeFicticia(cnpjDemo(99), cli.documento, 1000 + k, `${hoje.slice(0, 7)}-0${k + 1}`));
    const info = analisarXml(xml, cli.documento);
    const chave = await salvarArquivo(cli.id, `nfe-demo-${k}.xml`, xml);
    await banco.insert(documentos).values({ clienteId: cli.id, competencia: compAtual, categoria: "xml_nfe", nomeOriginal: `nfe-entrada-demo-${k}.xml`, chaveArmazenamento: chave, tipoMime: "application/xml", tamanho: xml.length, sha256: sha256(xml), infoXml: info.ok ? info.info : null, visivelCliente: true, enviadoPorId: (await banco.select().from(usuarios).where(eq(usuarios.papel, "cliente")))[0].id });
  }
  const [entregue] = await banco.select().from(tarefas).where(and(eq(tarefas.clienteId, norte.id), eq(tarefas.status, "entregue"))).limit(1);
  if (entregue) {
    const recibo = Buffer.from(`RECIBO FICTÍCIO DE DEMONSTRAÇÃO\n${entregue.titulo} — competência ${entregue.competencia}\nNão tem validade.`);
    const chave = await salvarArquivo(norte.id, "recibo-demo.txt", recibo);
    await banco.insert(documentos).values({ clienteId: norte.id, tarefaId: entregue.id, competencia: entregue.competencia, categoria: "recibo", nomeOriginal: `recibo-${entregue.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`, chaveArmazenamento: chave, tipoMime: "text/plain", tamanho: recibo.length, sha256: sha256(recibo), visivelCliente: true, enviadoPorId: marina.id });
  }

  // Guia liberada no portal da Ativa (simulação)
  {
    const [das] = await banco.select().from(tarefas).where(and(eq(tarefas.clienteId, ativa.id), eq(tarefas.competencia, compAtual), eq(tarefas.titulo, "PGDAS-D e DAS (Simples Nacional)")));
    const guia = Buffer.from(`GUIA FICTÍCIA DE DEMONSTRAÇÃO — DAS ${compAtual}\nSem validade para pagamento.`);
    const chave = await salvarArquivo(ativa.id, "guia-das-demo.txt", guia);
    await banco.insert(documentos).values({ clienteId: ativa.id, tarefaId: das?.id ?? null, competencia: compAtual, categoria: "guia", nomeOriginal: `guia-das-${compAtual}-demo.txt`, chaveArmazenamento: chave, tipoMime: "text/plain", tamanho: guia.length, sha256: sha256(guia), visivelCliente: true, enviadoPorId: bruno.id });
  }

  // Um pouco de histórico para o painel
  await banco.insert(historico).values([
    { usuarioId: marina.id, clienteId: norte.id, acao: "tarefa_alterada", entidade: "tarefa", resumo: "Moveu \"Importação e conferência de XML de entradas\" para conferência", criadoEm: new Date(Date.now() - 18 * 60_000) },
    { usuarioId: bruno.id, clienteId: ativa.id, acao: "documentos_enviados", entidade: "documento", resumo: "Cobrou do cliente os XML da 2ª quinzena", criadoEm: new Date(Date.now() - 42 * 60_000) },
    { usuarioId: caio.id, clienteId: lista[7].id, acao: "checklist", entidade: "checklist", resumo: "Concluiu o checklist da competência anterior", criadoEm: new Date(Date.now() - 20 * 3600_000) },
  ]);

  console.log(`✓ Demonstração criada: ${lista.length} clientes fictícios, ${todas.length + internas.length} tarefas, ${dem.length} demandas.`);
  console.log(`  Equipe: marina@demo.fiscalhub, bruno@demo.fiscalhub, caio@demo.fiscalhub · Portal: cliente@demo.fiscalhub`);
  console.log(`  Senha de todos os usuários de demonstração: ${SENHA_DEMO}`);
}

async function limparDemo() {
  const banco = db();
  const cli = await banco.select({ id: clientes.id }).from(clientes).where(eq(clientes.demo, true));
  const ids = cli.map(c => c.id);
  const users = await banco.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.demo, true));
  const uids = users.map(u => u.id);
  if (ids.length) {
    const docs = await banco.select({ chave: documentos.chaveArmazenamento }).from(documentos).where(inArray(documentos.clienteId, ids));
    for (const d of docs) await apagarArquivo(d.chave);
    await banco.delete(usuarios).where(and(eq(usuarios.papel, "cliente"), inArray(usuarios.clienteId, ids)));
    await banco.delete(clientes).where(inArray(clientes.id, ids)); // cascata: tarefas, demandas, documentos, checklist
    await banco.delete(historico).where(inArray(historico.clienteId, ids));
  }
  if (uids.length) {
    for (const tabela of [tarefas, demandas] as const) {
      await banco.update(tabela).set({ responsavelId: null }).where(inArray(tabela.responsavelId, uids));
    }
    await banco.update(tarefas).set({ revisorId: null }).where(inArray(tarefas.revisorId, uids));
    await banco.update(clientes).set({ responsavelId: null }).where(inArray(clientes.responsavelId, uids));
    await banco.update(clientes).set({ revisorId: null }).where(inArray(clientes.revisorId, uids));
    await banco.update(demandas).set({ criadaPorId: null }).where(inArray(demandas.criadaPorId, uids));
    await banco.update(documentos).set({ enviadoPorId: null }).where(inArray(documentos.enviadoPorId, uids));
    await banco.update(checklist).set({ feitoPorId: null }).where(inArray(checklist.feitoPorId, uids));
    await banco.update(regras).set({ revisadaPorId: null }).where(inArray(regras.revisadaPorId, uids));
    await banco.update(comentarios).set({ usuarioId: null }).where(inArray(comentarios.usuarioId, uids));
    await banco.delete(usuarios).where(inArray(usuarios.id, uids));
  }
  await banco.delete(feriados).where(sql`${feriados.nome} like '%(exemplo — conferir)%'`);
  console.log(`✓ Removidos ${ids.length} clientes e ${uids.length} usuários de demonstração.`);
}

async function main() {
  const args = process.argv.slice(2);
  await conectar();
  try {
    if (args.includes("--limpar-demo")) await limparDemo();
    else {
      await prepararBase();
      if (args.includes("--demo")) await criarDemo();
    }
  } finally {
    await desconectar();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
