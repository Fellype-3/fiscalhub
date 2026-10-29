import { describe, expect, it } from "vitest";
import { calcularVencimento, criarEhDiaUtil, feriadosNacionais, pascoa } from "../server/services/calendario";

const util = criarEhDiaUtil([]);

describe("feriados", () => {
  it("calcula Páscoa e Carnaval", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
    const f = feriadosNacionais(2026).map(x => x.data);
    expect(f).toContain("2026-02-16");
    expect(f).toContain("2026-02-17");
    expect(f).toContain("2026-04-03");
    expect(f).toContain("2026-11-20");
  });
  it("considera feriado municipal só no município", () => {
    const locais = [{ data: "2026-10-24", uf: "GO", municipio: "Goiânia" }];
    expect(criarEhDiaUtil(locais, { uf: "GO", municipio: "Goiânia" })("2026-10-23")).toBe(true);
    // 24/10/2026 é sábado; usa 26/10 só para checar a lógica com data útil
    const l2 = [{ data: "2026-10-26", uf: "GO", municipio: "Goiânia" }];
    expect(criarEhDiaUtil(l2, { uf: "GO", municipio: "Goiânia" })("2026-10-26")).toBe(false);
    expect(criarEhDiaUtil(l2, { uf: "GO", municipio: "Anápolis" })("2026-10-26")).toBe(true);
    expect(criarEhDiaUtil(l2, {})("2026-10-26")).toBe(true);
  });
});

describe("vencimentos — conferidos com a agenda tributária de agosto/2026", () => {
  it("EFD-Contribuições 06/2026 → 10º dia útil de agosto = 14/08/2026", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_util_n", dia: 10, mesesApos: 2, ajuste: "nenhum" }, "2026-06", util)).toBe("2026-08-14");
  });
  it("EFD-Reinf 07/2026 → dia 15 (sábado) prorroga para 17/08/2026", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_fixo", dia: 15, mesesApos: 1, ajuste: "proximo" }, "2026-07", util)).toBe("2026-08-17");
  });
  it("DCTFWeb 07/2026 → último dia útil de agosto = 31/08/2026", () => {
    expect(calcularVencimento({ tipoVencimento: "ultimo_dia_util", dia: null, mesesApos: 1, ajuste: "anterior" }, "2026-07", util)).toBe("2026-08-31");
  });
  it("PGDAS-D 07/2026 → 20/08/2026", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_fixo", dia: 20, mesesApos: 1, ajuste: "proximo" }, "2026-07", util)).toBe("2026-08-20");
  });
  it("pula Finados ao contar dias úteis (EFD-Contribuições 09/2026 → 16/11/2026)", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_util_n", dia: 10, mesesApos: 2, ajuste: "nenhum" }, "2026-09", util)).toBe("2026-11-16");
  });
  it("antecipa quando o ajuste é 'anterior' (dia 25/10/2026 é domingo → 23/10)", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_fixo", dia: 25, mesesApos: 1, ajuste: "anterior" }, "2026-09", util)).toBe("2026-10-23");
  });
  it("vira o ano (competência 12/2026 → janeiro/2027)", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_fixo", dia: 20, mesesApos: 1, ajuste: "proximo" }, "2026-12", util)).toBe("2027-01-20");
  });
  it("regra sem dia definido não gera vencimento", () => {
    expect(calcularVencimento({ tipoVencimento: "dia_fixo", dia: null, mesesApos: 1, ajuste: "nenhum" }, "2026-07", util)).toBeNull();
  });
});
