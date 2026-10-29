import { competenciaParaExibicao } from "@shared/competencia";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10-29" → "29/10/2026" */
export function dataBR(iso?: string | null) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
export function dataCurta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d} ${MESES_CURTOS[Number(m) - 1]}`;
}
export function dataHoraBR(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function hojeLocal() {
  return new Date().toLocaleDateString("sv-SE");
}
export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);
}
/** Texto de prazo: "Vencida há 3 dias", "Hoje", "Amanhã", "em 4 dias" */
export function prazoRelativo(iso: string, hoje = hojeLocal()) {
  const n = diasEntre(hoje, iso);
  if (n < 0) return { texto: n === -1 ? "Venceu ontem" : `Venceu há ${-n} dias`, classe: "atrasado" };
  if (n === 0) return { texto: "Vence hoje", classe: "hoje" };
  if (n === 1) return { texto: "Amanhã", classe: "hoje" };
  return { texto: `em ${n} dias`, classe: "" };
}
export function tempoAtras(d: Date | string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ontem";
  return dataHoraBR(d);
}
export const comp = (c?: string | null) => (c ? competenciaParaExibicao(c) : "—");
export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
export function moeda(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function iniciais(nome?: string | null) {
  if (!nome) return "—";
  return nome.split(/\s+/).filter(p => p.length > 1 && !/^(de|da|do|dos|das)$/i.test(p)).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}
export const corPorId = (id?: number | null) => (id ? `av-${id % 5}` : "av-x");
