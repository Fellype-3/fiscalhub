import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, Pencil, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Cabecalho, Carregando, Chip, ChipDemanda, ChipTarefa, ErroCarga, Vazio } from "@/components/ui";
import { FormCliente } from "@/components/FormCliente";
import { GavetaTarefa } from "@/components/GavetaTarefa";
import { Envio } from "@/components/Envio";
import { bytes, comp, dataBR, dataHoraBR } from "@/lib/formato";
import { urlDownload } from "@/lib/arquivos";
import { formatarDocumento } from "@shared/documento";
import { ATIVIDADE_LABEL, CATEGORIA_DOC_LABEL, ESFERA_LABEL, REGIME_LABEL, TIPO_DEMANDA_LABEL, type Atividade } from "@shared/dominio";
import { competenciaEmFechamento } from "@shared/competencia";

export default function ClienteDetalhe({ id }: { id: number }) {
  const q = trpc.clientes.obter.useQuery({ id });
  const pessoas = trpc.equipe.pessoas.useQuery();
  const utils = trpc.useUtils();
  const [aba, setAba] = useState<"obrigacoes" | "regras" | "demandas" | "documentos" | "historico">("obrigacoes");
  const [editar, setEditar] = useState(false);
  const [tarefa, setTarefa] = useState<number | null>(null);
  const definir = trpc.clientes.definirRegra.useMutation({ onSuccess: () => { utils.clientes.obter.invalidate(); toast.success("Obrigações do cliente atualizadas"); } });
  const gerar = trpc.tarefas.gerar.useMutation({
    onSuccess: r => { toast.success(`${r.criadas} obrigação(ões) gerada(s) em ${comp(r.competencia)}`); utils.clientes.obter.invalidate(); utils.tarefas.invalidate(); utils.painel.invalidate(); },
  });
  const ativar = trpc.clientes.atualizar.useMutation({ onSuccess: () => { utils.clientes.invalidate(); toast.success("Situação do cliente atualizada"); } });

  if (q.isLoading) return <Carregando />;
  if (q.error) return <ErroCarga erro={q.error} tentar={() => q.refetch()} />;
  const { cliente: c, regras, tarefas, demandas, documentos, historico } = q.data!;
  const nome = (pid: number | null) => pessoas.data?.find(p => p.id === pid)?.nome ?? "—";
  const compAtual = competenciaEmFechamento();

  return (
    <>
      <Link href="/clientes" className="botao-texto" style={{ marginBottom: 10 }}><ArrowLeft size={14} /> Clientes</Link>
      <Cabecalho sobretitulo={`${REGIME_LABEL[c.regime]} · ${c.municipio}/${c.uf}`} titulo={c.razaoSocial}
        descricao={<span className="mono">{formatarDocumento(c.documento)}{c.inscricaoEstadual ? ` · IE ${c.inscricaoEstadual}` : ""}{c.inscricaoMunicipal ? ` · IM ${c.inscricaoMunicipal}` : ""}</span>}
        acoes={<>
          <button className="botao botao-secundario" onClick={() => setEditar(true)}><Pencil size={15} /> Editar</button>
          <button className="botao botao-primario" disabled={gerar.isPending || !c.ativo} onClick={() => gerar.mutate({ competencia: compAtual, clienteId: c.id, simular: false })}><Wand2 size={15} /> Gerar {comp(compAtual)}</button>
        </>} />
      {!c.ativo && <div className="aviso aviso-ambar"><div>Cliente inativo: não entra na geração de obrigações. <button className="botao-texto" onClick={() => ativar.mutate({ id: c.id, ativo: true })}>Reativar</button></div></div>}

      <section className="grade-2">
        <article className="painel"><div className="painel-corpo" style={{ paddingTop: 16 }}>
          <dl className="dados">
            <dt>Responsável</dt><dd>{nome(c.responsavelId)}</dd>
            <dt>Revisor</dt><dd>{nome(c.revisorId)}</dd>
            <dt>Atividades</dt><dd>{c.atividades.length ? c.atividades.map(a => ATIVIDADE_LABEL[a as Atividade]).join(", ") : "—"}</dd>
            <dt>Contato</dt><dd>{[c.contatoNome, c.contatoEmail, c.contatoTelefone].filter(Boolean).join(" · ") || "—"}</dd>
            {c.observacoes && <><dt>Observações</dt><dd style={{ whiteSpace: "pre-wrap" }}>{c.observacoes}</dd></>}
          </dl>
        </div></article>
        <article className="painel"><div className="painel-corpo" style={{ paddingTop: 16 }}>
          <span className="sobretitulo">Situação</span>
          <div className="lista-alertas" style={{ marginTop: 10 }}>
            <span><i className="ponto coral" /> {tarefas.filter(t => !["entregue", "nao_aplicavel"].includes(t.status) && t.vencimento < new Date().toLocaleDateString("sv-SE")).length} obrigação(ões) vencida(s)</span>
            <span><i className="ponto ambar" /> {tarefas.filter(t => t.status === "aguardando_cliente").length} aguardando o cliente</span>
            <span><i className="ponto azul" /> {demandas.filter(d => !["concluida", "cancelada"].includes(d.status)).length} demanda(s) aberta(s)</span>
            <span><i className="ponto lima" /> {regras.filter(r => r.aplica).length} obrigação(ões) no calendário</span>
          </div>
          {c.ativo && <button className="botao botao-secundario botao-pequeno" style={{ marginTop: 14 }} onClick={() => confirm("Inativar este cliente? Ele deixa de receber obrigações novas; o histórico é mantido.") && ativar.mutate({ id: c.id, ativo: false })}>Inativar cliente</button>}
        </div></article>
      </section>

      <nav className="abas" aria-label="Seções do cliente">
        {([["obrigacoes", "Obrigações", tarefas.length], ["regras", "Calendário do cliente", regras.filter(r => r.aplica).length], ["demandas", "Demandas", demandas.length], ["documentos", "Documentos", documentos.length], ["historico", "Histórico", historico.length]] as const).map(([k, rot, n]) => (
          <button key={k} className={aba === k ? "ativo" : ""} onClick={() => setAba(k)} aria-current={aba === k}>{rot}<span className="contador">{n}</span></button>
        ))}
      </nav>

      <article className="painel">
        {aba === "obrigacoes" && (tarefas.length === 0 ? <Vazio titulo="Nenhuma obrigação gerada" texto={`Use "Gerar ${comp(compAtual)}" para criar as obrigações deste cliente.`} /> : (
          <div className="tabela-rolagem"><table className="tabela">
            <thead><tr><th>Competência</th><th>Obrigação</th><th>Vencimento</th><th>Status</th></tr></thead>
            <tbody>{tarefas.map(t => (
              <tr key={t.id} className="clicavel" onClick={() => setTarefa(t.id)}><td className="mono">{comp(t.competencia)}</td><td>{t.titulo} {t.regraNaoRevisada && "⚠"}</td><td>{dataBR(t.vencimento)}</td><td><ChipTarefa status={t.status} /></td></tr>
            ))}</tbody>
          </table></div>
        ))}

        {aba === "regras" && (
          <>
            <div className="painel-corpo" style={{ paddingTop: 14, color: "var(--suave)", fontSize: 13 }}>O padrão vem do regime, UF, município e atividade. Use "Dispensar" quando a obrigação não se aplica a este cliente (ex.: sem folha) ou "Incluir" para exceções.</div>
            <div className="tabela-rolagem"><table className="tabela">
              <thead><tr><th>Obrigação</th><th>Esfera</th><th>Padrão</th><th>Situação</th><th></th></tr></thead>
              <tbody>{regras.map(r => (
                <tr key={r.id}>
                  <td>{r.nome} {!r.completa && <Chip tom="ambar">sem prazo</Chip>} {r.completa && !r.revisada && <span title="Regra não revisada">⚠</span>}</td>
                  <td>{ESFERA_LABEL[r.esfera]}</td>
                  <td>{r.padrao ? "Aplica" : "Não aplica"}</td>
                  <td>{r.aplica ? <Chip tom="lima">No calendário</Chip> : <Chip>Fora</Chip>} {r.excecao !== null && <Chip tom="violeta">exceção</Chip>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.excecao !== null ? <button className="botao-texto" onClick={() => definir.mutate({ clienteId: c.id, regraId: r.id, ativa: null })}>Voltar ao padrão</button>
                      : r.aplica ? <button className="botao-texto" onClick={() => definir.mutate({ clienteId: c.id, regraId: r.id, ativa: false })}>Dispensar</button>
                        : <button className="botao-texto" onClick={() => definir.mutate({ clienteId: c.id, regraId: r.id, ativa: true })}>Incluir</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}

        {aba === "demandas" && (demandas.length === 0 ? <Vazio titulo="Nenhuma demanda para este cliente" /> : (
          <div className="tabela-rolagem"><table className="tabela">
            <thead><tr><th>Demanda</th><th>Prazo interno</th><th>Status</th></tr></thead>
            <tbody>{demandas.map(d => (
              <tr key={d.id} className="clicavel" onClick={() => (window.location.href = `/demandas?id=${d.id}`)}><td><strong>{d.titulo}</strong><span className="sub">{TIPO_DEMANDA_LABEL[d.tipo]} · {d.origem}</span></td><td>{dataBR(d.prazoInterno)}</td><td><ChipDemanda status={d.status} /></td></tr>
            ))}</tbody>
          </table></div>
        ))}

        {aba === "documentos" && (
          <div className="painel-corpo" style={{ paddingTop: 16 }}>
            <Envio campos={{ clienteId: c.id, competencia: compAtual }} texto={`Enviar documentos de ${comp(compAtual)}`} aoConcluir={() => utils.clientes.obter.invalidate()} />
            <div style={{ marginTop: 12 }}>
              {documentos.map(d => (
                <div className="linha-simples" key={d.id}>
                  <div className="cresce"><strong>{d.nomeOriginal}</strong><span>{CATEGORIA_DOC_LABEL[d.categoria]} · {comp(d.competencia)} · {bytes(d.tamanho)} · {dataHoraBR(d.criadoEm)}{d.infoXml?.alertas?.length ? ` · ⚠ ${d.infoXml.alertas[0]}` : ""}</span></div>
                  {d.visivelCliente && <Chip tom="azul">no portal</Chip>}
                  <a className="botao-icone" href={urlDownload(d.id)} aria-label={`Baixar ${d.nomeOriginal}`}><Download size={16} /></a>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "historico" && (
          <div className="painel-corpo" style={{ paddingTop: 10 }}>
            {historico.length === 0 ? <Vazio titulo="Sem histórico" /> : historico.map(h => (
              <div className="linha-simples" key={h.id}><div className="cresce"><strong style={{ fontWeight: 600, whiteSpace: "normal" }}>{h.resumo}</strong><span>{h.usuario ?? "Sistema"} · {dataHoraBR(h.criadoEm)}</span></div></div>
            ))}
          </div>
        )}
      </article>

      <FormCliente aberto={editar} fechar={() => setEditar(false)} cliente={c} />
      <GavetaTarefa id={tarefa} fechar={() => setTarefa(null)} />
    </>
  );
}
