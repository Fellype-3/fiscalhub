/**
 * Leitura básica de XML fiscal no upload: confere se o arquivo é XML bem formado,
 * identifica o tipo (NF-e/NFC-e, CT-e, NFS-e, evento), extrai chave, CNPJs, data e valor
 * e gera alertas. Não substitui a validação de schema (XSD) nem a consulta na SEFAZ.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { limparDocumento } from "../../shared/documento";
import type { InfoXml } from "../db/schema";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

export function chaveAcessoValida(chave: string) {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  const dv = r < 2 ? 0 : 11 - r;
  return dv === Number(chave[43]);
}

const doc = (o: any) => limparDocumento(String(o?.CNPJ ?? o?.CPF ?? "")) || undefined;

export type ResultadoXml = { ok: true; info: InfoXml; categoria: "xml_nfe" | "xml_cte" | "xml_nfse" | "xml_outro" } | { ok: false; erro: string };

export function analisarXml(conteudo: Buffer, documentoCliente: string): ResultadoXml {
  const texto = conteudo.toString("utf8").replace(/^﻿/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(texto)) return { ok: false, erro: "XML com declaração DOCTYPE/ENTITY não é aceito." };
  const valid = XMLValidator.validate(texto);
  if (valid !== true) return { ok: false, erro: `XML mal formado (linha ${valid.err.line}): ${valid.err.msg}` };

  const raiz = parser.parse(texto);
  const alertas: string[] = [];
  let info: InfoXml = { tipo: "XML não identificado", alertas };
  let categoria: "xml_nfe" | "xml_cte" | "xml_nfse" | "xml_outro" = "xml_outro";

  const nfe = raiz.nfeProc?.NFe ?? raiz.NFe;
  const cte = raiz.cteProc?.CTe ?? raiz.CTe;
  const nfse = raiz.NFSe;
  const evento = raiz.procEventoNFe ?? raiz.procEventoCTe;

  if (nfe?.infNFe) {
    const inf = nfe.infNFe;
    const modelo = String(inf.ide?.mod ?? "");
    info = {
      tipo: modelo === "65" ? "NFC-e" : "NF-e",
      chave: String(inf["@Id"] ?? "").replace(/^NFe/, ""),
      cnpjEmitente: doc(inf.emit),
      cnpjDestinatario: doc(inf.dest),
      emissao: String(inf.ide?.dhEmi ?? inf.ide?.dEmi ?? "") || undefined,
      valorTotal: inf.total?.ICMSTot?.vNF ? String(inf.total.ICMSTot.vNF) : undefined,
      alertas,
    };
    categoria = "xml_nfe";
    if (!raiz.nfeProc) alertas.push("XML sem protocolo de autorização (nfeProc). Confira se a nota foi autorizada.");
  } else if (cte?.infCte) {
    const inf = cte.infCte;
    info = {
      tipo: "CT-e",
      chave: String(inf["@Id"] ?? "").replace(/^CTe/, ""),
      cnpjEmitente: doc(inf.emit),
      cnpjDestinatario: doc(inf.dest) ?? doc(inf.rem),
      emissao: String(inf.ide?.dhEmi ?? "") || undefined,
      valorTotal: inf.vPrest?.vTPrest ? String(inf.vPrest.vTPrest) : undefined,
      alertas,
    };
    categoria = "xml_cte";
    if (!raiz.cteProc) alertas.push("XML sem protocolo de autorização (cteProc).");
  } else if (nfse?.infNFSe) {
    const inf = nfse.infNFSe;
    const dps = inf.DPS?.infDPS;
    info = {
      tipo: "NFS-e (padrão nacional)",
      chave: String(inf["@Id"] ?? "").replace(/^NFS/, "") || undefined,
      cnpjEmitente: doc(inf.emit) ?? doc(dps?.prest),
      cnpjDestinatario: doc(dps?.toma),
      emissao: String(dps?.dhEmi ?? inf.dhProc ?? "") || undefined,
      valorTotal: inf.valores?.vLiq ? String(inf.valores.vLiq) : undefined,
      alertas,
    };
    categoria = "xml_nfse";
  } else if (evento) {
    const ev = evento.evento?.infEvento ?? {};
    info = { tipo: `Evento ${String(ev.detEvento?.descEvento ?? ev.tpEvento ?? "")}`.trim(), chave: String(ev.chNFe ?? ev.chCTe ?? "") || undefined, cnpjEmitente: doc(ev), alertas };
    categoria = /nfe/i.test(Object.keys(raiz).join()) ? "xml_nfe" : "xml_cte";
  } else {
    alertas.push("Leiaute não reconhecido (pode ser NFS-e municipal). Arquivo guardado como enviado.");
  }

  if (info.chave && /^\d+$/.test(info.chave) && !chaveAcessoValida(info.chave)) alertas.push("Chave de acesso com dígito verificador inválido.");
  const docCliente = limparDocumento(documentoCliente);
  if ((info.cnpjEmitente || info.cnpjDestinatario) && info.cnpjEmitente !== docCliente && info.cnpjDestinatario !== docCliente) {
    alertas.push("O CNPJ/CPF do cliente não aparece como emitente nem como destinatário.");
  }
  return { ok: true, info, categoria };
}
