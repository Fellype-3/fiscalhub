import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Campo, ChipTarefa, Gaveta } from "./ui";
import { Envio } from "./Envio";
import { bytes, comp, dataBR, dataHoraBR, prazoRelativo } from "@/lib/formato";
import { urlDownload } from "@/lib/arquivos";
import { CATEGORIA_DOC_LABEL, PRIORIDADES, PRIORIDADE_LABEL, REGIME_LABEL, STATUS_TAREFA, STATUS_TAREFA_LABEL, type StatusTarefa } from "@shared/dominio";

export function GavetaTarefa({ id, fechar }: { id: number | null; fechar: () => void }) {
  const utils = trpc.useUtils();
  const t = trpc.tarefas.obter.useQuery({ id: id! }, { enabled: !!id });
  const pessoas = trpc.equipe.pessoas.useQuery();
  const docs = trpc.documentos.listar.useQuery({ tarefaId: id!, limite: 100 }, { enabled: !!id });
  const hist = trpc.equipe.historico.useQuery({ entidade: "tarefa", entidadeId: id!, pagina: 0 }, { enabled: !!id });
  const [obs, setObs] = useState("");
  const [categoria, setCategoria] = useState("recibo");
  useEffect(() => setObs(t.data?.observacoes ?? ""), [t.data?.id, t.data?.observacoes]);

  const recarregar = () => { utils.tarefas.invalidate(); utils.painel.invalidate(); utils.documentos.invalidate(); utils.equipe.historico.invalidate(); utils.clientes.obter.invalidate(); };
  const atualizar = trpc.tarefas.atualizar.useMutation({
    onSuccess: r => { if (r.aviso) toast.warning(r.aviso); else toast.success("Tarefa atualizada"); recarregar(); },
  });
  const excluir = trpc.tarefas.excluir.useMutation({ onSuccess: () => { toast.success("Tarefa excluída"); recarregar(); fechar(); } });

  const d = t.data;
  const prazo = d ? prazoRelativo(d.vencimento) : null;
  const aberta = d && !["entregue", "nao_aplicavel"].includes(d.status);

  return (
    <Gaveta aberta={!!id} fechar={fechar}
      sobretitulo={d ? `${comp(d.competencia)} · ${d.uf}` : "Obrigação"}
      titulo={d?.titulo ?? "Carregando…"}
      extra={d && <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><ChipTarefa status={d.status} /><Link href={`/clientes/${d.clienteId}`} className="botao-texto">{d.cliente}</Link></div>}>
      {d && (
        <>
          {d.regraNaoRevisada && (
            <div className="aviso aviso-ambar"><AlertTriangle size={16} /><div>Prazo gerado por uma regra <strong>ainda não revisada</strong> pelo contador. Confira o vencimento na fonte oficial. <Link href="/regras">Ver regras</Link></div></div>
          )}
          <dl className="dados">
            <dt>Vencimento</dt><dd><strong className={aberta ? prazo!.classe : ""}>{dataBR(d.vencimento)}</strong>{aberta && <span className={prazo!.classe}> · {prazo!.texto}</span>}</dd>
            <dt>Cliente</dt><dd>{d.cliente} · {d.municipio}/{d.uf} · {REGIME_LABEL[d.regime]}</dd>
            <dt>Origem</dt><dd>{d.regraId ? "Gerada pelo calendário (regra)" : "Criada manualmente"}</dd>
            {d.entregueEm && <><dt>Entregue em</dt><dd>{dataHoraBR(d.entregueEm)}</dd></>}
          </dl>

          <div className="secao">
            <h3>Status</h3>
            <div className="opcoes" role="group" aria-label="Status">
              {STATUS_TAREFA.map(s => (
                <button key={s} className={`botao botao-pequeno ${d.status === s ? "botao-primario" : "botao-secundario"}`} disabled={atualizar.isPending}
                  onClick={() => d.status !== s && atualizar.mutate({ id: d.id, status: s as StatusTarefa })} aria-pressed={d.status === s}>{STATUS_TAREFA_LABEL[s]}</button>
              ))}
            </div>
          </div>

          <div className="secao form">
            <Campo rotulo="Responsável">
              <select value={d.responsavelId ?? ""} onChange={e => atualizar.mutate({ id: d.id, responsavelId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— sem responsável —</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Revisor">
              <select value={d.revisorId ?? ""} onChange={e => atualizar.mutate({ id: d.id, revisorId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— sem revisor —</option>{pessoas.data?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Vencimento" dica={d.regraId ? "Ajuste só em caso de prorrogação oficial." : undefined}>
              <input type="date" value={d.vencimento} onChange={e => e.target.value && atualizar.mutate({ id: d.id, vencimento: e.target.value })} />
            </Campo>
            <Campo rotulo="Prioridade">
              <select value={d.prioridade} onChange={e => atualizar.mutate({ id: d.id, prioridade: e.target.value as any })}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Observações" inteiro>
              <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="O que falta, com quem foi falado, número do recibo…" />
            </Campo>
            {obs !== (d.observacoes ?? "") && <div className="inteiro"><button className="botao botao-secundario botao-pequeno" onClick={() => atualizar.mutate({ id: d.id, observacoes: obs })}>Salvar observações</button></div>}
          </div>

          <div className="secao">
            <h3>Anexos ({docs.data?.length ?? 0})</h3>
            {docs.data?.map(doc => (
              <div className="linha-simples" key={doc.id}>
                <div className="cresce"><strong>{doc.nomeOriginal}</strong><span>{CATEGORIA_DOC_LABEL[doc.categoria]} · {bytes(doc.tamanho)} · {doc.enviadoPor ?? "—"} · {dataHoraBR(doc.criadoEm)}</span></div>
                <a className="botao-icone" href={urlDownload(doc.id)} aria-label={`Baixar ${doc.nomeOriginal}`}><Download size={16} /></a>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0 8px" }}>
              <label className="campo" style={{ flex: 1 }}><span>Tipo do anexo</span>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                  <option value="recibo">Recibo de entrega</option><option value="guia">Guia de pagamento</option><option value="outro">Outro documento</option><option value="xml_outro">XML</option>
                </select>
              </label>
            </div>
            <Envio campos={{ clienteId: d.clienteId, tarefaId: d.id, competencia: d.competencia, categoria, visivelCliente: categoria === "guia" || categoria === "recibo" }}
              texto="Anexar recibo, guia ou comprovante" dica="Guias e recibos ficam visíveis para o cliente no portal" aoConcluir={recarregar} />
          </div>

          <div className="secao">
            <h3>Histórico</h3>
            {hist.data?.linhas.length ? hist.data.linhas.map(h => (
              <div className="linha-simples" key={h.id}><div className="cresce"><strong style={{ fontWeight: 600, whiteSpace: "normal" }}>{h.resumo}</strong><span>{h.usuario ?? "Sistema"} · {dataHoraBR(h.criadoEm)}</span></div></div>
            )) : <small style={{ color: "var(--fraco)" }}>Sem alterações registradas.</small>}
          </div>

          {!d.regraId && (
            <div className="secao"><button className="botao botao-perigo botao-pequeno" onClick={() => confirm("Excluir esta tarefa manual?") && excluir.mutate({ id: d.id })}><Trash2 size={14} /> Excluir tarefa manual</button></div>
          )}
        </>
      )}
    </Gaveta>
  );
}
