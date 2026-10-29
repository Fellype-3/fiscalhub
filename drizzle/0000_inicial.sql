CREATE TYPE "public"."ajuste" AS ENUM('proximo', 'anterior', 'nenhum');--> statement-breakpoint
CREATE TYPE "public"."categoria_doc" AS ENUM('xml_nfe', 'xml_cte', 'xml_nfse', 'xml_outro', 'guia', 'recibo', 'notificacao', 'certidao', 'outro');--> statement-breakpoint
CREATE TYPE "public"."esfera" AS ENUM('federal', 'estadual', 'municipal');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('admin', 'fiscal', 'cliente');--> statement-breakpoint
CREATE TYPE "public"."prioridade" AS ENUM('baixa', 'normal', 'alta');--> statement-breakpoint
CREATE TYPE "public"."regime" AS ENUM('simples', 'presumido', 'real', 'mei');--> statement-breakpoint
CREATE TYPE "public"."status_demanda" AS ENUM('nova', 'em_andamento', 'aguardando_cliente', 'aguardando_orgao', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_tarefa" AS ENUM('pendente', 'aguardando_cliente', 'em_andamento', 'em_revisao', 'entregue', 'nao_aplicavel');--> statement-breakpoint
CREATE TYPE "public"."tipo_demanda" AS ENUM('notificacao', 'certidao', 'parcelamento', 'consulta', 'retificacao', 'cadastro', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_vencimento" AS ENUM('dia_fixo', 'dia_util_n', 'ultimo_dia_util');--> statement-breakpoint
CREATE TABLE "checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"texto" varchar(200) NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"feito_por_id" integer,
	"feito_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"razao_social" varchar(255) NOT NULL,
	"nome_fantasia" varchar(255),
	"documento" varchar(14) NOT NULL,
	"inscricao_estadual" varchar(30),
	"inscricao_municipal" varchar(30),
	"uf" varchar(2) NOT NULL,
	"municipio" varchar(120) NOT NULL,
	"regime" "regime" NOT NULL,
	"atividades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"responsavel_id" integer,
	"revisor_id" integer,
	"contato_nome" varchar(120),
	"contato_email" varchar(255),
	"contato_telefone" varchar(30),
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comentarios_demanda" (
	"id" serial PRIMARY KEY NOT NULL,
	"demanda_id" integer NOT NULL,
	"usuario_id" integer,
	"texto" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demandas" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"tipo" "tipo_demanda" NOT NULL,
	"origem" varchar(120) NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text,
	"recebida_em" date NOT NULL,
	"prazo_legal" date,
	"prazo_interno" date NOT NULL,
	"status" "status_demanda" DEFAULT 'nova' NOT NULL,
	"prioridade" "prioridade" DEFAULT 'normal' NOT NULL,
	"responsavel_id" integer,
	"criada_por_id" integer,
	"concluida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"tarefa_id" integer,
	"demanda_id" integer,
	"competencia" varchar(7),
	"categoria" "categoria_doc" NOT NULL,
	"nome_original" varchar(255) NOT NULL,
	"chave_armazenamento" varchar(255) NOT NULL,
	"tipo_mime" varchar(120),
	"tamanho" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"info_xml" jsonb,
	"visivel_cliente" boolean DEFAULT false NOT NULL,
	"enviado_por_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "excecoes_regra" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"regra_id" integer NOT NULL,
	"ativa" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feriados" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"nome" varchar(120) NOT NULL,
	"uf" varchar(2),
	"municipio" varchar(120),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer,
	"usuario_id" integer,
	"acao" varchar(60) NOT NULL,
	"entidade" varchar(40) NOT NULL,
	"entidade_id" integer,
	"resumo" text NOT NULL,
	"detalhes" jsonb,
	"ip" varchar(64),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modelo_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"texto" varchar(200) NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regras_obrigacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(160) NOT NULL,
	"esfera" "esfera" NOT NULL,
	"regimes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ufs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"municipios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"atividades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tipo_vencimento" "tipo_vencimento" DEFAULT 'dia_fixo' NOT NULL,
	"dia" integer,
	"meses_apos" integer DEFAULT 1 NOT NULL,
	"ajuste" "ajuste" DEFAULT 'proximo' NOT NULL,
	"fonte_url" text,
	"fonte_nota" text,
	"revisada_em" timestamp with time zone,
	"revisada_por_id" integer,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"ip" varchar(64),
	"agente" varchar(255),
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarefas" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"regra_id" integer,
	"competencia" varchar(7) NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"vencimento" date NOT NULL,
	"status" "status_tarefa" DEFAULT 'pendente' NOT NULL,
	"prioridade" "prioridade" DEFAULT 'normal' NOT NULL,
	"responsavel_id" integer,
	"revisor_id" integer,
	"regra_nao_revisada" boolean DEFAULT false NOT NULL,
	"entregue_em" timestamp with time zone,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"senha_hash" varchar(100) NOT NULL,
	"papel" "papel" DEFAULT 'fiscal' NOT NULL,
	"cliente_id" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"trocar_senha" boolean DEFAULT true NOT NULL,
	"totp_segredo" text,
	"totp_ativo" boolean DEFAULT false NOT NULL,
	"ultimo_acesso" timestamp with time zone,
	"demo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist" ADD CONSTRAINT "checklist_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist" ADD CONSTRAINT "checklist_feito_por_id_usuarios_id_fk" FOREIGN KEY ("feito_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios_demanda" ADD CONSTRAINT "comentarios_demanda_demanda_id_demandas_id_fk" FOREIGN KEY ("demanda_id") REFERENCES "public"."demandas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios_demanda" ADD CONSTRAINT "comentarios_demanda_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_criada_por_id_usuarios_id_fk" FOREIGN KEY ("criada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tarefa_id_tarefas_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_demanda_id_demandas_id_fk" FOREIGN KEY ("demanda_id") REFERENCES "public"."demandas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_enviado_por_id_usuarios_id_fk" FOREIGN KEY ("enviado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excecoes_regra" ADD CONSTRAINT "excecoes_regra_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excecoes_regra" ADD CONSTRAINT "excecoes_regra_regra_id_regras_obrigacao_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regras_obrigacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_obrigacao" ADD CONSTRAINT "regras_obrigacao_revisada_por_id_usuarios_id_fk" FOREIGN KEY ("revisada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_regra_id_regras_obrigacao_id_fk" FOREIGN KEY ("regra_id") REFERENCES "public"."regras_obrigacao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_revisor_id_usuarios_id_fk" FOREIGN KEY ("revisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_cli_comp_idx" ON "checklist" USING btree ("cliente_id","competencia");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_documento_uq" ON "clientes" USING btree ("documento");--> statement-breakpoint
CREATE INDEX "documentos_cli_idx" ON "documentos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "documentos_sha_idx" ON "documentos" USING btree ("cliente_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "excecoes_uq" ON "excecoes_regra" USING btree ("cliente_id","regra_id");--> statement-breakpoint
CREATE INDEX "historico_data_idx" ON "historico" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "historico_cli_idx" ON "historico" USING btree ("cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tarefas_regra_uq" ON "tarefas" USING btree ("cliente_id","regra_id","competencia");--> statement-breakpoint
CREATE INDEX "tarefas_venc_idx" ON "tarefas" USING btree ("vencimento");--> statement-breakpoint
CREATE INDEX "tarefas_comp_idx" ON "tarefas" USING btree ("competencia");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_uq" ON "usuarios" USING btree ("email");