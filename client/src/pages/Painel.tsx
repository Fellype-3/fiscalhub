import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowUpRight, CalendarCheck2, Inbox, Info, Paperclip, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Avatar, Cabecalho, Carregando, ChipPrioridade, ErroCarga, Vazio } from "@/components/ui";
import { comp, dataCurta, prazoRelativo, tempoAtras } from "@/lib/formato";
import { STATUS_DEMANDA_LABEL, STATUS_TAREFA_LABEL } from "@shared/dominio";
import { deslocarCompetencia, nomeCompetencia } from "@shared/competencia";

const UF_NOME: Record<string, string> = { GO: "Goiás", SP: "São Paulo", DF: "Distrito Federal", TO: "Tocantins", MG: "Minas Gerais", MT: "Mato Grosso", MS: "Mato Grosso do Sul", BA: "Bahia", RJ: "Rio de Janeiro", PR: "Paraná" };

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default function Painel() {
  const [somenteMeus, setSomenteMeus] = useState(false);
  const [competencia, setCompetencia] = useState<string | undefined>();
  const eu = trpc.auth.eu.useQuery();
  const resumo = trpc.painel.resumo.useQuery({ somenteMeus, competencia });
  const utils = trpc.useUtils();
  const gerar = trpc.tarefas.gerar.useMutation({
    onSuccess: r => {
      toast.success(`${r.criadas} obrigações geradas para ${comp(r.competencia)}`, { description: r.regrasIncompletas.length ? `${r.regrasIncompletas.length} regra(s) sem prazo definido ficaram de fora.` : undefined });
      utils.invalidate();
    },
  });

  if (resumo.isLoading) return <Carregando />;
  if (resumo.error) return <ErroCarga erro={resumo.error} tentar={() => resumo.refetch()} />;
  const r = resumo.data!;
  const pct = r.fechamento.total ? Math.round((r.fechamento.entregues / r.fechamento.total) * 100) : 0;
  const hojeTexto = new Date(`${r.hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const opcoesComp = [0, -1, -2, 1].map(n => deslocarCompetencia(r.competencia, n));

  return (
    <>
      <Cabecalho
        sobretitulo={hojeTexto}
        titulo={`${saudacao()}, ${eu.data?.nome.split(" ")[0] ?? "equipe"}.`}
        descricao={<>Fechamento de <strong>{nomeCompetencia(r.competencia)}</strong>: o que vence, quem cuida e o que falta.</>}
        acoes={<>
          <div className="alternador" role="group" aria-label="Escopo">
            <button className={!somenteMeus ? "ativo" : ""} onClick={() => setSomenteMeus(false)}>Toda a equipe</button>
            <button className={somenteMeus ? "ativo" : ""} onClick={() => setSomenteMeus(true)}>Só os meus</button>
          </div>
          <label className="filtro" style={{ border: "1px solid var(--linha)", borderRadius: 7, background: "#fff" }}>
            <span className="sr-only">Competência</span>
            <select value={competencia ?? r.competencia} onChange={e => setCompetencia(e.target.value)} aria-label="Competência">
              {[...new Set(opcoesComp)].sort().reverse().map(c => <option key={c} value={c}>Competência {comp(c)}</option>)}
            </select>
          </label>
        </>}
      />

      {!r.competenciaGerada && (
        <div className="aviso aviso-azul">
          <Info size={16} />
          <div>As obrigações de <strong>{comp(r.competencia)}</strong> ainda não foram geradas.{" "}
            <button className="botao-texto" onClick={() => gerar.mutate({ competencia: r.competencia, simular: false })} disabled={gerar.isPending}>
              {gerar.isPending ? "Gerando…" : `Gerar obrigações de ${comp(r.competencia)} agora`}
            </button>
          </div>
        </div>
      )}
      {r.regras.semRevisao > 0 && (
        <div className="aviso aviso-ambar">
          <AlertTriangle size={16} />
          <div><strong>{r.regras.semRevisao} regra(s) de prazo aguardam revisão do contador</strong>{r.regras.incompletas ? ` (${r.regras.incompletas} ainda sem dia de vencimento)` : ""}. As obrigações geradas por elas aparecem com ⚠ até a revisão. <Link href="/regras">Revisar regras</Link></div>
        </div>
      )}

      <section className="grade-metricas">
        <Link href="/obrigacoes" className="metrica metrica-destaque">
          <div className="metrica-topo"><span>Fechamento {comp(r.competencia)}</span><CalendarCheck2 size={17} /></div>
          <div className="metrica-numero">{pct}<small>%</small></div>
          <div className="barra"><i style={{ width: `${pct}%` }} /></div>
          <div className="metrica-rodape" style={{ marginTop: 10 }}>
            <span>{r.fechamento.entregues} de {r.fechamento.total} obrigações entregues</span>
            <span>{r.fechamento.entregues ? `${Math.round((r.fechamento.noPrazo / r.fechamento.entregues) * 100)}% no prazo` : ""}</span>
          </div>
        </Link>
        <Link href="/obrigacoes?vencidas=1" className={`metrica ${r.alertas.tarefasVencidas + r.alertas.demandasVencidas ? "metrica-alerta" : ""}`}>
          <div className="metrica-topo"><span>Vencidas</span><AlertTriangle size={17} /></div>
          <div className="metrica-numero">{r.alertas.tarefasVencidas + r.alertas.demandasVencidas}</div>
          <div className="lista-alertas">
            <span><i className="ponto coral" /> {r.alertas.tarefasHoje} vencem hoje</span>
            <span><i className="ponto ambar" /> {r.alertas.tarefasD5} nos próximos 5 dias</span>
          </div>
          <div className="metrica-rodape"><span>{r.alertas.tarefasVencidas} obrigações · {r.alertas.demandasVencidas} demandas</span></div>
        </Link>
        <Link href="/obrigacoes?status=aguardando_cliente" className="metrica">
          <div className="metrica-topo"><span>Aguardando cliente</span><Paperclip size={17} /></div>
          <div className="metrica-numero">{r.alertas.aguardandoCliente}</div>
          <div className="lista-alertas"><span><i className="ponto ambar" /> em {r.alertas.clientesAguardando} cliente(s)</span><span><i className="ponto lima" /> {r.alertas.docsHoje} documento(s) recebido(s) hoje</span></div>
          <div className="metrica-rodape"><span>Cobrar envio pelo portal</span><ArrowUpRight size={14} /></div>
        </Link>
        <Link href="/demandas" className="metrica">
          <div className="metrica-topo"><span>Demandas abertas</span><Inbox size={17} /></div>
          <div className="metrica-numero">{r.alertas.demandasAbertas}</div>
          <div className="lista-alertas">
            <span><i className="ponto coral" /> {r.alertas.demandasVencidas} com prazo interno vencido</span>
            <span><i className="ponto ambar" /> {r.alertas.demandasAlerta} passaram da metade do prazo</span>
          </div>
          <div className="metrica-rodape"><span>{r.alertas.semResponsavel ? `${r.alertas.semResponsavel} item(ns) sem responsável` : "Todos com responsável"}</span></div>
        </Link>
      </section>

      <section className="grade-2">
        <article className="painel">
          <div className="painel-cabeca">
            <div><span className="sobretitulo">Radar de prazos</span><h2>O que precisa de atenção</h2></div>
            <Link href="/obrigacoes" className="botao-texto">Ver obrigações <ArrowUpRight size={14} /></Link>
          </div>
          {r.radar.length === 0 ? <Vazio titulo="Nada vencendo nos próximos 7 dias" texto="Nenhuma obrigação ou demanda aberta com prazo próximo." icone={<Sparkles size={28} />} /> : (
            <div className="radar">
              {r.radar.map(i => {
                const p = prazoRelativo(i.data, r.hoje);
                const href = i.origem === "tarefa" ? `/obrigacoes?tarefa=${i.id}` : `/demandas?id=${i.id}`;
                return (
                  <Link key={`${i.origem}-${i.id}`} href={href} className="radar-linha">
                    <span className={`radar-icone ${i.origem}`} title={i.origem === "tarefa" ? "Obrigação" : "Demanda"}>{i.origem === "tarefa" ? <CalendarCheck2 size={15} /> : <Inbox size={15} />}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="radar-titulo">
                        <strong>{i.titulo}</strong>
                        <ChipPrioridade p={i.prioridade} />
                        {i.alerta && i.origem === "tarefa" && <span title="Regra de prazo ainda não revisada">⚠</span>}
                      </div>
                      <span className="radar-sub">{i.cliente} · {i.uf}{i.competencia ? ` · ${comp(i.competencia)}` : ""} · {i.origem === "tarefa" ? STATUS_TAREFA_LABEL[i.status as keyof typeof STATUS_TAREFA_LABEL] : STATUS_DEMANDA_LABEL[i.status as keyof typeof STATUS_DEMANDA_LABEL]}</span>
                    </div>
                    <div className="radar-pessoa">{i.responsavel ? <><Avatar nome={i.responsavel} /><span>{i.responsavel.split(" ")[0]}</span></> : <span className="atrasado">Sem responsável</span>}</div>
                    <div className="radar-prazo"><strong className={p.classe}>{dataCurta(i.data)}</strong><span className={p.classe}>{p.texto}</span></div>
                  </Link>
                );
              })}
            </div>
          )}
        </article>

        <article className="painel">
          <div className="painel-cabeca"><div><span className="sobretitulo">Cobertura</span><h2>Por estado · {comp(r.competencia)}</h2></div></div>
          <div className="painel-corpo">
            {r.porUf.length === 0 ? <Vazio titulo="Sem clientes ativos" /> : r.porUf.map(u => {
              const p = u.total ? Math.round((u.entregues / u.total) * 100) : 0;
              return (
                <Link key={u.uf} href={`/clientes?uf=${u.uf}`} className="linha-simples" style={{ textDecoration: "none" }}>
                  <span className="chip chip-marinho mono" style={{ width: 34, justifyContent: "center" }}>{u.uf}</span>
                  <div className="cresce"><strong>{UF_NOME[u.uf] ?? u.uf}</strong><span>{u.clientes} cliente(s) · {u.entregues}/{u.total} entregues</span></div>
                  <div style={{ width: 90 }}><div className="barra" style={{ marginTop: 0 }}><i style={{ width: `${p}%` }} /></div></div>
                  <span className="mono" style={{ width: 38, textAlign: "right", color: "var(--suave)" }}>{p}%</span>
                </Link>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grade-2">
        <article className="painel">
          <div className="painel-cabeca"><div><span className="sobretitulo">Equipe</span><h2>Carga por pessoa</h2></div></div>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Pessoa</th><th>Obrigações abertas</th><th>Demandas abertas</th><th>Vencidas</th></tr></thead>
              <tbody>
                {r.porPessoa.map(p => (
                  <tr key={p.id}>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatar nome={p.nome} id={p.id} />{p.nome}</span></td>
                    <td className="mono">{p.abertas}</td><td className="mono">{p.demandas}</td>
                    <td className={`mono ${p.vencidas ? "atrasado" : ""}`}>{p.vencidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="painel">
          <div className="painel-cabeca"><div><span className="sobretitulo">Ritmo da equipe</span><h2>Atividade recente</h2></div><Link href="/historico" className="botao-texto">Histórico <ArrowUpRight size={14} /></Link></div>
          <div className="painel-corpo">
            {r.atividade.length === 0 ? <Vazio titulo="Sem atividade ainda" /> : r.atividade.map(a => (
              <div className="linha-simples" key={a.id}>
                <Avatar nome={a.usuario ?? "Sistema"} />
                <div className="cresce"><strong>{a.usuario ?? "Sistema"}</strong><span title={a.resumo}>{a.resumo}</span></div>
                <small style={{ color: "var(--fraco)", whiteSpace: "nowrap" }}>{tempoAtras(a.criadoEm)}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
