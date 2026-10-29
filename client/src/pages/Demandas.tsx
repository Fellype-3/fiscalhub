import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { AlertTriangle, Download, Inbox, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc, type Saidas } from "@/lib/trpc";
import { Avatar, Cabecalho, Campo, Carregando, Chip, ChipDemanda, ChipPrioridade, ErroCarga, Gaveta, Modal, Vazio } from "@/components/ui";
import { Envio } from "@/components/Envio";
import { bytes, dataBR, dataCurta, dataHoraBR, diasEntre, hojeLocal, prazoRelativo } from "@/lib/formato";
import { urlDownload } from "@/lib/arquivos";
import { CATEGORIA_DOC_LABEL, PRIORIDADES, PRIORIDADE_LABEL, STATUS_DEMANDA, STATUS_DEMANDA_ABERTOS, STATUS_DEMANDA_LABEL, TIPOS_DEMANDA, TIPO_DEMANDA_LABEL, type StatusDemanda, type TipoDemanda } from "@shared/dominio";

type Demanda = Saidas["demandas"]["listar"][number];

const COLUNAS: { titulo: string; status: StatusDemanda[] }[] = [
  { titulo: "Novas", status: ["nova"] },
  { titulo: "Em andamento", status: ["em_andamento"] },
  { titulo: "Aguardando terceiros", status: ["aguardando_cliente", "aguardando_orgao"] },
  { titulo: "Concluídas (30 dias)", status: ["concluida", "cancelada"] },
];

/** Passou da metade do prazo (legal, ou interno se não houver legal)? */
export function emAlerta(d: { recebidaEm: string; prazoLegal: string | null; prazoInterno: string }, hoje: string) {
  const limite = d.prazoLegal ?? d.prazoInterno;
  return diasEntre(d.recebidaEm, hoje) >= Math.max(1, diasEntre(d.recebidaEm, limite)) / 2;
}

export default function Demandas() {
  const params = new URLSearchParams(useSearch());
  const [aberta, setAberta] = useState<number | null>(params.get("id") ? Number(params.get("id")) : null);
  const [nova, setNova] = useState(false);
  const [visao, setVisao] = useState<"quadro" | "lista">("quadro");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const pessoas = trpc.equipe.pessoas.useQuery();
  const lista = trpc.demandas.listar.useQuery({ tipo: (tipo || undefined) as TipoDemanda | undefined, responsavelId: responsavelId ? Number(responsavelId) : undefined });
  const hoje = hojeLocal();
  const limiteConcluidas = new Date(Date.now() - 30 * 86400000);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (lista.data ?? []).filter(d => (!q || `${d.titulo} ${d.cliente} ${d.origem}`.toLowerCase().includes(q))
      && (STATUS_DEMANDA_ABERTOS.includes(d.status) || (d.concluidaEm && new Date(d.concluidaEm) > limiteConcluidas)));
  }, [lista.data, busca]);
  const vencidas = filtradas.filter(d => STATUS_DEMANDA_ABERTOS.includes(d.status) && d.prazoInterno < hoje);

  return (
    <>
      <Cabecalho sobretitulo="Demandas variáveis" titulo="Central de demandas"
        descricao="Notificações, certidões, parcelamentos, consultas e retificações: entrada única, com dono, prazo legal e prazo interno."
        acoes={<button className="botao botao-primario" onClick={() => setNova(true)}><Plus size={16} /> Registrar demanda</button>} />

      {vencidas.length > 0 && (
        <div className="aviso aviso-coral"><AlertTriangle size={16} /><div><strong>{vencidas.length} demanda(s) com prazo interno vencido:</strong> {vencidas.slice(0, 4).map(d => d.titulo).join(" · ")}{vencidas.length > 4 ? "…" : ""}</div></div>
      )}

      <section className="filtros">
        <div className="busca"><Search size={16} /><input aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Título, cliente ou órgão" /></div>
        <div className="filtro"><label htmlFor="d-tipo">Tipo</label><select id="d-tipo" value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos</option>{TIPOS_DEMANDA.map(t => <option key={t} value={t}>{TIPO_DEMANDA_LABEL[t]}</option>)}</select></div>
        <div className="filtro"><label htmlFor="d-resp">Responsável</label><select id="d-resp" value={responsavelId} onChange={e => setResponsavelId(e.target.value)}><option value="">Todos</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        <div className="alternador" style={{ marginLeft: "auto" }} role="group" aria-label="Visão">
          <button className={visao === "quadro" ? "ativo" : ""} onClick={() => setVisao("quadro")}>Quadro</button>
          <button className={visao === "lista" ? "ativo" : ""} onClick={() => setVisao("lista")}>Lista</button>
        </div>
      </section>

      {lista.isLoading ? <Carregando /> : lista.error ? <ErroCarga erro={lista.error} /> : !lista.data?.length ? (
        <article className="painel"><Vazio titulo="Nenhuma demanda registrada" texto="Regra sugerida: toda notificação ou pedido do cliente entra aqui no mesmo dia, com prazo interno antes do prazo legal." acao={<button className="botao botao-primario" onClick={() => setNova(true)}><Plus size={16} /> Registrar a primeira</button>} /></article>
      ) : visao === "quadro" ? (
        <div className="kanban">
          {COLUNAS.map(col => {
            const itens = filtradas.filter(d => col.status.includes(d.status));
            return (
              <section className="coluna" key={col.titulo} aria-label={col.titulo}>
                <h3><span>{col.titulo}</span><span className="mono">{itens.length}</span></h3>
                {itens.map(d => <CartaoDemanda key={d.id} d={d} hoje={hoje} abrir={() => setAberta(d.id)} />)}
              </section>
            );
          })}
        </div>
      ) : (
        <article className="painel">
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Demanda</th><th>Cliente</th><th>Prazo interno</th><th>Prazo legal</th><th>Status</th><th>Responsável</th></tr></thead>
              <tbody>{filtradas.map(d => {
                const p = prazoRelativo(d.prazoInterno, hoje); const ab = STATUS_DEMANDA_ABERTOS.includes(d.status);
                return (
                  <tr key={d.id} className="clicavel" onClick={() => setAberta(d.id)} tabIndex={0} onKeyDown={e => e.key === "Enter" && setAberta(d.id)}>
                    <td><strong>{d.titulo}</strong><span className="sub">{TIPO_DEMANDA_LABEL[d.tipo]} · {d.origem}</span></td>
                    <td>{d.cliente}</td>
                    <td><strong className={ab ? p.classe : ""}>{dataBR(d.prazoInterno)}</strong>{ab && <span className={`sub ${p.classe}`}>{p.texto}</span>}</td>
                    <td>{dataBR(d.prazoLegal)}</td>
                    <td><ChipDemanda status={d.status} /></td>
                    <td>{d.responsavel ?? <span className="atrasado">Sem dono</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </article>
      )}

      <GavetaDemanda id={aberta} fechar={() => setAberta(null)} />
      <ModalNovaDemanda aberto={nova} fechar={() => setNova(false)} aoCriar={setAberta} />
    </>
  );
}

function CartaoDemanda({ d, hoje, abrir }: { d: Demanda; hoje: string; abrir: () => void }) {
  const aberta = STATUS_DEMANDA_ABERTOS.includes(d.status);
  const p = prazoRelativo(d.prazoInterno, hoje);
  const alerta = aberta && d.prazoInterno >= hoje && emAlerta(d, hoje);
  return (
    <button className="cartao" onClick={abrir}>
      <span style={{ display: "flex", gap: 5, marginBottom: 6, flexWrap: "wrap" }}><Chip tom="violeta">{TIPO_DEMANDA_LABEL[d.tipo]}</Chip><ChipPrioridade p={d.prioridade} /></span>
      <strong>{d.titulo}</strong>
      <span className="sub">{d.cliente} · {d.origem}</span>
      <span className="cartao-rodape">
        {aberta ? <span className={p.classe} style={{ fontSize: 12, fontWeight: 700 }}>{dataCurta(d.prazoInterno)} · {p.texto}</span> : <ChipDemanda status={d.status} />}
        {alerta && <Chip tom="ambar" titulo="Passou da metade do prazo">½ prazo</Chip>}
        {d.status === "aguardando_cliente" || d.status === "aguardando_orgao" ? <ChipDemanda status={d.status} /> : null}
        {d.responsavel ? <Avatar nome={d.responsavel} id={d.responsavelId} /> : <span className="atrasado" style={{ fontSize: 12 }}>Sem dono</span>}
      </span>
    </button>
  );
}

function GavetaDemanda({ id, fechar }: { id: number | null; fechar: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.demandas.obter.useQuery({ id: id! }, { enabled: !!id });
  const pessoas = trpc.equipe.pessoas.useQuery();
  const [texto, setTexto] = useState("");
  const recarregar = () => { utils.demandas.invalidate(); utils.painel.invalidate(); };
  const atualizar = trpc.demandas.atualizar.useMutation({ onSuccess: () => { toast.success("Demanda atualizada"); recarregar(); } });
  const comentar = trpc.demandas.comentar.useMutation({ onSuccess: () => { setTexto(""); recarregar(); } });
  useEffect(() => setTexto(""), [id]);
  const d = q.data?.demanda;
  const hoje = hojeLocal();

  return (
    <Gaveta aberta={!!id} fechar={fechar} sobretitulo={d ? `${TIPO_DEMANDA_LABEL[d.tipo]} · ${d.origem}` : "Demanda"} titulo={d?.titulo ?? "Carregando…"}
      extra={q.data && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><ChipDemanda status={d!.status} /><Link className="botao-texto" href={`/clientes/${q.data.cliente.id}`}>{q.data.cliente.razaoSocial}</Link></div>}>
      {d && q.data && (
        <>
          {STATUS_DEMANDA_ABERTOS.includes(d.status) && d.prazoInterno >= hoje && emAlerta(d, hoje) && (
            <div className="aviso aviso-ambar"><AlertTriangle size={16} /><div>Passou da metade do prazo{d.prazoLegal ? " legal" : ""}. Priorize ou registre o andamento.</div></div>
          )}
          <dl className="dados">
            <dt>Recebida em</dt><dd>{dataBR(d.recebidaEm)}</dd>
            <dt>Prazo legal</dt><dd>{d.prazoLegal ? <><strong>{dataBR(d.prazoLegal)}</strong> · {prazoRelativo(d.prazoLegal, hoje).texto}</> : "Sem prazo legal"}</dd>
            <dt>Prazo interno</dt><dd><strong className={prazoRelativo(d.prazoInterno, hoje).classe}>{dataBR(d.prazoInterno)}</strong></dd>
            {d.concluidaEm && <><dt>Concluída em</dt><dd>{dataHoraBR(d.concluidaEm)}</dd></>}
          </dl>
          {d.descricao && <p style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{d.descricao}</p>}

          <div className="secao"><h3>Status</h3>
            <div className="opcoes">{STATUS_DEMANDA.map(s => (
              <button key={s} className={`botao botao-pequeno ${d.status === s ? "botao-primario" : "botao-secundario"}`} aria-pressed={d.status === s} onClick={() => d.status !== s && atualizar.mutate({ id: d.id, status: s })}>{STATUS_DEMANDA_LABEL[s]}</button>
            ))}</div>
          </div>
          <div className="secao form">
            <Campo rotulo="Responsável"><select value={d.responsavelId ?? ""} onChange={e => atualizar.mutate({ id: d.id, responsavelId: e.target.value ? Number(e.target.value) : null })}><option value="">— sem dono —</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
            <Campo rotulo="Prioridade"><select value={d.prioridade} onChange={e => atualizar.mutate({ id: d.id, prioridade: e.target.value as any })}>{PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}</select></Campo>
            <Campo rotulo="Prazo interno"><input type="date" value={d.prazoInterno} onChange={e => e.target.value && atualizar.mutate({ id: d.id, prazoInterno: e.target.value })} /></Campo>
            <Campo rotulo="Prazo legal"><input type="date" value={d.prazoLegal ?? ""} onChange={e => atualizar.mutate({ id: d.id, prazoLegal: e.target.value || null })} /></Campo>
          </div>

          <div className="secao"><h3>Andamento</h3>
            {q.data.comentarios.map(c => <div className="comentario" key={c.id}><small>{c.usuario} · {dataHoraBR(c.criadoEm)}</small>{c.texto}</div>)}
            <form onSubmit={e => { e.preventDefault(); if (texto.trim()) comentar.mutate({ demandaId: d.id, texto }); }} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <label className="campo" style={{ flex: 1 }}><span className="sr-only">Registrar andamento</span><textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Registrar andamento, contato feito, protocolo…" style={{ minHeight: 60 }} /></label>
              <button className="botao botao-primario" disabled={!texto.trim() || comentar.isPending} aria-label="Registrar"><Send size={15} /></button>
            </form>
          </div>

          <div className="secao"><h3>Anexos ({q.data.documentos.length})</h3>
            {q.data.documentos.map(doc => (
              <div className="linha-simples" key={doc.id}>
                <div className="cresce"><strong>{doc.nomeOriginal}</strong><span>{CATEGORIA_DOC_LABEL[doc.categoria]} · {bytes(doc.tamanho)} · {dataHoraBR(doc.criadoEm)}</span></div>
                <a className="botao-icone" href={urlDownload(doc.id)} aria-label={`Baixar ${doc.nomeOriginal}`}><Download size={16} /></a>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <Envio campos={{ clienteId: d.clienteId, demandaId: d.id, categoria: d.tipo === "notificacao" ? "notificacao" : d.tipo === "certidao" ? "certidao" : "outro" }} texto="Anexar notificação, resposta ou protocolo" aoConcluir={recarregar} />
            </div>
          </div>

          <div className="secao"><h3>Histórico</h3>
            {q.data.historico.map(h => <div className="linha-simples" key={h.id}><div className="cresce"><strong style={{ fontWeight: 600, whiteSpace: "normal" }}>{h.resumo}</strong><span>{h.usuario ?? "Sistema"} · {dataHoraBR(h.criadoEm)}</span></div></div>)}
          </div>
        </>
      )}
    </Gaveta>
  );
}

function ModalNovaDemanda({ aberto, fechar, aoCriar }: { aberto: boolean; fechar: () => void; aoCriar: (id: number) => void }) {
  const utils = trpc.useUtils();
  const clientes = trpc.clientes.listar.useQuery(undefined, { enabled: aberto });
  const pessoas = trpc.equipe.pessoas.useQuery(undefined, { enabled: aberto });
  const inicial = () => ({ clienteId: "", tipo: "notificacao" as TipoDemanda, origem: "", titulo: "", descricao: "", recebidaEm: hojeLocal(), prazoLegal: "", prazoInterno: "", prioridade: "normal", responsavelId: "" });
  const [f, setF] = useState(inicial);
  const criar = trpc.demandas.criar.useMutation({
    onSuccess: d => { toast.success("Demanda registrada"); utils.demandas.invalidate(); utils.painel.invalidate(); fechar(); setF(inicial()); aoCriar(d.id); },
  });
  // Sugere prazo interno na metade do prazo legal
  useEffect(() => {
    if (f.prazoLegal && !f.prazoInterno && f.recebidaEm) {
      const metade = Math.floor(diasEntre(f.recebidaEm, f.prazoLegal) / 2);
      const d = new Date(`${f.recebidaEm}T12:00:00`); d.setDate(d.getDate() + Math.max(0, metade));
      setF(a => ({ ...a, prazoInterno: d.toLocaleDateString("sv-SE") }));
    }
  }, [f.prazoLegal]);

  return (
    <Modal aberto={aberto} fechar={fechar} largo sobretitulo="Nova demanda" titulo="Registrar demanda" descricao="Anexe o documento recebido depois de salvar. Sugestão: prazo interno na metade do prazo legal."
      rodape={<><button className="botao botao-secundario" onClick={fechar}>Cancelar</button><button form="form-demanda" className="botao botao-primario" disabled={criar.isPending}>Registrar</button></>}>
      <form id="form-demanda" className="form" onSubmit={e => { e.preventDefault(); criar.mutate({ ...f, clienteId: Number(f.clienteId), prazoLegal: f.prazoLegal || null, prioridade: f.prioridade as any, responsavelId: f.responsavelId ? Number(f.responsavelId) : null, descricao: f.descricao || undefined }); }}>
        <Campo rotulo="Cliente *"><select required value={f.clienteId} onChange={e => setF({ ...f, clienteId: e.target.value })}><option value="">Selecione</option>{clientes.data?.map(c => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}</select></Campo>
        <Campo rotulo="Tipo *"><select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value as TipoDemanda })}>{TIPOS_DEMANDA.map(t => <option key={t} value={t}>{TIPO_DEMANDA_LABEL[t]}</option>)}</select></Campo>
        <Campo rotulo="Resumo *" inteiro><input required value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Notificação de divergência na EFD" /></Campo>
        <Campo rotulo="Origem *" dica="Órgão ou quem pediu"><input required list="origens" value={f.origem} onChange={e => setF({ ...f, origem: e.target.value })} placeholder="SEFAZ-GO, Receita Federal, Prefeitura, Cliente…" />
          <datalist id="origens"><option>SEFAZ-GO</option><option>SEFAZ-SP</option><option>SEFAZ-DF</option><option>SEFAZ-TO</option><option>Receita Federal (e-CAC)</option><option>Prefeitura</option><option>PGFN</option><option>Cliente (e-mail)</option><option>Cliente (WhatsApp)</option><option>Interno</option></datalist>
        </Campo>
        <Campo rotulo="Recebida em *"><input type="date" required value={f.recebidaEm} onChange={e => setF({ ...f, recebidaEm: e.target.value })} /></Campo>
        <Campo rotulo="Prazo legal" dica="O prazo informado no documento recebido"><input type="date" value={f.prazoLegal} onChange={e => setF({ ...f, prazoLegal: e.target.value })} /></Campo>
        <Campo rotulo="Prazo interno *"><input type="date" required value={f.prazoInterno} onChange={e => setF({ ...f, prazoInterno: e.target.value })} /></Campo>
        <Campo rotulo="Prioridade"><select value={f.prioridade} onChange={e => setF({ ...f, prioridade: e.target.value })}>{PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}</select></Campo>
        <Campo rotulo="Responsável" dica="Vazio = responsável do cliente"><select value={f.responsavelId} onChange={e => setF({ ...f, responsavelId: e.target.value })}><option value="">Responsável do cliente</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        <Campo rotulo="Detalhes" inteiro><textarea value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} /></Campo>
      </form>
    </Modal>
  );
}
