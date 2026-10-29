import { describe, expect, it } from "vitest";
import { analisarXml, chaveAcessoValida } from "../server/services/xml";

const nfe = (dest: string, chave = "52261000000000000000550010000010011000010015") => Buffer.from(`<?xml version="1.0"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}">
<ide><mod>55</mod><dhEmi>2026-10-02T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>11222333000181</CNPJ></emit><dest><CNPJ>${dest}</CNPJ></dest>
<total><ICMSTot><vNF>100.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`);

describe("XML fiscal", () => {
  it("lê NF-e e confere o destinatário", () => {
    const r = analisarXml(nfe("12ABC34501DE35"), "12ABC34501DE35");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.info.tipo).toBe("NF-e");
      expect(r.info.cnpjEmitente).toBe("11222333000181");
      expect(r.info.alertas.some(a => a.includes("não aparece"))).toBe(false);
    }
  });
  it("alerta quando o cliente não é emitente nem destinatário", () => {
    const r = analisarXml(nfe("99999999000191"), "12ABC34501DE35");
    expect(r.ok && r.info.alertas.some(a => a.includes("não aparece"))).toBe(true);
  });
  it("recusa XML mal formado e DOCTYPE", () => {
    expect(analisarXml(Buffer.from("<a><b></a>"), "x").ok).toBe(false);
    expect(analisarXml(Buffer.from('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>'), "x").ok).toBe(false);
  });
  it("confere o DV da chave de acesso", () => {
    expect(chaveAcessoValida("1".repeat(44))).toBe(false);
  });
});
