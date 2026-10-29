import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { AlertTriangle, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock3, ListChecks, Paperclip, Plus, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { trpc, type Saidas } from "@/lib/trpc";
import { Avatar, Cabecalho, Campo, Carregando, ChipPrioridade, ChipTarefa, ErroCarga, Gaveta, Modal, Vazio } from "@/components/ui";
import { GavetaTarefa } from "@/components/GavetaTarefa";
import { comp, dataBR, dataCurta, dataHoraBR, hojeLocal, prazoRelativo } from "@/lib/formato";
import { PRIORIDADES, PRIORIDADE_LABEL, STATUS_TAREFA, STATUS_TAREFA_ABERTOS, STATUS_TAREFA_LABEL, UFS, type StatusTarefa } from "@shared/dominio";
import { competenciaEmFechamento, deslocarCompetencia, nomeCompetencia } from "@shared/competencia";

type Tarefa = Saidas["tarefas"]["listar"][number];

export default function Obrigacoes() {
  const params = new URLSearchParams(useSearch());
  const eu = trpc.auth.eu.useQuery();
  const [competencia, setCompetencia] = useState(competenciaEmFechamento());
  const [todasAbertas, setTodasAbertas] = useState(params.has("vencidas") || params.has("status"));
  const [visao, setVisao] = useState<"lista" | "matriz">("lista");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [responsavelId, setResponsavelId] = useState("");
  const [uf, setUf] = useState("");
  const [soVencidas, setSoVencidas] = useState(params.has("vencidas"));
  const [tarefaAberta, setTarefaAberta] = useState<number | null>(params.get("tarefa") ? Number(params.get("tarefa")) : null);
  const [checklistDe, setChecklistDe] = useState<{ clienteId: number; cliente: string } | null>(null);
  const [gerarAberto, setGerarAberto] = useState(false);
  const [novaAberta, setNovaAberta] = useState(false);
  const hoje = hojeLocal();

  const pessoas = trpc.equipe.pessoas.useQuery();
  const lista = trpc.tarefas.listar.useQuery({
    competencia: todasAbertas ? undefined : competencia,
    somenteAbertas: todasAbertas || undefined,
    status: status ? [status as StatusTarefa] : undefined,
    responsavelId: responsavelId ? Number(responsavelId) : undefined,
    uf: uf || undefined,
    vencimentoAte: soVencidas ? deslocarDia(hoje, -1) : undefined,
  });
  const resumoChecklist = trpc.tarefas.resumoChecklist.useQuery({ competencia }, { enabled: !todasAbertas });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let l = lista.data ?? [];
    if (soVencidas) l = l.filter(t => STATUS_TAREFA_ABERTOS.includes(t.status));
    return q ? l.filter(t => `${t.cliente} ${t.titulo}`.toLowerCase().includes(q)) : l;
  }, [lista.data, busca, soVencidas]);

  const contagem = useMemo(() => {
    const l = lista.data ?? [];
    return {
      total: l.filter(t => t.status !== "nao_aplicavel").length,
      entregues: l.filter(t => t.status === "entregue").length,
      vencidas: l.filter(t => STATUS_TAREFA_ABERTOS.includes(t.status) && t.vencimento < hoje).length,
    };
  }, [lista.data]);

  return (
    <>
      <Cabecalho sobretitulo="Rotina fixa" titulo="Obrigações do mês"
        descricao={todasAbertas ? "Todas as obrigações em aberto, de qualquer competência." : <>Competência <strong>{comp(competencia)}</strong> ({nomeCompetencia(competencia)}) · {contagem.entregues}/{contagem.total} entregues{contagem.vencidas ? <span className="atrasado"> · {contagem.vencidas} vencida(s)</span> : null}</>}
        acoes={<>
          <button className="botao botao-secundario" onClick={() => setNovaAberta(true)}><Plus size={16} /> Tarefa avulsa</button>
          <button className="botao botao-primario" onClick={() => setGerarAberto(true)}><Wand2 size={16} /> Gerar obrigações</button>
        </>} />

      <section className="filtros">
        <div className="alternador" role="group" aria-label="Período">
          <button className={!todasAbertas ? "ativo" : ""} onClick={() => setTodasAbertas(false)}>Por competência</button>
          <button className={todasAbertas ? "ativo" : ""} onClick={() => setTodasAbertas(true)}>Todas em aberto</button>
        </div>
        {!todasAbertas && (
          <div className="filtro" style={{ gap: 2 }}>
            <button className="botao-icone" onClick={() => setCompetencia(deslocarCompetencia(competencia, -1))} aria-label="Competência anterior"><ChevronLeft size={16} /></button>
            <strong className="mono" style={{ minWidth: 70, textAlign: "center" }}>{comp(competencia)}</strong>
            <button className="botao-icone" onClick={() => setCompetencia(deslocarCompetencia(competencia, 1))} aria-label="Próxima competência"><ChevronRight size={16} /></button>
          </div>
        )}
        <div className="busca"><Search size={16} /><input aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Cliente ou obrigação" /></div>
        <div className="filtro"><label htmlFor="o-st">Status</label><select id="o-st" value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option>{STATUS_TAREFA.map(s => <option key={s} value={s}>{STATUS_TAREFA_LABEL[s]}</option>)}</select></div>
        <div className="filtro"><label htmlFor="o-resp">Responsável</label><select id="o-resp" value={responsavelId} onChange={e => setResponsavelId(e.target.value)}><option value="">Todos</option>{eu.data && <option value={eu.data.id}>Eu</option>}{pessoas.data?.filter(p => p.id !== eu.data?.id).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
        <div className="filtro"><label htmlFor="o-uf">UF</label><select id="o-uf" value={uf} onChange={e => setUf(e.target.value)}><option value="">Todas</option>{UFS.map(u => <option key={u}>{u}</option>)}</select></div>
        <label className="filtro" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={soVencidas} onChange={e => setSoVencidas(e.target.checked)} /> Só vencidas</label>
        {!todasAbertas && (
          <div className="alternador" role="group" aria-label="Visão" style={{ marginLeft: "auto" }}>
            <button className={visao === "lista" ? "ativo" : ""} onClick={() => setVisao("lista")}>Lista</button>
            <button className={visao === "matriz" ? "ativo" : ""} onClick={() => setVisao("matriz")}>Matriz</button>
          </div>
        )}
      </section>

      <article className="painel">
        {lista.isLoading ? <Carregando /> : lista.error ? <ErroCarga erro={lista.error} /> : filtradas.length === 0 ? (
          <Vazio titulo={lista.data?.length ? "Nada com esses filtros" : `Nenhuma obrigação em ${comp(competencia)}`}
            texto={lista.data?.length ? undefined : "Gere as obrigações da competência a partir do cadastro dos clientes e das regras de prazo."}
            acao={!lista.data?.length && !todasAbertas ? <button className="botao botao-primario" onClick={() => setGerarAberto(true)}><Wand2 size={16} /> Gerar obrigações de {comp(competencia)}</button> : undefined}
            icone={<CalendarPlus size={28} />} />
        ) : visao === "matriz" && !todasAbertas ? (
          <Matriz tarefas={filtradas} hoje={hoje} abrir={setTarefaAberta} abrirChecklist={setChecklistDe} checklist={resumoChecklist.data ?? []} />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Obrigação</th><th>Cliente</th>{todasAbertas && <th>Comp.</th>}<th>Vencimento</th><th>Status</th><th className="ocultar-movel">Responsável</th><th className="ocultar-movel" aria-label="Anexos"><Paperclip size={13} /></th></tr></thead>
              <tbody>
                {filtradas.map(t => {
                  const aberta = STATUS_TAREFA_ABERTOS.includes(t.status);
                  const p = prazoRelativo(t.vencimento, hoje);
                  return (
                    <tr key={t.id} className="clicavel" onClick={() => setTarefaAberta(t.id)} tabIndex={0} onKeyDown={e => e.key === "Enter" && setTarefaAberta(t.id)}>
                      <td><strong>{t.titulo}</strong> {t.regraNaoRevisada && <span title="Regra de prazo ainda não revisada pelo contador">⚠</span>} <ChipPrioridade p={t.prioridade} /></td>
                      <td>{t.cliente}<span className="sub">{t.municipio}/{t.uf}</span></td>
                      {todasAbertas && <td className="mono">{comp(t.competencia)}</td>}
                      <td><strong className={aberta ? p.classe : ""}>{dataBR(t.vencimento)}</strong>{aberta && <span className={`sub ${p.classe}`}>{p.texto}</span>}</td>
                      <td><ChipTarefa status={t.status} /></td>
                      <td className="ocultar-movel">{t.responsavel ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Avatar nome={t.responsavel} id={t.responsavelId} />{t.responsavel.split(" ")[0]}</span> : <span className="atrasado">—</span>}</td>
                      <td className="ocultar-movel mono">{t.anexos || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtradas.length > 0 && <div className="painel-rodape"><span>{filtradas.length} obrigação(ões)</span><span>Clique para ver detalhes, anexar recibo e mudar status</span></div>}
      </article>

      <GavetaTarefa id={tarefaAberta} fechar={() => setTarefaAberta(null)} />
      <GavetaChecklist alvo={checklistDe} competencia={competencia} fechar={() => setChecklistDe(null)} />
      <ModalGerar aberto={gerarAberto} fechar={() => setGerarAberto(false)} competenciaInicial={competencia} aoGerar={c => { setTodasAbertas(false); setCompetencia(c); }} />
      <ModalNovaTarefa aberto={novaAberta} fechar={() => setNovaAberta(false)} competencia={competencia} />
    </>
  );
}

function deslocarDia(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}

/* ── Matriz cliente × obrigação ───────────────────────── */
function Matriz({ tarefas, hoje, abrir, abrirChecklist, checklist }: { tarefas: Tarefa[]; hoje: string; abrir: (id: number) => void; abrirChecklist: (c: { clienteId: number; cliente: string }) => void; checklist: { clienteId: number; total: number; feitos: number }[] }) {
  const colunas = [...new Set(tarefas.filter(t => t.regraId).map(t => t.titulo))].sort();
  const clientes = [...new Map(tarefas.map(t => [t.clienteId, { id: t.clienteId, nome: t.cliente, uf: t.uf }])).values()].sort((a, b) => a.nome.localeCompare(b.nome));
  const icone = (t: Tarefa) => {
    const atrasada = STATUS_TAREFA_ABERTOS.includes(t.status) && t.vencimento < hoje;
    const classe = atrasada ? "st-atrasada" : `st-${t.status}`;
    const Simbolo = t.status === "entregue" ? Check : atrasada ? AlertTriangle : t.status === "aguardando_cliente" ? Paperclip : Clock3;
    return (
      <button className={`celula-status ${classe}`} onClick={() => abrir(t.id)} title={`${t.titulo} · ${STATUS_TAREFA_LABEL[t.status]} · vence ${dataBR(t.vencimento)}`} aria-label={`${t.titulo} de ${t.cliente}: ${atrasada ? "vencida" : STATUS_TAREFA_LABEL[t.status]}`}>
        {t.status === "nao_aplicavel" ? "–" : <Simbolo size={14} />}
      </button>
    );
  };
  return (
    <>
      <div className="tabela-rolagem">
        <table className="tabela matriz">
          <thead><tr><th>Cliente</th><th>Checklist</th>{colunas.map(c => <th key={c} className="obrig">{c}</th>)}<th className="obrig">Outras</th></tr></thead>
          <tbody>
            {clientes.map(c => {
              const ck = checklist.find(x => x.clienteId === c.id);
              const outras = tarefas.filter(t => t.clienteId === c.id && !t.regraId);
              return (
                <tr key={c.id}>
                  <td><strong>{c.nome}</strong><span className="sub">{c.uf}</span></td>
                  <td>
                    <button className="botao botao-secundario botao-pequeno" onClick={() => abrirChecklist({ clienteId: c.id, cliente: c.nome })}>
                      <ListChecks size={14} /> {ck ? `${ck.feitos}/${ck.total}` : "—"}
                    </button>
                  </td>
                  {colunas.map(col => {
                    const t = tarefas.find(x => x.clienteId === c.id && x.titulo === col && x.regraId);
                    return <td key={col} className="celula">{t ? icone(t) : <span style={{ color: "#c8cfd4" }}>·</span>}</td>;
                  })}
                  <td className="celula">{outras.length ? <span style={{ display: "inline-flex", gap: 3 }}>{outras.map(icone)}</span> : <span style={{ color: "#c8cfd4" }}>·</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="legenda">
        <span><i className="celula-status st-entregue" style={{ width: 16, height: 14 }} /> Entregue</span>
        <span><i className="celula-status st-em_andamento" style={{ width: 16, height: 14 }} /> Em andamento</span>
        <span><i className="celula-status st-em_revisao" style={{ width: 16, height: 14 }} /> Em conferência</span>
        <span><i className="celula-status st-aguardando_cliente" style={{ width: 16, height: 14 }} /> Aguardando cliente</span>
        <span><i className="celula-status st-pendente" style={{ width: 16, height: 14 }} /> Pendente</span>
        <span><i className="celula-status st-atrasada" style={{ width: 16, height: 14 }} /> Vencida</span>
        <span>· não se aplica ao cliente</span>
      </div>
    </>
  );
}

/* ── Checklist de fechamento ──────────────────────────── */
function GavetaChecklist({ alvo, competencia, fechar }: { alvo: { clienteId: number; cliente: string } | null; competencia: string; fechar: () => void }) {
  const utils = trpc.useUtils();
  const itens = trpc.tarefas.checklist.useQuery({ clienteId: alvo?.clienteId ?? 0, competencia }, { enabled: !!alvo });
  const marcar = trpc.tarefas.marcarChecklist.useMutation({ onSuccess: () => { utils.tarefas.checklist.invalidate(); utils.tarefas.resumoChecklist.invalidate(); } });
  const feitos = itens.data?.filter(i => i.feitoEm).length ?? 0;
  return (
    <Gaveta aberta={!!alvo} fechar={fechar} sobretitulo={`Checklist de fechamento · ${comp(competencia)}`} titulo={alvo?.cliente ?? ""}
      extra={itens.data && <div className="barra" style={{ maxWidth: 260 }}><i style={{ width: `${itens.data.length ? (feitos / itens.data.length) * 100 : 0}%` }} /></div>}>
      {itens.isLoading ? <Carregando /> : !itens.data?.length ? <Vazio titulo="Sem checklist nesta competência" texto="O checklist é criado junto com as obrigações ao gerar a competência." /> : itens.data.map(i => (
        <label className="check" key={i.id}>
          <input type="checkbox" checked={!!i.feitoEm} disabled={marcar.isPending} onChange={e => marcar.mutate({ id: i.id, feito: e.target.checked })} />
          <span>{i.texto}{i.feitoEm && <small>{i.feitoPor} · {dataHoraBR(i.feitoEm)}</small>}</span>
        </label>
      ))}
    </Gaveta>
  );
}

/* ── Gerar competência ────────────────────────────────── */
function ModalGerar({ aberto, fechar, competenciaInicial, aoGerar }: { aberto: boolean; fechar: () => void; competenciaInicial: string; aoGerar: (c: string) => void }) {
  const utils = trpc.useUtils();
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const [previa, setPrevia] = useState<Saidas["tarefas"]["gerar"] | null>(null);
  const gerar = trpc.tarefas.gerar.useMutation();
  const opcoes = [-2, -1, 0, 1].map(n => deslocarCompetencia(competenciaEmFechamento(), n));

  async function simular(c = competencia) { setPrevia(await gerar.mutateAsync({ competencia: c, simular: true })); }
  async function confirmar() {
    const r = await gerar.mutateAsync({ competencia, simular: false });
    toast.success(`${r.criadas} obrigação(ões) criada(s) em ${comp(competencia)}`, { description: r.checklistsCriados ? `${r.checklistsCriados} checklist(s) de fechamento criado(s).` : undefined });
    utils.tarefas.invalidate(); utils.painel.invalidate();
    aoGerar(competencia);
    fechar(); setPrevia(null);
  }

  return (
    <Modal aberto={aberto} fechar={() => { fechar(); setPrevia(null); }} largo sobretitulo="Gerador de calendário" titulo="Gerar obrigações da competência"
      descricao="Cria, para cada cliente ativo, as obrigações que se aplicam ao regime, UF, município e atividade dele. Rodar de novo não duplica nada."
      rodape={<>
        <button className="botao botao-secundario" onClick={() => { fechar(); setPrevia(null); }}>Cancelar</button>
        {!previa ? <button className="botao botao-primario" onClick={() => simular()} disabled={gerar.isPending}>Ver prévia</button>
          : <button className="botao botao-primario" onClick={confirmar} disabled={gerar.isPending || previa.criadas === 0}>{previa.criadas ? `Criar ${previa.criadas} obrigação(ões)` : "Nada novo para criar"}</button>}
      </>}>
      <div className="form" style={{ marginBottom: 14 }}>
        <Campo rotulo="Competência">
          <select value={competencia} onChange={e => { setCompetencia(e.target.value); setPrevia(null); }}>
            {[...new Set([...opcoes, competenciaInicial])].sort().map(c => <option key={c} value={c}>{comp(c)} — {nomeCompetencia(c)}</option>)}
          </select>
        </Campo>
      </div>
      {previa && (
        <>
          {previa.regrasIncompletas.length > 0 && (
            <div className="aviso aviso-ambar"><AlertTriangle size={16} /><div><strong>{previa.regrasIncompletas.length} regra(s) sem dia de vencimento ficam de fora:</strong> {previa.regrasIncompletas.map(r => r.nome).join(", ")}. Complete em Regras e prazos.</div></div>
          )}
          {previa.semRevisao > 0 && <div className="aviso aviso-azul"><AlertTriangle size={16} /><div>{previa.semRevisao} obrigação(ões) virão de regras ainda não revisadas e aparecerão com ⚠.</div></div>}
          <p style={{ margin: "0 0 8px" }}><strong>{previa.criadas}</strong> nova(s) · {previa.jaExistiam} já existiam · {previa.clientes} cliente(s) ativo(s)</p>
          <div className="tabela-rolagem" style={{ maxHeight: 320 }}>
            <table className="tabela">
              <thead><tr><th>Cliente</th><th>Obrigação</th><th>Vencimento</th><th></th></tr></thead>
              <tbody>{previa.itens.map((i, k) => <tr key={k}><td>{i.cliente}</td><td>{i.obrigacao}</td><td className="mono">{dataCurta(i.vencimento)}</td><td>{i.nova ? <span className="chip chip-lima">nova</span> : <span className="chip">já existe</span>}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ── Tarefa avulsa ────────────────────────────────────── */
function ModalNovaTarefa({ aberto, fechar, competencia }: { aberto: boolean; fechar: () => void; competencia: string }) {
  const utils = trpc.useUtils();
  const clientes = trpc.clientes.listar.useQuery(undefined, { enabled: aberto });
  const pessoas = trpc.equipe.pessoas.useQuery(undefined, { enabled: aberto });
  const [f, setF] = useState({ clienteId: "", titulo: "", vencimento: "", prioridade: "normal", responsavelId: "", observacoes: "" });
  const criar = trpc.tarefas.criar.useMutation({
    onSuccess: () => { toast.success("Tarefa criada"); utils.tarefas.invalidate(); utils.painel.invalidate(); fechar(); setF({ clienteId: "", titulo: "", vencimento: "", prioridade: "normal", responsavelId: "", observacoes: "" }); },
  });
  return (
    <Modal aberto={aberto} fechar={fechar} sobretitulo={`Competência ${comp(competencia)}`} titulo="Tarefa avulsa" descricao="Para rotinas internas ou obrigações que ainda não têm regra (ex.: conferência de notas, obrigação estadual específica)."
      rodape={<><button className="botao botao-secundario" onClick={fechar}>Cancelar</button><button form="form-tarefa" className="botao botao-primario" disabled={criar.isPending}>Criar</button></>}>
      <form id="form-tarefa" className="form" onSubmit={e => { e.preventDefault(); criar.mutate({ clienteId: Number(f.clienteId), titulo: f.titulo, competencia, vencimento: f.vencimento, prioridade: f.prioridade as any, responsavelId: f.responsavelId ? Number(f.responsavelId) : undefined, observacoes: f.observacoes || undefined }); }}>
        <Campo rotulo="Cliente *" inteiro><select required value={f.clienteId} onChange={e => setF({ ...f, clienteId: e.target.value })}><option value="">Selecione</option>{clientes.data?.map(c => <option key={c.id} value={c.id}>{c.razaoSocial} · {c.uf}</option>)}</select></Campo>
        <Campo rotulo="O que precisa ser feito *" inteiro><input required value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Conferência de notas de entrada" /></Campo>
        <Campo rotulo="Prazo *" dica="Prazo legal ou interno"><input type="date" required value={f.vencimento} onChange={e => setF({ ...f, vencimento: e.target.value })} /></Campo>
        <Campo rotulo="Prioridade"><select value={f.prioridade} onChange={e => setF({ ...f, prioridade: e.target.value })}>{PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}</select></Campo>
        <Campo rotulo="Responsável" dica="Vazio = responsável do cliente"><select value={f.responsavelId} onChange={e => setF({ ...f, responsavelId: e.target.value })}><option value="">Responsável do cliente</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        <Campo rotulo="Observações" inteiro><textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} /></Campo>
      </form>
    </Modal>
  );
}
