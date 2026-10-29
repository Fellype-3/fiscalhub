import type { regras } from "../db/schema";

const AGENDA = "https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria";

/** Regras iniciais. TODAS entram como "não revisadas": o contador responsável confere e marca. */
export const REGRAS_INICIAIS: (typeof regras.$inferInsert)[] = [
  { nome: "PGDAS-D e DAS (Simples Nacional)", esfera: "federal", regimes: ["simples"], tipoVencimento: "dia_fixo", dia: 20, mesesApos: 1, ajuste: "proximo",
    fonteUrl: AGENDA, fonteNota: "Dia 20 do mês seguinte (agenda tributária 2026). Conferir na Resolução CGSN 140/2018 a regra para vencimento em dia não útil." },
  { nome: "DAS-MEI", esfera: "federal", regimes: ["mei"], tipoVencimento: "dia_fixo", dia: 20, mesesApos: 1, ajuste: "proximo",
    fonteUrl: AGENDA, fonteNota: "Conferir regra de dia não útil. Avaliar se o escritório controla o DAS-MEI ou só orienta o cliente." },
  { nome: "DCTFWeb", esfera: "federal", regimes: ["simples", "presumido", "real"], tipoVencimento: "ultimo_dia_util", dia: null, mesesApos: 1, ajuste: "anterior",
    fonteUrl: AGENDA, fonteNota: "Último dia útil do mês seguinte ao fato gerador (agenda tributária 2026). No Simples, só quando houver folha ou retenções: dispense no cadastro do cliente quando não se aplicar." },
  { nome: "EFD-Reinf", esfera: "federal", regimes: ["presumido", "real"], tipoVencimento: "dia_fixo", dia: 15, mesesApos: 1, ajuste: "proximo",
    fonteUrl: AGENDA, fonteNota: "Dia 15 do mês seguinte; em ago/2026 a agenda indicou 17/08 (dia 15 caiu no sábado). Confirmar quais clientes têm eventos." },
  { nome: "EFD-Contribuições", esfera: "federal", regimes: ["presumido", "real"], tipoVencimento: "dia_util_n", dia: 10, mesesApos: 2, ajuste: "nenhum",
    fonteUrl: "http://sped.rfb.gov.br/", fonteNota: "10º dia útil do 2º mês seguinte (agenda de ago/2026: 14/08 para a competência 06/2026)." },
  { nome: "PIS/COFINS — DARF", esfera: "federal", regimes: ["presumido", "real"], tipoVencimento: "dia_fixo", dia: 25, mesesApos: 1, ajuste: "anterior",
    fonteUrl: AGENDA, fonteNota: "A confirmar pelo contador: dia 25 do mês seguinte, antecipando se não for dia útil." },
  { nome: "EFD ICMS/IPI", esfera: "estadual", regimes: ["presumido", "real"], atividades: ["comercio", "industria"], tipoVencimento: "dia_fixo", dia: null, mesesApos: 1, ajuste: "nenhum",
    fonteUrl: "http://sped.rfb.gov.br/", fonteNota: "Prazo definido por cada UF. Preencher o dia por UF (duplique a regra para GO, SP, DF, TO…) com base na SEFAZ." },
  { nome: "Apuração e guia de ICMS", esfera: "estadual", regimes: ["presumido", "real"], atividades: ["comercio", "industria"], tipoVencimento: "dia_fixo", dia: null, mesesApos: 1, ajuste: "nenhum",
    fonteUrl: null, fonteNota: "Prazo varia por UF e por atividade. Preencher com base na legislação da SEFAZ de cada UF." },
  { nome: "DeSTDA (Simples — ST, DIFAL e antecipação)", esfera: "estadual", regimes: ["simples"], atividades: ["comercio", "industria"], tipoVencimento: "dia_fixo", dia: null, mesesApos: 1, ajuste: "nenhum",
    fonteUrl: null, fonteNota: "Confirmar a obrigatoriedade e o prazo em cada UF antes de ativar." },
  { nome: "ISS e declaração de serviços municipal", esfera: "municipal", regimes: ["presumido", "real"], atividades: ["servicos"], tipoVencimento: "dia_fixo", dia: null, mesesApos: 1, ajuste: "nenhum",
    fonteUrl: null, fonteNota: "Prazo definido por cada prefeitura (Goiânia, Aparecida, São Paulo…). Crie uma regra por município." },
];

export const CHECKLIST_INICIAL = [
  "XML de entradas recebidos e importados",
  "XML de saídas importados e conferidos",
  "Notas canceladas, denegadas e inutilizadas conferidas",
  "Apuração conferida pelo revisor",
  "Guias emitidas e enviadas ao cliente",
  "Obrigações transmitidas e recibos anexados",
];

