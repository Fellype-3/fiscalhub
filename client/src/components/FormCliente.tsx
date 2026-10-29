import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc, type Saidas } from "@/lib/trpc";
import { Campo, Modal } from "./ui";
import { ATIVIDADES, ATIVIDADE_LABEL, REGIMES, REGIME_LABEL, UFS, type Atividade, type Regime } from "@shared/dominio";
import { formatarDocumento, limparDocumento, validarDocumento } from "@shared/documento";

type Cliente = Saidas["clientes"]["obter"]["cliente"];

const vazio = {
  razaoSocial: "", nomeFantasia: "", documento: "", inscricaoEstadual: "", inscricaoMunicipal: "", uf: "GO", municipio: "",
  regime: "simples" as Regime, atividades: [] as Atividade[], responsavelId: "" as string | number, revisorId: "" as string | number,
  contatoNome: "", contatoEmail: "", contatoTelefone: "", observacoes: "",
};

export function FormCliente({ aberto, fechar, cliente, aoSalvar }: { aberto: boolean; fechar: () => void; cliente?: Cliente | null; aoSalvar?: (id: number) => void }) {
  const [f, setF] = useState(vazio);
  const [tocouDoc, setTocouDoc] = useState(false);
  const pessoas = trpc.equipe.pessoas.useQuery(undefined, { enabled: aberto });
  const utils = trpc.useUtils();
  const criar = trpc.clientes.criar.useMutation();
  const atualizar = trpc.clientes.atualizar.useMutation();

  useEffect(() => {
    if (!aberto) return;
    setTocouDoc(false);
    setF(cliente ? {
      razaoSocial: cliente.razaoSocial, nomeFantasia: cliente.nomeFantasia ?? "", documento: formatarDocumento(cliente.documento),
      inscricaoEstadual: cliente.inscricaoEstadual ?? "", inscricaoMunicipal: cliente.inscricaoMunicipal ?? "", uf: cliente.uf, municipio: cliente.municipio,
      regime: cliente.regime, atividades: cliente.atividades as Atividade[], responsavelId: cliente.responsavelId ?? "", revisorId: cliente.revisorId ?? "",
      contatoNome: cliente.contatoNome ?? "", contatoEmail: cliente.contatoEmail ?? "", contatoTelefone: cliente.contatoTelefone ?? "", observacoes: cliente.observacoes ?? "",
    } : vazio);
  }, [aberto, cliente?.id]);

  const set = <K extends keyof typeof vazio>(k: K, v: (typeof vazio)[K]) => setF(a => ({ ...a, [k]: v }));
  const doc = validarDocumento(f.documento);
  const erroDoc = tocouDoc && f.documento && !doc.ok ? doc.erro : null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setTocouDoc(true);
    if (!doc.ok) return;
    const dados = {
      ...f,
      documento: limparDocumento(f.documento),
      responsavelId: f.responsavelId ? Number(f.responsavelId) : null,
      revisorId: f.revisorId ? Number(f.revisorId) : null,
      uf: f.uf as (typeof UFS)[number],
    };
    try {
      const salvo = cliente ? await atualizar.mutateAsync({ id: cliente.id, ...dados }) : await criar.mutateAsync(dados);
      toast.success(cliente ? "Cadastro atualizado" : "Cliente cadastrado", { description: cliente ? undefined : "Gere as obrigações da competência para ele na tela do cliente." });
      utils.clientes.invalidate();
      utils.painel.invalidate();
      fechar();
      aoSalvar?.(salvo.id);
    } catch { /* toast global */ }
  }

  const salvando = criar.isPending || atualizar.isPending;
  return (
    <Modal aberto={aberto} fechar={fechar} largo sobretitulo={cliente ? "Editar cadastro" : "Novo cliente"} titulo={cliente ? cliente.razaoSocial : "Cadastrar empresa"}
      descricao="Regime, UF, município e atividade definem quais obrigações o sistema gera todo mês."
      rodape={<><button type="button" className="botao botao-secundario" onClick={fechar}>Cancelar</button><button form="form-cliente" className="botao botao-primario" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button></>}>
      <form id="form-cliente" className="form" onSubmit={salvar}>
        <Campo rotulo="Razão social *" inteiro><input required value={f.razaoSocial} onChange={e => set("razaoSocial", e.target.value)} /></Campo>
        <Campo rotulo="CNPJ ou CPF *" erro={erroDoc} dica={doc.ok ? `${doc.tipo} válido` : "Aceita CNPJ numérico ou alfanumérico (novo formato)"}>
          <input required value={f.documento} aria-invalid={!!erroDoc} onBlur={() => { setTocouDoc(true); if (doc.ok) set("documento", formatarDocumento(doc.numero)); }} onChange={e => set("documento", e.target.value.toUpperCase())} placeholder="00.000.000/0000-00" className="mono" />
        </Campo>
        <Campo rotulo="Nome fantasia"><input value={f.nomeFantasia} onChange={e => set("nomeFantasia", e.target.value)} /></Campo>
        <Campo rotulo="Regime tributário *">
          <select value={f.regime} onChange={e => set("regime", e.target.value as Regime)}>{REGIMES.map(r => <option key={r} value={r}>{REGIME_LABEL[r]}</option>)}</select>
        </Campo>
        <div className="campo"><span>Atividades</span>
          <div className="opcoes">{ATIVIDADES.map(a => (
            <label key={a} className="opcao"><input type="checkbox" checked={f.atividades.includes(a)} onChange={e => set("atividades", e.target.checked ? [...f.atividades, a] : f.atividades.filter(x => x !== a))} />{ATIVIDADE_LABEL[a]}</label>
          ))}</div>
        </div>
        <Campo rotulo="UF *"><select value={f.uf} onChange={e => set("uf", e.target.value)}>{UFS.map(u => <option key={u}>{u}</option>)}</select></Campo>
        <Campo rotulo="Município *"><input required value={f.municipio} onChange={e => set("municipio", e.target.value)} placeholder="Ex.: Goiânia" /></Campo>
        <Campo rotulo="Inscrição estadual"><input value={f.inscricaoEstadual} onChange={e => set("inscricaoEstadual", e.target.value)} className="mono" /></Campo>
        <Campo rotulo="Inscrição municipal"><input value={f.inscricaoMunicipal} onChange={e => set("inscricaoMunicipal", e.target.value)} className="mono" /></Campo>
        <Campo rotulo="Responsável no fiscal">
          <select value={f.responsavelId} onChange={e => set("responsavelId", e.target.value)}><option value="">— sem responsável —</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </Campo>
        <Campo rotulo="Revisor (conferência)">
          <select value={f.revisorId} onChange={e => set("revisorId", e.target.value)}><option value="">— sem revisor —</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </Campo>
        <Campo rotulo="Contato no cliente"><input value={f.contatoNome} onChange={e => set("contatoNome", e.target.value)} placeholder="Nome e setor" /></Campo>
        <Campo rotulo="E-mail do contato"><input type="email" value={f.contatoEmail} onChange={e => set("contatoEmail", e.target.value)} /></Campo>
        <Campo rotulo="Telefone / WhatsApp"><input value={f.contatoTelefone} onChange={e => set("contatoTelefone", e.target.value)} /></Campo>
        <Campo rotulo="Observações internas" inteiro><textarea value={f.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Particularidades do cliente, benefícios fiscais, regimes especiais…" /></Campo>
      </form>
    </Modal>
  );
}
