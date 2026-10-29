# FiscalHub — roteiro de evolução

Feito nesta versão: saída do Manus, painel com dados reais, login próprio com perfis e duas etapas, CNPJ validado (inclusive alfanumérico), gerador de calendário com revisão do contador, matriz e checklist, central de demandas, documentos com leitura de XML, histórico e portal do cliente (beta).

## Agora (até 2 semanas)

| Atualização | Problema que resolve | Benefício | Esforço | Risco | Revisão do contador? |
|---|---|---|---|---|---|
| Revisar as 6 regras federais e preencher as estaduais e municipais (GO, SP, DF, TO e os municípios dos clientes) | Sem isso, só as federais geram tarefas, e todas com ⚠ | Calendário completo e confiável | Baixo (1 a 2 h do contador) | Prazo errado vira multa | **Sim** |
| Cadastrar os clientes reais e limpar a demonstração | O sistema ainda roda com dados fictícios | Começa a uso real | Médio (depende do tamanho da carteira) | Baixo | Não |
| Publicar com HTTPS, backup diário e um teste de restauração | Hoje roda só localmente | Acesso pela equipe e pelos clientes com segurança | Baixo | Perda de dados sem backup | Não |
| Texto de privacidade do portal e prazo de guarda dos documentos | Pendência de LGPD | Conformidade antes de abrir o portal aos clientes | Baixo | Jurídico | **Sim** |

## Próximo (até 2 meses)

| Atualização | Problema que resolve | Benefício | Esforço | Risco | Revisão do contador? |
|---|---|---|---|---|---|
| Alertas por e-mail: resumo diário por pessoa (D-5, D-1 e vencidas) e cobrança automática ao cliente quando a tarefa fica "aguardando cliente" | Hoje o alerta só aparece quando alguém abre o painel | Menos prazo perdido; o cliente é cobrado sem esforço da equipe | Médio (SMTP + agendador) | E-mail cair no spam | Não |
| Periodicidade trimestral e anual nas regras (IRPJ/CSLL trimestral, obrigações anuais) | O gerador hoje é só mensal | Calendário cobre o ano todo | Médio | Regra mal configurada | **Sim** |
| Controle de certidões (CND federal, estadual, municipal, FGTS) com validade e alerta | Certidão vencida descoberta na hora da licitação | Renovação antecipada | Baixo | Baixo | Não |
| Importação de clientes por planilha (CSV/XLSX) com validação de CNPJ | Cadastro um a um é lento em carteiras grandes | Implantação em horas | Baixo | Dados ruins entrarem | Não |
| Armazenamento S3/R2 opcional | Hospedagens sem disco persistente perdem arquivos | Liberdade de hospedagem | Baixo (interface já isolada em `armazenamento.ts`) | Custo de armazenamento | Não |
| Download em lote (ZIP) dos XML por cliente e competência | Importar no sistema fiscal arquivo por arquivo | Importação mais rápida | Baixo | Baixo | Não |
| Relatório gerencial: % entregue no prazo por competência e por pessoa, histórico de 12 meses e clientes que mais atrasam documentos | O sócio não vê a tendência | Decisões de carga e cobrança | Médio | Baixo | Não |

## Depois

| Atualização | Problema que resolve | Benefício | Esforço | Risco | Revisão do contador? |
|---|---|---|---|---|---|
| Integração com o sistema contábil/fiscal (exportar XML recebidos; importar status de transmissão) | Retrabalho de digitar o status duas vezes | Status atualizado sozinho | Alto (depende do sistema usado) | Mudanças no sistema terceiro | Não |
| Base de conhecimento interna (procedimentos por tema, com fonte legal e data de revisão) | Entendimentos que ficam na cabeça de uma pessoa | Padronização e treinamento | Médio | Conteúdo desatualizado | **Sim** |
| Acompanhamento da Reforma Tributária (CBS/IBS): campos e obrigações conforme os leiautes forem publicados | As regras da transição ainda estão sendo publicadas | Adaptação sem refazer o sistema | Médio | Regras mudarem de novo | **Sim** |
| Captura de XML direto da SEFAZ (manifestação do destinatário / distribuição DF-e) | Depende do cliente mandar as notas de entrada | Fim do principal gargalo de documento | Alto (certificado digital e serviço dedicado) | Guarda do certificado (exige cofre) | Não |
| Assinatura de recebimento de guias pelo cliente no portal | Discussão de "não recebi a guia" | Prova de entrega | Baixo | Baixo | Não |

## Pendências de decisão do escritório

1. Onde hospedar: VPS com Docker ou hospedagem gerenciada. E quem mantém (o escritório, um freelancer ou um prestador).
2. Domínio e e-mail de envio dos alertas.
3. Prazo de guarda dos documentos e texto de privacidade (LGPD).
4. Quais clientes entram primeiro no portal (sugestão: os que mais atrasam documentos).
5. Se a verificação em duas etapas será obrigatória para a equipe (recomendado).
