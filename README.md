# FiscalHub — controle da rotina fiscal

Sistema web para o departamento fiscal do escritório. Ele cuida de três frentes:

- **Rotina fixa:** obrigações por cliente × competência, geradas a partir de regras de prazo.
- **Demandas variáveis:** notificações, certidões, parcelamentos e consultas, com dono e prazo.
- **Portal do cliente:** canal para o cliente enviar XML e baixar guias e recibos.

Esta versão é independente do Manus. Ela roda em qualquer servidor com Node.js ou Docker, usa PostgreSQL e guarda os arquivos no próprio servidor.

---

## 1. O que mudou em relação ao protótipo

| No protótipo (Manus) | Agora |
|---|---|
| Painel com números fixos no código (78%, 18 tarefas, data "quarta") | Todos os números vêm do banco e do dia atual |
| Cadastro gravava no banco, mas sumia da tela ao recarregar | As telas leem e gravam no banco |
| Login Manus OAuth: qualquer conta Manus entrava | Login próprio (e-mail e senha). Só entra quem o administrador cadastrar. Há verificação em duas etapas opcional (app autenticador) |
| Todos apareciam como "Administrador" | Três perfis: **Administrador**, **Equipe fiscal** e **Cliente (portal)** |
| CNPJ conferido só pelo tamanho; com e sem pontuação viravam empresas diferentes | CNPJ e CPF validados pelos dígitos verificadores, inclusive o **CNPJ alfanumérico**. O documento é gravado sem pontuação e não aceita duplicata |
| Cada tarefa digitada à mão | **Gerador de calendário**: cria as obrigações do mês por regime, UF, município e atividade, sem duplicar |
| Tarefa podia apontar para cliente inexistente; vencimento exibido fixo em "10 nov" | Vínculos com chave estrangeira; o vencimento é o real |
| Clientes, Tarefas e Documentos eram telas "em configuração" | Telas completas, mais Demandas, Regras, Equipe, Histórico, Minha conta e Portal |
| Tabelas de documentos e histórico existiam, mas sem uso | Upload com conferência de XML, download com registro e histórico de toda alteração |
| Armazenamento e banco do Manus | Arquivos em disco local e PostgreSQL (ou banco embutido) |
| Fontes do Google Fonts e textos de 9–10 px | Fontes servidas pelo próprio sistema (sem envio de IP ao Google) e textos de 12 px ou mais, com contraste revisado |

## 2. Telas

| Tela | Para quê | Quem usa |
|---|---|---|
| **Painel** | % do fechamento entregue (e no prazo), vencidas, aguardando cliente, demandas, radar dos próximos 7 dias, cobertura por UF, carga por pessoa, atividade recente | Equipe e sócio |
| **Obrigações do mês** | Lista e matriz cliente × obrigação por competência, checklist de fechamento, detalhe com status, responsável, revisor, recibo e histórico. Botão **Gerar obrigações** com prévia | Equipe |
| **Demandas** | Quadro (kanban) e lista; prazo legal × prazo interno; alerta de metade do prazo; andamento, anexos e histórico | Equipe |
| **Clientes** | Cadastro (regime, UF, município, atividades, IE/IM, responsável, revisor, contato). No detalhe: obrigações, calendário do cliente (dispensar ou incluir obrigação), demandas, documentos e histórico | Equipe |
| **Documentos** | Envio em lote, leitura de XML (tipo, chave, emitente, valor, alertas), liberação no portal, download registrado | Equipe |
| **Regras e prazos** | Regras de vencimento com fonte oficial e revisão do contador; feriados; modelo de checklist | Equipe; revisão só pelo administrador |
| **Equipe e acessos** | Criar acessos (senha temporária), desativar, redefinir senha, remover a verificação em duas etapas | Administrador |
| **Histórico** | Quem fez o quê e quando, com filtros. IP e tentativas de login aparecem só para o administrador | Equipe |
| **Portal do cliente** | O que o escritório está aguardando, envio de XML e documentos por competência, guias e recibos liberados | Cliente |

## 3. Como rodar

### 3.0 Testar via GitHub Codespaces (sem instalar nada)

No repositório no GitHub: **Code → Codespaces → Create codespace on main**. O `.devcontainer` instala as dependências, cria o `.env` e semeia os dados de demonstração automaticamente; o servidor de desenvolvimento sobe sozinho e o Codespaces abre a porta `5173` no navegador. Login de demonstração: veja a seção 3.1.

### 3.1 Testar no seu computador (sem instalar banco)

Precisa do Node.js 20.19 ou mais novo.

```bash
npm install
npm run seed:demo        # cria admin, regras, checklist e dados de demonstração
npm run build
npm start                # http://localhost:3000
```

Usuários de demonstração (senha `Demo-fiscal-2026`):

- Equipe: `marina@demo.fiscalhub`, `bruno@demo.fiscalhub`, `caio@demo.fiscalhub`
- Portal: `cliente@demo.fiscalhub`

O administrador real é criado com os dados de `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`. Sem senha definida, o comando mostra uma senha temporária, que deve ser trocada no primeiro acesso.

Sem `DATABASE_URL`, o sistema usa um PostgreSQL embutido (PGlite) na pasta `data/`. Isso serve para testar e para escritórios pequenos com um único servidor.

Para desenvolver com recarga automática: `npm run dev` (abre em http://localhost:5173).

### 3.2 Produção com Docker (VPS)

```bash
cp .env.example .env     # preencha ENCRYPTION_KEY, POSTGRES_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL
docker compose up -d
docker compose exec app node dist/seed.js
```

Coloque um proxy com **HTTPS** na frente (Caddy, Nginx ou o painel da hospedagem). O sistema já envia cabeçalhos de segurança e cookies `Secure` em produção.

### 3.3 Hospedagem gerenciada

Funciona em qualquer serviço que rode Node 20+ ou Dockerfile e tenha disco persistente para a pasta `DATA_DIR`. Exemplos: Railway, Render, Fly.io e DigitalOcean App Platform.

- Banco: PostgreSQL gerenciado, como Neon, Supabase ou o do próprio provedor.
- Comando de build: `npm ci && npm run build`. Comando de start: `node dist/server.js`. Na primeira vez, rode `node dist/seed.js`.
- **Atenção:** os arquivos enviados ficam em `DATA_DIR`. Sem disco persistente, eles se perdem a cada nova publicação. Se o provedor não oferecer disco, a próxima versão precisa de armazenamento S3 (veja o ROADMAP).

### 3.4 Limpar a demonstração

```bash
npm run demo:limpar      # ou: docker compose exec app node dist/seed.js --limpar-demo
```

O comando remove só o que é de demonstração: clientes e usuários fictícios e os arquivos deles.

## 4. Primeiro mês de uso

1. **Administrador:** entra, troca a senha e ativa a verificação em duas etapas (Minha conta).
2. **Contador responsável** (em Regras e prazos):
   - confere cada regra federal na fonte oficial e clica em **Marcar revisada**;
   - preenche o dia das regras estaduais e municipais (uma regra por UF ou município quando os prazos diferem);
   - cadastra os feriados estaduais e municipais dos clientes.
3. **Equipe:** cadastra os clientes com regime, UF, município, atividades, responsável e revisor.
4. Em **Obrigações do mês**, clique em **Gerar obrigações**, confira a prévia e confirme.
5. No dia a dia:
   - mude o status de cada obrigação;
   - anexe o recibo ao entregar (o sistema avisa se não houver recibo);
   - marque o checklist de fechamento.
6. Toda notificação, pedido de certidão ou consulta entra em **Demandas** no mesmo dia, com prazo interno antes do prazo legal (o sistema sugere a metade do prazo).
7. Crie acessos de portal para os clientes que mais atrasam documentos (Equipe e acessos › perfil Cliente).

Rotina sugerida:

| Quando | O quê | Quem |
|---|---|---|
| Dia 1 a 3 do mês | Gerar a competência anterior e marcar "Aguardando cliente" onde faltar documento | Coordenação |
| Diariamente | Painel → radar de prazos; triagem de Demandas novas | Cada responsável |
| Ao transmitir | Status "Entregue" + recibo anexado | Responsável |
| Fechamento | Checklist completo; revisor confere | Revisor |
| Mensal | Teste de restauração do backup; revisão de regras alteradas | Administrador |

## 5. Segurança e LGPD

- **Senhas:** hash bcrypt (custo 12), no mínimo 10 caracteres com letras e números. Login bloqueado após 5 tentativas em 15 minutos.
- **Duas etapas:** verificação por app autenticador (TOTP), com o segredo criptografado (AES-256-GCM) usando `ENCRYPTION_KEY`.
- **Sessão:** cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. O banco guarda só o hash do token. A sessão expira em 12 horas (configurável).
- **Proteções do servidor:** contra requisições de outros sites (verificação de origem), cabeçalhos de segurança (Helmet/CSP) e bloqueio de XML com DOCTYPE/ENTITY (XXE).
- **Isolamento do portal:** o servidor força a empresa do usuário em toda consulta, envio e download. Há **testes automatizados** para isso (`tests/servidor.test.ts`). Uma tentativa de acesso indevido fica registrada no histórico.
- **Arquivos:** o original é guardado sem alteração, com hash SHA-256 (a duplicata é detectada). O nome no disco é aleatório, e o download é sempre autenticado e registrado.
- **Histórico:** registra login, alterações, envios, downloads e exclusões (com motivo).
- **Dados de acesso a órgãos:** o sistema **não guarda** senhas gov.br, códigos do Simples nem certificados digitais. Use um cofre de senhas ou o sistema fiscal.
- **LGPD — pendente de decisão do escritório** (o texto do portal é provisório):
  - publicar a política de privacidade e indicar o canal do titular;
  - definir o prazo de guarda dos documentos conforme os prazos legais aplicáveis, a validar com o contador responsável.

### Backup

```bash
sh scripts/backup.sh /caminho/backups     # banco (pg_dump) + arquivos; mantém 30 dias
```

Agende o backup diariamente (cron) e copie para fora do servidor. Para restaurar, use `pg_restore -d fiscalhub banco_AAAA-MM-DD.dump` e descompacte os arquivos em `DATA_DIR`. **Teste a restauração ao menos uma vez por mês.** Sem Docker, com o banco embutido, basta copiar a pasta `data/` com o sistema parado.

## 6. Estrutura do código

```
client/            telas (React + Vite)
  src/pages/       Painel, Obrigacoes, Demandas, Clientes, ClienteDetalhe, Documentos, Regras, Equipe, Historico, Conta, Portal, Login
  src/components/  Layout, gavetas, formulários, envio de arquivos
server/
  routers/         API (tRPC): auth, painel, clientes, tarefas, demandas, documentos, regras, equipe, portal
  services/        calendario (dias úteis/feriados), gerador (obrigações), xml, seguranca, armazenamento, historico, regrasIniciais
  arquivos.ts      upload/download (multipart)
  db/schema.ts     modelo de dados (Drizzle/PostgreSQL)
  scripts/seed.ts  admin, regras iniciais, demonstração
shared/            validação de CNPJ/CPF, competência e listas usadas nos dois lados
drizzle/           migrações SQL (aplicadas sozinhas ao iniciar)
tests/             testes automatizados (npm test)
```

Comandos: `npm test` (testes), `npm run check` (tipos) e `npm run db:generate` (gera a migração depois de mudar `schema.ts`).

## 7. Regras de prazo: leia antes de usar

As 10 regras iniciais entram **todas como "aguardando revisão"**:

- As **federais** têm dia definido, conferido com a agenda tributária da Receita Federal de 2026 (exemplos de agosto/2026 conferidos nos testes). Mesmo assim, precisam da revisão do contador.
- As **estaduais e municipais** (EFD ICMS/IPI, ICMS, DeSTDA, ISS) vêm **sem dia**, porque cada UF e cada prefeitura definem o seu. Elas não geram tarefas até o dia ser preenchido.

Obrigações geradas por regra não revisada aparecem com ⚠. Se a regra for alterada no prazo ou na abrangência, a revisão volta a ser exigida.

Fontes para conferência:

- Agenda tributária da Receita Federal (gov.br/receitafederal)
- Portal SPED (sped.rfb.gov.br)
- SEFAZ de cada UF e prefeitura de cada município
- CNPJ alfanumérico: material da Receita Federal sobre o novo formato (julho/2026)
