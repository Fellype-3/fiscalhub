import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Building2, Plus, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Avatar, Cabecalho, Carregando, Chip, ErroCarga, Vazio } from "@/components/ui";
import { FormCliente } from "@/components/FormCliente";
import { formatarDocumento } from "@shared/documento";
import { REGIMES, REGIME_LABEL, UFS } from "@shared/dominio";

const TOM_REGIME: Record<string, string> = { simples: "lima", presumido: "azul", real: "violeta", mei: "ambar" };

export default function Clientes() {
  const [, navegar] = useLocation();
  const params = new URLSearchParams(useSearch());
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState(params.get("uf") ?? "");
  const [regime, setRegime] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [novo, setNovo] = useState(false);
  const pessoas = trpc.equipe.pessoas.useQuery();
  const lista = trpc.clientes.listar.useQuery({ busca, uf: uf || undefined, regime: regime || undefined, responsavelId: responsavelId ? Number(responsavelId) : undefined, incluirInativos });
  const nomePessoa = (id: number | null) => pessoas.data?.find(p => p.id === id)?.nome;

  return (
    <>
      <Cabecalho sobretitulo="Carteira" titulo="Clientes" descricao="Cadastro que alimenta o calendário: regime, UF, município, atividade e responsáveis."
        acoes={<button className="botao botao-primario" onClick={() => setNovo(true)}><Plus size={16} /> Novo cliente</button>} />
      <section className="filtros">
        <div className="busca"><Search size={16} /><input aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ ou município" /></div>
        <div className="filtro"><label htmlFor="f-uf">UF</label><select id="f-uf" value={uf} onChange={e => setUf(e.target.value)}><option value="">Todas</option>{UFS.map(u => <option key={u}>{u}</option>)}</select></div>
        <div className="filtro"><label htmlFor="f-reg">Regime</label><select id="f-reg" value={regime} onChange={e => setRegime(e.target.value)}><option value="">Todos</option>{REGIMES.map(r => <option key={r} value={r}>{REGIME_LABEL[r]}</option>)}</select></div>
        <div className="filtro"><label htmlFor="f-resp">Responsável</label><select id="f-resp" value={responsavelId} onChange={e => setResponsavelId(e.target.value)}><option value="">Todos</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        <label className="filtro" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={incluirInativos} onChange={e => setIncluirInativos(e.target.checked)} /> Inativos</label>
      </section>

      <article className="painel">
        {lista.isLoading ? <Carregando /> : lista.error ? <ErroCarga erro={lista.error} /> : !lista.data?.length ? (
          <Vazio titulo={busca || uf || regime ? "Nenhum cliente encontrado com esses filtros" : "Nenhum cliente cadastrado"} texto="Cadastre a empresa com regime, UF e município: o sistema usa esses dados para gerar as obrigações do mês."
            acao={<button className="botao botao-primario" onClick={() => setNovo(true)}><Plus size={16} /> Cadastrar a primeira empresa</button>} icone={<Building2 size={28} />} />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Empresa</th><th>Local</th><th>Regime</th><th className="ocultar-movel">Responsável</th><th>Pendências</th></tr></thead>
              <tbody>
                {lista.data.map(c => (
                  <tr key={c.id} className="clicavel" onClick={() => navegar(`/clientes/${c.id}`)} tabIndex={0} onKeyDown={e => e.key === "Enter" && navegar(`/clientes/${c.id}`)}>
                    <td>
                      <div className="empresa">
                        <span className={`empresa-icone chip-${TOM_REGIME[c.regime]}`}><Building2 size={16} /></span>
                        <div style={{ minWidth: 0 }}><strong>{c.razaoSocial}</strong><span className="sub mono">{formatarDocumento(c.documento)}</span></div>
                        {!c.ativo && <Chip>Inativo</Chip>}
                      </div>
                    </td>
                    <td>{c.municipio} · <strong>{c.uf}</strong></td>
                    <td><Chip tom={TOM_REGIME[c.regime]}>{REGIME_LABEL[c.regime]}</Chip></td>
                    <td className="ocultar-movel">{c.responsavelId ? <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}><Avatar nome={nomePessoa(c.responsavelId)} id={c.responsavelId} />{nomePessoa(c.responsavelId)}</span> : <span className="atrasado">Sem responsável</span>}</td>
                    <td>
                      <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>
                        {c.pendencias.vencidas > 0 && <Chip tom="coral">{c.pendencias.vencidas} vencida(s)</Chip>}
                        {c.pendencias.aguardandoCliente > 0 && <Chip tom="ambar">{c.pendencias.aguardandoCliente} aguardando cliente</Chip>}
                        {!c.pendencias.vencidas && !c.pendencias.aguardandoCliente && <Chip tom="lima">Em dia</Chip>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lista.data && lista.data.length > 0 && <div className="painel-rodape"><span>{lista.data.length} cliente(s)</span></div>}
      </article>
      <FormCliente aberto={novo} fechar={() => setNovo(false)} aoSalvar={id => navegar(`/clientes/${id}`)} />
    </>
  );
}
