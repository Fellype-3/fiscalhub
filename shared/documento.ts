/**
 * Validação de CNPJ (numérico e alfanumérico) e CPF.
 *
 * CNPJ alfanumérico: a Receita Federal passou a poder emitir inscrições com
 * letras nas 12 primeiras posições a partir de julho/2026. Os 2 dígitos
 * verificadores continuam numéricos. Cálculo: cada caractere vale
 * (código ASCII − 48) → 0–9 = 0–9, A = 17 … Z = 42; pesos 2–9 da direita para
 * a esquerda; módulo 11 (resto 0 ou 1 → DV 0; senão 11 − resto).
 * Fonte para conferência: Receita Federal — "CNPJ alfanumérico" (gov.br/receitafederal).
 */

export function limparDocumento(valor: string): string {
  return (valor || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function valorCaractere(c: string): number {
  return c.charCodeAt(0) - 48;
}

function dvCnpj(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += valorCaractere(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function calcularDvCnpj(base12: string): string {
  const b = limparDocumento(base12);
  const d1 = dvCnpj(b);
  const d2 = dvCnpj(b + d1);
  return `${d1}${d2}`;
}

export function cnpjValido(valor: string): boolean {
  const c = limparDocumento(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(\w)\1{13}$/.test(c)) return false;
  return calcularDvCnpj(c.slice(0, 12)) === c.slice(12);
}

export function cpfValido(valor: string): boolean {
  const c = limparDocumento(valor);
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(c[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export type TipoDocumento = "CNPJ" | "CPF";

export function validarDocumento(valor: string): { ok: true; tipo: TipoDocumento; numero: string } | { ok: false; erro: string } {
  const c = limparDocumento(valor);
  if (c.length === 14) {
    return cnpjValido(c) ? { ok: true, tipo: "CNPJ", numero: c } : { ok: false, erro: "CNPJ inválido: confira os dígitos verificadores." };
  }
  if (c.length === 11) {
    return cpfValido(c) ? { ok: true, tipo: "CPF", numero: c } : { ok: false, erro: "CPF inválido: confira os dígitos verificadores." };
  }
  return { ok: false, erro: "Informe um CNPJ (14 caracteres) ou CPF (11 dígitos)." };
}

export function formatarDocumento(valor: string): string {
  const c = limparDocumento(valor);
  if (c.length === 14) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  if (c.length === 11) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  return valor;
}
