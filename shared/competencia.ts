/** Competência: exibida como MM/AAAA; gravada como AAAA-MM (ordena corretamente). */

export function competenciaParaBanco(exibicao: string): string {
  const m = /^(\d{2})\/(\d{4})$/.exec(exibicao.trim());
  if (!m) throw new Error("Competência deve estar no formato MM/AAAA");
  const mes = Number(m[1]);
  if (mes < 1 || mes > 12) throw new Error("Mês da competência inválido");
  return `${m[2]}-${m[1]}`;
}

export function competenciaParaExibicao(banco: string): string {
  const [ano, mes] = banco.split("-");
  return `${mes}/${ano}`;
}

export function competenciaValida(banco: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(banco);
}

/** Competência em fechamento = mês anterior à data informada. */
export function competenciaEmFechamento(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function deslocarCompetencia(banco: string, meses: number): string {
  const [ano, mes] = banco.split("-").map(Number);
  const d = new Date(ano, mes - 1 + meses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function nomeCompetencia(banco: string): string {
  const [ano, mes] = banco.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}
