import { useState } from "react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Campo } from "@/components/ui";

export default function Login() {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pedeCodigo, setPedeCodigo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entrar = trpc.auth.entrar.useMutation({
    onSuccess: r => {
      if (r.precisaCodigo) { setPedeCodigo(true); setErro(null); return; }
      utils.auth.eu.invalidate();
    },
    onError: e => setErro(e.message),
  });

  return (
    <div className="login">
      <section className="login-painel">
        <div className="marca-sinal">fh<span>.</span></div>
        <span className="sobretitulo">Portal fiscal · acesso restrito</span>
        <h1>Clareza para o fechamento.</h1>
        <p>Obrigações, demandas, documentos e prazos da equipe fiscal em um só lugar. Clientes do escritório acessam aqui o portal de envio de documentos.</p>
        <form className="login-form" onSubmit={e => { e.preventDefault(); setErro(null); entrar.mutate({ email, senha, codigo: pedeCodigo ? codigo : undefined }); }}>
          {!pedeCodigo ? (
            <>
              <Campo rotulo="E-mail"><input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></Campo>
              <Campo rotulo="Senha"><input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></Campo>
            </>
          ) : (
            <Campo rotulo="Código do aplicativo autenticador" dica="Abra o aplicativo (Google Authenticator, Microsoft Authenticator…) e digite os 6 números.">
              <input inputMode="numeric" autoComplete="one-time-code" autoFocus required pattern="[0-9 ]{6,7}" value={codigo} onChange={e => setCodigo(e.target.value)} />
            </Campo>
          )}
          {erro && <div className="aviso aviso-coral" role="alert">{erro}</div>}
          <button className="botao botao-primario" style={{ height: 44 }} disabled={entrar.isPending}>
            {entrar.isPending ? "Entrando…" : pedeCodigo ? "Confirmar código" : "Entrar"} <ArrowRight size={16} />
          </button>
          <small style={{ color: "var(--fraco)", display: "flex", gap: 6, alignItems: "center" }}><ShieldCheck size={14} /> Esqueceu a senha? Peça ao administrador do escritório para redefinir.</small>
        </form>
      </section>
      <aside className="login-lado">
        <span className="sobretitulo" style={{ color: "#93a2b3" }}>O que entra aqui</span>
        <ul>
          <li><Check size={18} /> Obrigações por cliente × competência, com prazo e responsável</li>
          <li><Check size={18} /> Notificações, certidões e pedidos com dono e prazo</li>
          <li><Check size={18} /> XML e comprovantes guardados com histórico</li>
          <li><Check size={18} /> Portal para o cliente enviar documentos</li>
        </ul>
        <div className="rodape">GO · SP · DF · TO · demais estados</div>
      </aside>
    </div>
  );
}
