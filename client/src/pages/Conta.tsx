import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Cabecalho, Campo, Chip } from "@/components/ui";
import { PAPEL_LABEL, type Papel } from "@shared/dominio";

export default function Conta({ usuario }: { usuario: { nome: string; email: string; papel: Papel; totpAtivo: boolean } }) {
  const utils = trpc.useUtils();
  const [senhas, setSenhas] = useState({ atual: "", nova: "", confirma: "" });
  const [qr, setQr] = useState<{ qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [senha2fa, setSenha2fa] = useState("");
  const trocar = trpc.auth.trocarSenha.useMutation({ onSuccess: () => { toast.success("Senha alterada. Outras sessões foram encerradas."); setSenhas({ atual: "", nova: "", confirma: "" }); } });
  const iniciar = trpc.auth.iniciar2fa.useMutation({ onSuccess: setQr });
  const ativar = trpc.auth.ativar2fa.useMutation({ onSuccess: () => { toast.success("Verificação em duas etapas ativada"); setQr(null); setCodigo(""); utils.auth.eu.invalidate(); } });
  const desativar = trpc.auth.desativar2fa.useMutation({ onSuccess: () => { toast.success("Verificação em duas etapas desativada"); setSenha2fa(""); utils.auth.eu.invalidate(); } });

  return (
    <>
      <Cabecalho sobretitulo={PAPEL_LABEL[usuario.papel]} titulo="Minha conta" descricao={`${usuario.nome} · ${usuario.email}`} />
      <section className="grade-meio">
        <article className="painel">
          <div className="painel-cabeca"><div><span className="sobretitulo">Acesso</span><h2>Trocar senha</h2></div></div>
          <form className="painel-corpo form" style={{ gridTemplateColumns: "1fr" }} onSubmit={e => { e.preventDefault(); if (senhas.nova !== senhas.confirma) { toast.error("A confirmação não confere."); return; } trocar.mutate({ atual: senhas.atual, nova: senhas.nova }); }}>
            <Campo rotulo="Senha atual"><input type="password" autoComplete="current-password" required value={senhas.atual} onChange={e => setSenhas({ ...senhas, atual: e.target.value })} /></Campo>
            <Campo rotulo="Nova senha" dica="Mínimo de 10 caracteres, com letras e números"><input type="password" autoComplete="new-password" required minLength={10} value={senhas.nova} onChange={e => setSenhas({ ...senhas, nova: e.target.value })} /></Campo>
            <Campo rotulo="Confirme a nova senha"><input type="password" autoComplete="new-password" required value={senhas.confirma} onChange={e => setSenhas({ ...senhas, confirma: e.target.value })} /></Campo>
            <div><button className="botao botao-primario" disabled={trocar.isPending}>Salvar nova senha</button></div>
          </form>
        </article>
        <article className="painel">
          <div className="painel-cabeca"><div><span className="sobretitulo">Segurança</span><h2>Verificação em duas etapas</h2></div>{usuario.totpAtivo ? <Chip tom="lima">Ativa</Chip> : <Chip tom="ambar">Desativada</Chip>}</div>
          <div className="painel-corpo">
            <p style={{ marginTop: 0, color: "var(--suave)", fontSize: 14 }}>Além da senha, o login pede um código de 6 números do aplicativo autenticador do seu celular (Google Authenticator, Microsoft Authenticator, Authy…). Protege os dados dos clientes mesmo se a senha vazar.</p>
            {usuario.totpAtivo ? (
              <form className="form" style={{ gridTemplateColumns: "1fr" }} onSubmit={e => { e.preventDefault(); desativar.mutate({ senha: senha2fa }); }}>
                <Campo rotulo="Confirme sua senha para desativar"><input type="password" required value={senha2fa} onChange={e => setSenha2fa(e.target.value)} /></Campo>
                <div><button className="botao botao-perigo" disabled={desativar.isPending}>Desativar</button></div>
              </form>
            ) : !qr ? (
              <button className="botao botao-primario" onClick={() => iniciar.mutate()} disabled={iniciar.isPending}><ShieldCheck size={16} /> Ativar agora</button>
            ) : (
              <form onSubmit={e => { e.preventDefault(); ativar.mutate({ codigo }); }}>
                <ol style={{ paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                  <li>No aplicativo autenticador, toque em adicionar conta e leia o QR code:</li>
                </ol>
                <img src={qr.qr} alt="QR code para o aplicativo autenticador" width={200} height={200} style={{ display: "block", margin: "6px 0 6px 18px" }} />
                <p style={{ fontSize: 12, color: "var(--fraco)", marginLeft: 18 }}>Sem câmera? Digite a chave: <code className="mono">{qr.segredo}</code></p>
                <ol start={2} style={{ paddingLeft: 18, fontSize: 14 }}><li>Digite o código de 6 números que aparece no aplicativo:</li></ol>
                <div style={{ display: "flex", gap: 8, marginLeft: 18 }}>
                  <input aria-label="Código" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={e => setCodigo(e.target.value)} style={{ height: 40, border: "1px solid #d5dde0", borderRadius: 7, padding: "0 10px", width: 140 }} className="mono" />
                  <button className="botao botao-primario" disabled={ativar.isPending}>Confirmar</button>
                </div>
              </form>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
