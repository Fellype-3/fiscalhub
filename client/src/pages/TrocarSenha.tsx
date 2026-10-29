import { useState } from "react";
import { KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Campo } from "@/components/ui";

export default function TrocarSenha({ usuario }: { usuario: { nome: string } }) {
  const utils = trpc.useUtils();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const trocar = trpc.auth.trocarSenha.useMutation({ onSuccess: () => utils.auth.eu.invalidate(), onError: e => setErro(e.message) });
  const sair = trpc.auth.sair.useMutation({ onSuccess: () => utils.auth.eu.invalidate() });

  return (
    <div className="login" style={{ gridTemplateColumns: "1fr" }}>
      <section className="login-painel" style={{ alignItems: "center" }}>
        <form className="login-form" style={{ width: "100%" }} onSubmit={e => {
          e.preventDefault(); setErro(null);
          if (nova !== confirma) { setErro("A confirmação não confere com a nova senha."); return; }
          trocar.mutate({ atual, nova });
        }}>
          <KeyRound size={30} color="#0d1b2a" />
          <h1 style={{ fontSize: 30 }}>Olá, {usuario.nome.split(" ")[0]}. Crie sua senha.</h1>
          <p style={{ margin: 0 }}>Você entrou com uma senha temporária. Escolha uma senha pessoal com pelo menos 10 caracteres, letras e números.</p>
          <Campo rotulo="Senha temporária"><input type="password" autoComplete="current-password" required value={atual} onChange={e => setAtual(e.target.value)} /></Campo>
          <Campo rotulo="Nova senha"><input type="password" autoComplete="new-password" required minLength={10} value={nova} onChange={e => setNova(e.target.value)} /></Campo>
          <Campo rotulo="Confirme a nova senha"><input type="password" autoComplete="new-password" required value={confirma} onChange={e => setConfirma(e.target.value)} /></Campo>
          {erro && <div className="aviso aviso-coral" role="alert">{erro}</div>}
          <button className="botao botao-primario" disabled={trocar.isPending}>{trocar.isPending ? "Salvando…" : "Salvar e continuar"}</button>
          <button type="button" className="botao-texto" onClick={() => sair.mutate()}>Sair</button>
        </form>
      </section>
    </div>
  );
}
