import { describe, expect, it } from "vitest";
import { calcularDvCnpj, cnpjValido, cpfValido, formatarDocumento, validarDocumento } from "../shared/documento";

describe("CNPJ", () => {
  it("aceita CNPJ numérico válido", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });
  it("recusa dígito errado, tamanho errado e sequência repetida", () => {
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });
  it("aceita CNPJ alfanumérico (exemplo de referência 12.ABC.345/01DE-35)", () => {
    expect(calcularDvCnpj("12ABC34501DE")).toBe("35");
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12.abc.345/01de-35")).toBe(true);
    expect(cnpjValido("12.ABC.345/01DE-36")).toBe(false);
  });
  it("normaliza e formata", () => {
    const r = validarDocumento(" 12.abc.345/01de-35 ");
    expect(r).toEqual({ ok: true, tipo: "CNPJ", numero: "12ABC34501DE35" });
    expect(formatarDocumento("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});

describe("CPF", () => {
  it("valida dígitos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
});
