import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { ENV } from "../env";

export async function gerarHashSenha(senha: string) {
  return bcrypt.hash(senha, 12);
}
export async function conferirSenha(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}

export function politicaSenha(senha: string): string | null {
  if (senha.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  return null;
}

export function senhaTemporaria() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  let s = "";
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8) + "7";
}

export function novoToken() {
  return crypto.randomBytes(32).toString("base64url");
}
export function sha256(dado: string | Buffer) {
  return crypto.createHash("sha256").update(dado).digest("hex");
}

function chave() {
  if (/^[0-9a-f]{64}$/i.test(ENV.encryptionKey)) return Buffer.from(ENV.encryptionKey, "hex");
  return crypto.createHash("sha256").update("fiscalhub-chave-de-desenvolvimento").digest();
}
export function criptografar(texto: string) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return [iv, cifra.getAuthTag(), dados].map(b => b.toString("base64")).join(".");
}
export function descriptografar(pacote: string) {
  const [iv, tag, dados] = pacote.split(".").map(p => Buffer.from(p, "base64"));
  const decifra = crypto.createDecipheriv("aes-256-gcm", chave(), iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(dados), decifra.final()]).toString("utf8");
}

export function novoSegredoTotp() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}
export function totpUri(segredo: string, email: string) {
  return new OTPAuth.TOTP({ issuer: "FiscalHub", label: email, secret: OTPAuth.Secret.fromBase32(segredo), digits: 6, period: 30 }).toString();
}
export function conferirTotp(segredo: string, codigo: string) {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(segredo), digits: 6, period: 30 });
  return totp.validate({ token: codigo.replace(/\s/g, ""), window: 1 }) !== null;
}

/** Limite simples de tentativas de login (memória do processo). */
const tentativas = new Map<string, { n: number; ate: number }>();
export function bloqueadoPorTentativas(chaveLimite: string) {
  const t = tentativas.get(chaveLimite);
  return !!t && t.n >= 5 && t.ate > Date.now();
}
export function registrarFalha(chaveLimite: string) {
  const t = tentativas.get(chaveLimite);
  const agora = Date.now();
  if (!t || t.ate < agora) tentativas.set(chaveLimite, { n: 1, ate: agora + 15 * 60_000 });
  else t.n++;
}
export function limparFalhas(chaveLimite: string) {
  tentativas.delete(chaveLimite);
}
