/** Listas e rótulos usados no servidor e nas telas. */

export const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"] as const;
export type UF = (typeof UFS)[number];

export const REGIMES = ["simples", "presumido", "real", "mei"] as const;
export type Regime = (typeof REGIMES)[number];
export const REGIME_LABEL: Record<Regime, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
  mei: "MEI",
};

export const ATIVIDADES = ["comercio", "industria", "servicos"] as const;
export type Atividade = (typeof ATIVIDADES)[number];
export const ATIVIDADE_LABEL: Record<Atividade, string> = { comercio: "Comércio", industria: "Indústria", servicos: "Serviços" };

export const PAPEIS = ["admin", "fiscal", "cliente"] as const;
export type Papel = (typeof PAPEIS)[number];
export const PAPEL_LABEL: Record<Papel, string> = { admin: "Administrador", fiscal: "Equipe fiscal", cliente: "Cliente (portal)" };

export const STATUS_TAREFA = ["pendente", "aguardando_cliente", "em_andamento", "em_revisao", "entregue", "nao_aplicavel"] as const;
export type StatusTarefa = (typeof STATUS_TAREFA)[number];
export const STATUS_TAREFA_LABEL: Record<StatusTarefa, string> = {
  pendente: "Pendente",
  aguardando_cliente: "Aguardando cliente",
  em_andamento: "Em andamento",
  em_revisao: "Em conferência",
  entregue: "Entregue",
  nao_aplicavel: "Não se aplica",
};
export const STATUS_TAREFA_ABERTOS: StatusTarefa[] = ["pendente", "aguardando_cliente", "em_andamento", "em_revisao"];

export const PRIORIDADES = ["baixa", "normal", "alta"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];
export const PRIORIDADE_LABEL: Record<Prioridade, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta" };

export const TIPOS_DEMANDA = ["notificacao", "certidao", "parcelamento", "consulta", "retificacao", "cadastro", "outro"] as const;
export type TipoDemanda = (typeof TIPOS_DEMANDA)[number];
export const TIPO_DEMANDA_LABEL: Record<TipoDemanda, string> = {
  notificacao: "Notificação / intimação",
  certidao: "Certidão",
  parcelamento: "Parcelamento",
  consulta: "Consulta do cliente",
  retificacao: "Retificação / autorregularização",
  cadastro: "Cadastro / alteração",
  outro: "Outro",
};

export const STATUS_DEMANDA = ["nova", "em_andamento", "aguardando_cliente", "aguardando_orgao", "concluida", "cancelada"] as const;
export type StatusDemanda = (typeof STATUS_DEMANDA)[number];
export const STATUS_DEMANDA_LABEL: Record<StatusDemanda, string> = {
  nova: "Nova",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  aguardando_orgao: "Aguardando órgão",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
export const STATUS_DEMANDA_ABERTOS: StatusDemanda[] = ["nova", "em_andamento", "aguardando_cliente", "aguardando_orgao"];

export const ESFERAS = ["federal", "estadual", "municipal"] as const;
export type Esfera = (typeof ESFERAS)[number];
export const ESFERA_LABEL: Record<Esfera, string> = { federal: "Federal", estadual: "Estadual", municipal: "Municipal" };

export const TIPOS_VENCIMENTO = ["dia_fixo", "dia_util_n", "ultimo_dia_util"] as const;
export type TipoVencimento = (typeof TIPOS_VENCIMENTO)[number];
export const TIPO_VENCIMENTO_LABEL: Record<TipoVencimento, string> = {
  dia_fixo: "Dia fixo do mês",
  dia_util_n: "N-ésimo dia útil",
  ultimo_dia_util: "Último dia útil",
};

export const AJUSTES = ["proximo", "anterior", "nenhum"] as const;
export type Ajuste = (typeof AJUSTES)[number];
export const AJUSTE_LABEL: Record<Ajuste, string> = {
  proximo: "Prorroga para o próximo dia útil",
  anterior: "Antecipa para o dia útil anterior",
  nenhum: "Não ajusta",
};

export const CATEGORIAS_DOC = ["xml_nfe", "xml_cte", "xml_nfse", "xml_outro", "guia", "recibo", "notificacao", "certidao", "outro"] as const;
export type CategoriaDoc = (typeof CATEGORIAS_DOC)[number];
export const CATEGORIA_DOC_LABEL: Record<CategoriaDoc, string> = {
  xml_nfe: "XML NF-e / NFC-e",
  xml_cte: "XML CT-e",
  xml_nfse: "XML NFS-e",
  xml_outro: "Outro XML",
  guia: "Guia de pagamento",
  recibo: "Recibo de entrega",
  notificacao: "Notificação",
  certidao: "Certidão",
  outro: "Outro documento",
};
