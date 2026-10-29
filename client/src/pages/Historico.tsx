import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Cabecalho, Carregando, ErroCarga, Vazio } from "@/components/ui";
import { dataHoraBR } from "@/lib/formato";

const ENTIDADES: Record<string, string> = { cliente: "Clientes", tarefa: "Obrigações", demanda: "Demandas", documento: "Documentos", regra: "Regras", usuario: "Acessos", competencia: "Geração de competência", checklist: "Checklist", feriado: "Feriados" };

export default function Historico() {
  const [pagina, setPagina] = useState(0);
  const [clienteId, setClienteId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [entidade, setEntidade] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const clientes = trpc.clientes.listar.useQuery({ incluirInativos: true });
  const pessoas = trpc.equipe.pessoas.useQuery();
  const q = trpc.equipe.historico.useQuery({ pagina, clienteId: clienteId ? Number(clienteId) : undefined, usuarioId: usuarioId ? Number(usuarioId) : undefined, entidade: entidade || undefined, de: de || undefined, ate: ate || undefined });
  const mudar = (fn: () => void) => { fn(); setPagina(0); };

  return (
    <>
      <Cabecalho sobretitulo="Auditoria" titulo="Histórico" descricao="Quem fez o quê e quando: cadastros, mudanças de status, envios e downloads de documentos." />
      <section className="filtros">
        <div className="filtro" style={{ borderLeft: 0 }}><label htmlFor="h-cli">Cliente</label><select id="h-cli" value={clienteId} onChange={e => mudar(() => setClienteId(e.target.value))}><option value="">Todos</option>{clientes.data?.map(c => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}</select></div>
        <div className="filtro"><label htmlFor="h-usu">Pessoa</label><select id="h-usu" value={usuarioId} onChange={e => mudar(() => setUsuarioId(e.target.value))}><option value="">Todas</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        <div className="filtro"><label htmlFor="h-ent">Assunto</label><select id="h-ent" value={entidade} onChange={e => mudar(() => setEntidade(e.target.value))}><option value="">Todos</option>{Object.entries(ENTIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="filtro"><label htmlFor="h-de">De</label><input id="h-de" type="date" value={de} onChange={e => mudar(() => setDe(e.target.value))} /></div>
        <div className="filtro"><label htmlFor="h-ate">Até</label><input id="h-ate" type="date" value={ate} onChange={e => mudar(() => setAte(e.target.value))} /></div>
      </section>
      <article className="painel">
        {q.isLoading ? <Carregando /> : q.error ? <ErroCarga erro={q.error} /> : !q.data!.linhas.length ? <Vazio titulo="Nada registrado com esses filtros" /> : (
          <div className="tabela-rolagem"><table className="tabela">
            <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Cliente</th>{q.data!.linhas.some(l => l.ip) && <th>IP</th>}</tr></thead>
            <tbody>{q.data!.linhas.map(l => (
              <tr key={l.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{dataHoraBR(l.criadoEm)}</td>
                <td>{l.usuario ?? "—"}</td>
                <td>{l.resumo}</td>
                <td>{l.clienteId ? <Link href={`/clientes/${l.clienteId}`} className="botao-texto">{l.cliente ?? `#${l.clienteId}`}</Link> : "—"}</td>
                {q.data!.linhas.some(x => x.ip) && <td className="mono">{l.ip}</td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <div className="painel-rodape">
          <span>Página {pagina + 1}</span>
          <span className="acoes">
            <button className="botao botao-secundario botao-pequeno" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <button className="botao botao-secundario botao-pequeno" disabled={!q.data?.temMais} onClick={() => setPagina(pagina + 1)}>Próxima</button>
          </span>
        </div>
      </article>
    </>
  );
}
