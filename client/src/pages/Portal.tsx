import { useState } from "react";
import { CheckCircle2, Download, FileText, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Carregando, ErroCarga, Vazio } from "@/components/ui";
import { Envio } from "@/components/Envio";
import { bytes, comp, dataBR, dataHoraBR, prazoRelativo } from "@/lib/formato";
import { urlDownload } from "@/lib/arquivos";
import { CATEGORIA_DOC_LABEL } from "@shared/dominio";
import { formatarDocumento } from "@shared/documento";
import { deslocarCompetencia } from "@shared/competencia";

/** Portal do cliente: enviar documentos, ver o que o escritório está esperando e baixar guias/recibos. */
export default function Portal({ usuario }: { usuario: { nome: string } }) {
  const utils = trpc.useUtils();
  const q = trpc.portal.resumo.useQuery();
  const sair = trpc.auth.sair.useMutation({ onSuccess: () => { utils.invalidate(); window.location.href = "/"; } });
  const [competencia, setCompetencia] = useState<string | null>(null);
  const [tarefaId, setTarefaId] = useState<string>("");

  if (q.isLoading) return <Carregando />;
  if (q.error) return <div className="pagina"><ErroCarga erro={q.error} tentar={() => q.refetch()} /></div>;
  const r = q.data!;
  const comp0 = competencia ?? r.competenciaSugerida;
  const doEscritorio = r.documentos.filter(d => !d.enviadoPorMim);
  const meus = r.documentos.filter(d => d.enviadoPorMim);

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topo" style={{ background: "var(--marinho)", color: "#fff", borderBottom: 0 }}>
        <span className="marca-sinal">fh<span>.</span></span>
        <div className="topo-trilha" style={{ color: "#c3cdd8" }}>Portal do cliente · <strong style={{ color: "#fff" }}>{r.cliente.razaoSocial}</strong></div>
        <button className="botao botao-secundario botao-pequeno" onClick={() => sair.mutate()}><LogOut size={14} /> Sair</button>
      </header>
      <div className="pagina" style={{ maxWidth: 980 }}>
        <section className="cabecalho">
          <div><span className="sobretitulo mono">{formatarDocumento(r.cliente.documento)} · {r.cliente.municipio}/{r.cliente.uf}</span><h1>Olá, {usuario.nome.split(" ")[0]}.</h1><p>Envie aqui os documentos do mês. O escritório recebe na hora e você acompanha o que ainda falta.</p></div>
        </section>

        <article className="painel" style={{ marginBottom: 14 }}>
          <div className="painel-cabeca"><div><span className="sobretitulo">O escritório está aguardando</span><h2>{r.pendencias.length + r.solicitacoes.length ? "Pendências com você" : "Nenhuma pendência"}</h2></div></div>
          <div className="painel-corpo">
            {r.pendencias.length + r.solicitacoes.length === 0 ? <div className="aviso aviso-azul" style={{ marginBottom: 0 }}><CheckCircle2 size={16} /><div>Tudo certo por enquanto. Obrigado!</div></div> : <>
              {r.pendencias.map(p => {
                const pr = prazoRelativo(p.vencimento);
                return (
                  <div className="linha-simples" key={`t${p.id}`}>
                    <div className="cresce"><strong>{p.titulo} · {comp(p.competencia)}</strong><span>{p.observacoes || "Envie os documentos desta competência."}</span></div>
                    <span className={pr.classe} style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>prazo {dataBR(p.vencimento)}</span>
                    <button className="botao botao-secundario botao-pequeno" onClick={() => { setCompetencia(p.competencia); setTarefaId(String(p.id)); document.getElementById("envio")?.scrollIntoView({ behavior: "smooth" }); }}>Enviar</button>
                  </div>
                );
              })}
              {r.solicitacoes.map(s => (
                <div className="linha-simples" key={`d${s.id}`}><div className="cresce"><strong>{s.titulo}</strong><span>O escritório precisa de um retorno seu. Responda pelo canal habitual ou envie o documento abaixo.</span></div></div>
              ))}
            </>}
          </div>
        </article>

        <article className="painel" style={{ marginBottom: 14 }} id="envio">
          <div className="painel-cabeca"><div><span className="sobretitulo">Enviar documentos</span><h2>XML de notas, extratos e outros arquivos</h2></div></div>
          <div className="painel-corpo">
            <div className="form" style={{ marginBottom: 12 }}>
              <label className="campo"><span>Mês de referência (competência)</span>
                <select value={comp0} onChange={e => { setCompetencia(e.target.value); setTarefaId(""); }}>
                  {[1, 0, -1, -2].map(n => deslocarCompetencia(r.competenciaSugerida, n)).map(c => <option key={c} value={c}>{comp(c)}</option>)}
                </select>
              </label>
              {r.pendencias.length > 0 && (
                <label className="campo"><span>Referente a (opcional)</span>
                  <select value={tarefaId} onChange={e => setTarefaId(e.target.value)}><option value="">Geral</option>{r.pendencias.map(p => <option key={p.id} value={p.id}>{p.titulo} · {comp(p.competencia)}</option>)}</select>
                </label>
              )}
            </div>
            <Envio campos={{ competencia: comp0, tarefaId: tarefaId || null }} texto="Toque para escolher os arquivos ou arraste aqui"
              dica="Pode enviar vários de uma vez. XML de NF-e, NFC-e, CT-e e NFS-e são conferidos na hora." aoConcluir={() => utils.portal.resumo.invalidate()} />
          </div>
        </article>

        <section className="grade-meio">
          <article className="painel">
            <div className="painel-cabeca"><div><span className="sobretitulo">Do escritório para você</span><h2>Guias e recibos</h2></div></div>
            <div className="painel-corpo">
              {doEscritorio.length === 0 ? <Vazio titulo="Nada disponível ainda" icone={<FileText size={26} />} /> : doEscritorio.map(d => (
                <div className="linha-simples" key={d.id}>
                  <div className="cresce"><strong>{d.nomeOriginal}</strong><span>{CATEGORIA_DOC_LABEL[d.categoria]} · {comp(d.competencia)} · {dataHoraBR(d.criadoEm)}</span></div>
                  <a className="botao botao-secundario botao-pequeno" href={urlDownload(d.id)}><Download size={14} /> Baixar</a>
                </div>
              ))}
            </div>
          </article>
          <article className="painel">
            <div className="painel-cabeca"><div><span className="sobretitulo">Enviados por você</span><h2>Recebidos pelo escritório</h2></div></div>
            <div className="painel-corpo">
              {meus.length === 0 ? <Vazio titulo="Você ainda não enviou arquivos" icone={<FileText size={26} />} /> : meus.slice(0, 30).map(d => (
                <div className="linha-simples" key={d.id}>
                  <CheckCircle2 size={16} color="#4f6d12" />
                  <div className="cresce"><strong>{d.nomeOriginal}</strong><span>{d.infoXml?.tipo ?? CATEGORIA_DOC_LABEL[d.categoria]} · {comp(d.competencia)} · {bytes(d.tamanho)} · {dataHoraBR(d.criadoEm)}</span></div>
                </div>
              ))}
            </div>
          </article>
        </section>
        <p style={{ fontSize: 12, color: "var(--fraco)", marginTop: 24 }}>Seus documentos são usados só para a prestação dos serviços contábeis e o cumprimento de obrigações legais. Dúvidas sobre seus dados: fale com o escritório.</p>
      </div>
    </div>
  );
}
