/**
 * Cálculo de dias úteis e vencimentos.
 * Feriados nacionais calculados automaticamente (fixos + Carnaval + Sexta-feira Santa).
 * Feriados estaduais e municipais (e Corpus Christi, onde for feriado) devem ser
 * cadastrados em Regras › Feriados. Conferir: calendário Febraban e legislação local.
 */
import type { Ajuste, TipoVencimento } from "../../shared/dominio";

export type DataISO = string; // AAAA-MM-DD

const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (a: number, m: number, d: number): DataISO => `${a}-${pad(m)}-${pad(d)}`;

function utc(dataIso: DataISO) {
  const [a, m, d] = dataIso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
function paraIso(d: Date): DataISO {
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
export function somarDias(dataIso: DataISO, dias: number): DataISO {
  const d = utc(dataIso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraIso(d);
}
export function diaDaSemana(dataIso: DataISO) {
  return utc(dataIso).getUTCDay(); // 0 domingo … 6 sábado
}
export function ultimoDiaDoMes(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}
export function diferencaDias(de: DataISO, ate: DataISO) {
  return Math.round((utc(ate).getTime() - utc(de).getTime()) / 86400000);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(ano, mes, dia);
}

export function feriadosNacionais(ano: number): { data: DataISO; nome: string }[] {
  const p = pascoa(ano);
  return [
    { data: iso(ano, 1, 1), nome: "Confraternização Universal" },
    { data: somarDias(p, -48), nome: "Carnaval (segunda)" },
    { data: somarDias(p, -47), nome: "Carnaval (terça)" },
    { data: somarDias(p, -2), nome: "Sexta-feira Santa" },
    { data: iso(ano, 4, 21), nome: "Tiradentes" },
    { data: iso(ano, 5, 1), nome: "Dia do Trabalho" },
    { data: iso(ano, 9, 7), nome: "Independência" },
    { data: iso(ano, 10, 12), nome: "Nossa Senhora Aparecida" },
    { data: iso(ano, 11, 2), nome: "Finados" },
    { data: iso(ano, 11, 15), nome: "Proclamação da República" },
    { data: iso(ano, 11, 20), nome: "Dia Nacional de Zumbi e da Consciência Negra" },
    { data: iso(ano, 12, 25), nome: "Natal" },
  ];
}

export type FeriadoLocal = { data: DataISO; uf: string | null; municipio: string | null };

/** Monta a função "é dia útil?" para um local (UF/município). Federal: só feriados nacionais + gerais cadastrados. */
export function criarEhDiaUtil(locais: FeriadoLocal[], local: { uf?: string; municipio?: string } = {}) {
  const cacheAno = new Map<number, Set<string>>();
  const extras = new Set(
    locais
      .filter(f => (!f.uf && !f.municipio) || (f.uf && f.uf === local.uf && (!f.municipio || f.municipio.toLowerCase() === (local.municipio || "").toLowerCase())))
      .map(f => f.data),
  );
  return (dataIso: DataISO) => {
    const dow = diaDaSemana(dataIso);
    if (dow === 0 || dow === 6) return false;
    const ano = Number(dataIso.slice(0, 4));
    if (!cacheAno.has(ano)) cacheAno.set(ano, new Set(feriadosNacionais(ano).map(f => f.data)));
    if (cacheAno.get(ano)!.has(dataIso)) return false;
    return !extras.has(dataIso);
  };
}

export type RegraVencimento = { tipoVencimento: TipoVencimento; dia: number | null; mesesApos: number; ajuste: Ajuste };

/** Vencimento de uma regra para a competência (AAAA-MM). Retorna null se a regra estiver incompleta. */
export function calcularVencimento(regra: RegraVencimento, competencia: string, ehDiaUtil: (d: DataISO) => boolean): DataISO | null {
  const [anoC, mesC] = competencia.split("-").map(Number);
  const base = new Date(Date.UTC(anoC, mesC - 1 + regra.mesesApos, 1));
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth() + 1;
  const ultimo = ultimoDiaDoMes(ano, mes);

  if (regra.tipoVencimento === "ultimo_dia_util") {
    let d = iso(ano, mes, ultimo);
    while (!ehDiaUtil(d)) d = somarDias(d, -1);
    return d;
  }
  if (!regra.dia || regra.dia < 1) return null;

  if (regra.tipoVencimento === "dia_util_n") {
    let contador = 0;
    for (let dia = 1; dia <= ultimo; dia++) {
      const d = iso(ano, mes, dia);
      if (ehDiaUtil(d) && ++contador === regra.dia) return d;
    }
    return null;
  }

  let d = iso(ano, mes, Math.min(regra.dia, ultimo));
  if (regra.ajuste === "proximo") while (!ehDiaUtil(d)) d = somarDias(d, 1);
  else if (regra.ajuste === "anterior") while (!ehDiaUtil(d)) d = somarDias(d, -1);
  return d;
}

const FUSO = process.env.FUSO_HORARIO || "America/Sao_Paulo";

/** Data (AAAA-MM-DD) no fuso do escritório. */
export function dataLocal(d: Date): DataISO {
  return d.toLocaleDateString("sv-SE", { timeZone: FUSO });
}

export function hojeIso(): DataISO {
  return dataLocal(new Date());
}

/** Início do dia (no fuso do escritório) como Date, para comparar com timestamps. */
export function inicioDoDia(dataIso: DataISO): Date {
  const meioDiaUtc = new Date(`${dataIso}T12:00:00Z`);
  const horaLocal = Number(meioDiaUtc.toLocaleString("en-US", { timeZone: FUSO, hour: "2-digit", hour12: false }));
  return new Date(meioDiaUtc.getTime() - horaLocal * 3600_000);
}
