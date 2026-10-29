import { boolean, date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { AJUSTES, CATEGORIAS_DOC, ESFERAS, PAPEIS, PRIORIDADES, REGIMES, STATUS_DEMANDA, STATUS_TAREFA, TIPOS_DEMANDA, TIPOS_VENCIMENTO } from "../../shared/dominio";

export const papelEnum = pgEnum("papel", PAPEIS);
export const regimeEnum = pgEnum("regime", REGIMES);
export const statusTarefaEnum = pgEnum("status_tarefa", STATUS_TAREFA);
export const prioridadeEnum = pgEnum("prioridade", PRIORIDADES);
export const tipoDemandaEnum = pgEnum("tipo_demanda", TIPOS_DEMANDA);
export const statusDemandaEnum = pgEnum("status_demanda", STATUS_DEMANDA);
export const esferaEnum = pgEnum("esfera", ESFERAS);
export const tipoVencimentoEnum = pgEnum("tipo_vencimento", TIPOS_VENCIMENTO);
export const ajusteEnum = pgEnum("ajuste", AJUSTES);
export const categoriaDocEnum = pgEnum("categoria_doc", CATEGORIAS_DOC);

const criadoEm = () => timestamp("criado_em", { withTimezone: true }).defaultNow().notNull();
const atualizadoEm = () => timestamp("atualizado_em", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());

/* ── Clientes ─────────────────────────────────────────────────────── */
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  razaoSocial: varchar("razao_social", { length: 255 }).notNull(),
  nomeFantasia: varchar("nome_fantasia", { length: 255 }),
  documento: varchar("documento", { length: 14 }).notNull(), // CNPJ (14, pode ser alfanumérico) ou CPF (11), sem pontuação
  inscricaoEstadual: varchar("inscricao_estadual", { length: 30 }),
  inscricaoMunicipal: varchar("inscricao_municipal", { length: 30 }),
  uf: varchar("uf", { length: 2 }).notNull(),
  municipio: varchar("municipio", { length: 120 }).notNull(),
  regime: regimeEnum("regime").notNull(),
  atividades: jsonb("atividades").$type<string[]>().notNull().default([]),
  responsavelId: integer("responsavel_id"),
  revisorId: integer("revisor_id"),
  contatoNome: varchar("contato_nome", { length: 120 }),
  contatoEmail: varchar("contato_email", { length: 255 }),
  contatoTelefone: varchar("contato_telefone", { length: 30 }),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  demo: boolean("demo").notNull().default(false),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
}, t => [uniqueIndex("clientes_documento_uq").on(t.documento)]);

/* ── Usuários e sessões ───────────────────────────────────────────── */
export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  senhaHash: varchar("senha_hash", { length: 100 }).notNull(),
  papel: papelEnum("papel").notNull().default("fiscal"),
  clienteId: integer("cliente_id").references(() => clientes.id), // só para papel "cliente"
  ativo: boolean("ativo").notNull().default(true),
  trocarSenha: boolean("trocar_senha").notNull().default(true),
  totpSegredo: text("totp_segredo"), // criptografado (AES-256-GCM)
  totpAtivo: boolean("totp_ativo").notNull().default(false),
  ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }),
  demo: boolean("demo").notNull().default(false),
  criadoEm: criadoEm(),
}, t => [uniqueIndex("usuarios_email_uq").on(t.email)]);

export const sessoes = pgTable("sessoes", {
  id: varchar("id", { length: 64 }).primaryKey(), // SHA-256 do token; o token em si só fica no cookie
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  ip: varchar("ip", { length: 64 }),
  agente: varchar("agente", { length: 255 }),
  criadoEm: criadoEm(),
});

/* ── Regras de obrigações (gerador de calendário) ─────────────────── */
export const regras = pgTable("regras_obrigacao", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 160 }).notNull(),
  esfera: esferaEnum("esfera").notNull(),
  regimes: jsonb("regimes").$type<string[]>().notNull().default([]),
  ufs: jsonb("ufs").$type<string[]>().notNull().default([]), // vazio = todas
  municipios: jsonb("municipios").$type<string[]>().notNull().default([]), // vazio = todos
  atividades: jsonb("atividades").$type<string[]>().notNull().default([]), // vazio = todas
  tipoVencimento: tipoVencimentoEnum("tipo_vencimento").notNull().default("dia_fixo"),
  dia: integer("dia"), // dia fixo ou N-ésimo dia útil; nulo = regra incompleta
  mesesApos: integer("meses_apos").notNull().default(1), // 1 = mês seguinte à competência
  ajuste: ajusteEnum("ajuste").notNull().default("proximo"),
  fonteUrl: text("fonte_url"),
  fonteNota: text("fonte_nota"),
  revisadaEm: timestamp("revisada_em", { withTimezone: true }),
  revisadaPorId: integer("revisada_por_id").references(() => usuarios.id),
  ativa: boolean("ativa").notNull().default(true),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

/** Exceções por cliente: desliga (ou força) uma regra para uma empresa. */
export const excecoesRegra = pgTable("excecoes_regra", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  regraId: integer("regra_id").notNull().references(() => regras.id, { onDelete: "cascade" }),
  ativa: boolean("ativa").notNull(),
}, t => [uniqueIndex("excecoes_uq").on(t.clienteId, t.regraId)]);

export const feriados = pgTable("feriados", {
  id: serial("id").primaryKey(),
  data: date("data").notNull(),
  nome: varchar("nome", { length: 120 }).notNull(),
  uf: varchar("uf", { length: 2 }), // nulo = vale para todos
  municipio: varchar("municipio", { length: 120 }), // nulo = estadual ou geral
  criadoEm: criadoEm(),
});

/* ── Rotina fixa: obrigações por cliente × competência ───────────── */
export const tarefas = pgTable("tarefas", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  regraId: integer("regra_id").references(() => regras.id, { onDelete: "set null" }),
  competencia: varchar("competencia", { length: 7 }).notNull(), // AAAA-MM
  titulo: varchar("titulo", { length: 255 }).notNull(),
  vencimento: date("vencimento").notNull(),
  status: statusTarefaEnum("status").notNull().default("pendente"),
  prioridade: prioridadeEnum("prioridade").notNull().default("normal"),
  responsavelId: integer("responsavel_id").references(() => usuarios.id),
  revisorId: integer("revisor_id").references(() => usuarios.id),
  regraNaoRevisada: boolean("regra_nao_revisada").notNull().default(false),
  entregueEm: timestamp("entregue_em", { withTimezone: true }),
  observacoes: text("observacoes"),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
}, t => [
  uniqueIndex("tarefas_regra_uq").on(t.clienteId, t.regraId, t.competencia),
  index("tarefas_venc_idx").on(t.vencimento),
  index("tarefas_comp_idx").on(t.competencia),
]);

export const modeloChecklist = pgTable("modelo_checklist", {
  id: serial("id").primaryKey(),
  texto: varchar("texto", { length: 200 }).notNull(),
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
});

export const checklist = pgTable("checklist", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  competencia: varchar("competencia", { length: 7 }).notNull(),
  texto: varchar("texto", { length: 200 }).notNull(),
  ordem: integer("ordem").notNull().default(0),
  feitoPorId: integer("feito_por_id").references(() => usuarios.id),
  feitoEm: timestamp("feito_em", { withTimezone: true }),
}, t => [index("checklist_cli_comp_idx").on(t.clienteId, t.competencia)]);

/* ── Demandas variáveis ───────────────────────────────────────────── */
export const demandas = pgTable("demandas", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  tipo: tipoDemandaEnum("tipo").notNull(),
  origem: varchar("origem", { length: 120 }).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  recebidaEm: date("recebida_em").notNull(),
  prazoLegal: date("prazo_legal"),
  prazoInterno: date("prazo_interno").notNull(),
  status: statusDemandaEnum("status").notNull().default("nova"),
  prioridade: prioridadeEnum("prioridade").notNull().default("normal"),
  responsavelId: integer("responsavel_id").references(() => usuarios.id),
  criadaPorId: integer("criada_por_id").references(() => usuarios.id),
  concluidaEm: timestamp("concluida_em", { withTimezone: true }),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const comentarios = pgTable("comentarios_demanda", {
  id: serial("id").primaryKey(),
  demandaId: integer("demanda_id").notNull().references(() => demandas.id, { onDelete: "cascade" }),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  texto: text("texto").notNull(),
  criadoEm: criadoEm(),
});

/* ── Documentos ───────────────────────────────────────────────────── */
export type InfoXml = {
  tipo: string;
  chave?: string;
  cnpjEmitente?: string;
  cnpjDestinatario?: string;
  emissao?: string;
  valorTotal?: string;
  alertas: string[];
};

export const documentos = pgTable("documentos", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  tarefaId: integer("tarefa_id").references(() => tarefas.id, { onDelete: "set null" }),
  demandaId: integer("demanda_id").references(() => demandas.id, { onDelete: "set null" }),
  competencia: varchar("competencia", { length: 7 }),
  categoria: categoriaDocEnum("categoria").notNull(),
  nomeOriginal: varchar("nome_original", { length: 255 }).notNull(),
  chaveArmazenamento: varchar("chave_armazenamento", { length: 255 }).notNull(),
  tipoMime: varchar("tipo_mime", { length: 120 }),
  tamanho: integer("tamanho").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  infoXml: jsonb("info_xml").$type<InfoXml>(),
  visivelCliente: boolean("visivel_cliente").notNull().default(false),
  enviadoPorId: integer("enviado_por_id").references(() => usuarios.id),
  criadoEm: criadoEm(),
}, t => [index("documentos_cli_idx").on(t.clienteId), index("documentos_sha_idx").on(t.clienteId, t.sha256)]);

/* ── Histórico (auditoria) ────────────────────────────────────────── */
export const historico = pgTable("historico", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id"),
  usuarioId: integer("usuario_id"),
  acao: varchar("acao", { length: 60 }).notNull(),
  entidade: varchar("entidade", { length: 40 }).notNull(),
  entidadeId: integer("entidade_id"),
  resumo: text("resumo").notNull(),
  detalhes: jsonb("detalhes"),
  ip: varchar("ip", { length: 64 }),
  criadoEm: criadoEm(),
}, t => [index("historico_data_idx").on(t.criadoEm), index("historico_cli_idx").on(t.clienteId)]);

export type Cliente = typeof clientes.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Regra = typeof regras.$inferSelect;
export type Tarefa = typeof tarefas.$inferSelect;
export type Demanda = typeof demandas.$inferSelect;
export type Documento = typeof documentos.$inferSelect;
