import { useState } from "react";
import { Copy, KeyRound, Plus, ShieldOff, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Avatar, Cabecalho, Campo, Carregando, Chip, ErroCarga, Modal } from "@/components/ui";
import { dataHoraBR } from "@/lib/formato";
import { PAPEIS, PAPEL_LABEL, type Papel } from "@shared/dominio";

export default function Equipe() {
  const utils = trpc.useUtils();
  const eu = trpc.auth.eu.useQuery();
  const lista = trpc.equipe.listar.useQuery();
  const clientes = trpc.clientes.listar.useQuery();
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ nome: "", email: "", papel: "fiscal" as Papel, clienteId: "" });
  const [senha, setSenha] = useState<{ nome: string; senha: string } | null>(null);
  const recarregar = () => { utils.equipe.invalidate(); };
  const criar = trpc.equipe.criar.useMutation({ onSuccess: r => { recarregar(); setNovo(false); setSenha({ nome: r.usuario.nome, senha: r.senhaTemporaria }); setF({ nome: "", email: "", papel: "fiscal", clienteId: "" }); } });
  const atualizar = trpc.equipe.atualizar.useMutation({ onSuccess: () => { recarregar(); toast.success("Acesso atualizado"); } });
  const redefinir = trpc.equipe.redefinirSenha.useMutation({ onSuccess: (r, v) => setSenha({ nome: lista.data?.find(u => u.id === v.id)?.nome ?? "", senha: r.senhaTemporaria }) });
  const zerar2fa = trpc.equipe.zerar2fa.useMutation({ onSuccess: () => { recarregar(); toast.success("Verificação em duas etapas removida"); } });

  return (
    <>
      <Cabecalho sobretitulo="Administração" titulo="Equipe e acessos" descricao="Cada pessoa tem login próprio. Clientes do portal só enxergam a própria empresa."
        acoes={<button className="botao botao-primario" onClick={() => setNovo(true)}><Plus size={16} /> Novo acesso</button>} />
      <article className="painel">
        {lista.isLoading ? <Carregando /> : lista.error ? <ErroCarga erro={lista.error} /> : (
          <div className="tabela-rolagem"><table className="tabela">
            <thead><tr><th>Pessoa</th><th>Perfil</th><th>Segurança</th><th>Último acesso</th><th></th></tr></thead>
            <tbody>{lista.data!.map(u => (
              <tr key={u.id} style={{ opacity: u.ativo ? 1 : .5 }}>
                <td><span style={{ display: "inline-flex", gap: 9, alignItems: "center" }}><Avatar nome={u.nome} id={u.id} /><span><strong>{u.nome}</strong><span className="sub">{u.email}</span></span></span></td>
                <td>{PAPEL_LABEL[u.papel]}{u.cliente && <span className="sub">{u.cliente}</span>}{!u.ativo && <> <Chip>Desativado</Chip></>}</td>
                <td>{u.totpAtivo ? <Chip tom="lima">2 etapas ativa</Chip> : <Chip tom={u.papel === "cliente" ? "" : "ambar"}>Só senha</Chip>}{u.trocarSenha && <span className="sub">Senha temporária pendente</span>}</td>
                <td>{dataHoraBR(u.ultimoAcesso)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="botao-icone" title="Gerar nova senha temporária" aria-label={`Redefinir senha de ${u.nome}`} onClick={() => confirm(`Gerar nova senha temporária para ${u.nome}? As sessões abertas serão encerradas.`) && redefinir.mutate({ id: u.id })}><KeyRound size={15} /></button>
                  {u.totpAtivo && <button className="botao-icone" title="Remover 2 etapas (celular perdido)" aria-label={`Remover verificação em duas etapas de ${u.nome}`} onClick={() => confirm(`Remover a verificação em duas etapas de ${u.nome}?`) && zerar2fa.mutate({ id: u.id })}><ShieldOff size={15} /></button>}
                  {u.id !== eu.data?.id && (u.ativo
                    ? <button className="botao-icone" title="Desativar acesso" aria-label={`Desativar ${u.nome}`} onClick={() => confirm(`Desativar o acesso de ${u.nome}?`) && atualizar.mutate({ id: u.id, ativo: false })}><UserX size={15} /></button>
                    : <button className="botao-icone" title="Reativar acesso" aria-label={`Reativar ${u.nome}`} onClick={() => atualizar.mutate({ id: u.id, ativo: true })}><UserCheck size={15} /></button>)}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <div className="painel-rodape"><span>Recomendado: verificação em duas etapas para toda a equipe (cada pessoa ativa em "Minha conta").</span></div>
      </article>

      <Modal aberto={novo} fechar={() => setNovo(false)} sobretitulo="Novo acesso" titulo="Convidar pessoa" descricao="O sistema gera uma senha temporária. Entregue por um canal seguro; no primeiro acesso a pessoa cria a própria senha."
        rodape={<><button className="botao botao-secundario" onClick={() => setNovo(false)}>Cancelar</button><button form="form-usuario" className="botao botao-primario" disabled={criar.isPending}>Criar acesso</button></>}>
        <form id="form-usuario" className="form" onSubmit={e => { e.preventDefault(); criar.mutate({ nome: f.nome, email: f.email, papel: f.papel, clienteId: f.papel === "cliente" ? Number(f.clienteId) : null }); }}>
          <Campo rotulo="Nome *" inteiro><input required value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></Campo>
          <Campo rotulo="E-mail *" inteiro><input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Campo>
          <Campo rotulo="Perfil"><select value={f.papel} onChange={e => setF({ ...f, papel: e.target.value as Papel })}>{PAPEIS.map(p => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}</select></Campo>
          {f.papel === "cliente" && <Campo rotulo="Empresa *"><select required value={f.clienteId} onChange={e => setF({ ...f, clienteId: e.target.value })}><option value="">Selecione</option>{clientes.data?.map(c => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}</select></Campo>}
          <div className="inteiro" style={{ fontSize: 13, color: "var(--suave)" }}>
            <strong>Administrador:</strong> tudo, inclusive acessos e revisão de regras. <strong>Equipe fiscal:</strong> clientes, obrigações, demandas e documentos. <strong>Cliente:</strong> só o portal da própria empresa.
          </div>
        </form>
      </Modal>

      <Modal aberto={!!senha} fechar={() => setSenha(null)} titulo="Senha temporária" descricao={`Entregue para ${senha?.nome} por um canal seguro. Ela não será mostrada de novo.`}
        rodape={<button className="botao botao-primario" onClick={() => setSenha(null)}>Entendi</button>}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <code className="mono" style={{ fontSize: 20, padding: "10px 14px", background: "var(--linha-2)", borderRadius: 8, flex: 1 }}>{senha?.senha}</code>
          <button className="botao botao-secundario" onClick={() => { navigator.clipboard?.writeText(senha?.senha ?? ""); toast.success("Copiada"); }}><Copy size={15} /> Copiar</button>
        </div>
      </Modal>
    </>
  );
}
