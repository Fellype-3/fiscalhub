import { useState } from "react";
import { Download, Eye, EyeOff, FileCode2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Cabecalho, Campo, Carregando, Chip, ErroCarga, Modal, Vazio } from "@/components/ui";
import { Envio } from "@/components/Envio";
import { bytes, comp, dataHoraBR, moeda } from "@/lib/formato";
import { urlDownload } from "@/lib/arquivos";
import { CATEGORIAS_DOC, CATEGORIA_DOC_LABEL, type CategoriaDoc } from "@shared/dominio";
import { competenciaEmFechamento, deslocarCompetencia } from "@shared/competencia";
import { formatarDocumento } from "@shared/documento";

export default function Documentos() {
  const eu = trpc.auth.eu.useQuery();
  const utils = trpc.useUtils();
  const clientes = trpc.clientes.listar.useQuery();
  const [clienteId, setClienteId] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [categoria, setCategoria] = useState("");
  const [busca, setBusca] = useState("");
  const [envio, setEnvio] = useState({ clienteId: "", competencia: competenciaEmFechamento(), categoria: "", visivelCliente: false });
  const [excluir, setExcluir] = useState<{ id: number; nome: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const lista = trpc.documentos.listar.useQuery({ clienteId: clienteId ? Number(clienteId) : undefined, competencia: competencia || undefined, categoria: (categoria || undefined) as CategoriaDoc | undefined, limite: 500 });
  const atualizar = trpc.documentos.atualizar.useMutation({ onSuccess: () => utils.documentos.invalidate() });
  const apagar = trpc.documentos.excluir.useMutation({ onSuccess: () => { toast.success("Documento excluído"); utils.documentos.invalidate(); setExcluir(null); setMotivo(""); } });
  const comps = [0, -1, -2, -3].map(n => deslocarCompetencia(competenciaEmFechamento(), n));
  const filtrados = (lista.data ?? []).filter(d => !busca || `${d.nomeOriginal} ${d.cliente} ${d.infoXml?.chave ?? ""}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <Cabecalho sobretitulo="Arquivo" titulo="Documentos" descricao="XML, guias, recibos e notificações. O arquivo original fica guardado sem alteração, com registro de quem enviou e quem baixou." />

      <article className="painel" style={{ marginBottom: 14 }}>
        <div className="painel-cabeca"><div><span className="sobretitulo">Enviar</span><h2>Receber documentos de um cliente</h2></div></div>
        <div className="painel-corpo">
          <div className="form" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", marginBottom: 12 }}>
            <Campo rotulo="Cliente *"><select value={envio.clienteId} onChange={e => setEnvio({ ...envio, clienteId: e.target.value })}><option value="">Selecione</option>{clientes.data?.map(c => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}</select></Campo>
            <Campo rotulo="Competência"><select value={envio.competencia} onChange={e => setEnvio({ ...envio, competencia: e.target.value })}>{comps.map(c => <option key={c} value={c}>{comp(c)}</option>)}</select></Campo>
            <Campo rotulo="Tipo" dica="XML é identificado sozinho"><select value={envio.categoria} onChange={e => setEnvio({ ...envio, categoria: e.target.value })}><option value="">Automático</option>{CATEGORIAS_DOC.map(c => <option key={c} value={c}>{CATEGORIA_DOC_LABEL[c]}</option>)}</select></Campo>
            <label className="campo"><span>Portal do cliente</span><span className="opcao" style={{ height: 40 }}><input type="checkbox" checked={envio.visivelCliente} onChange={e => setEnvio({ ...envio, visivelCliente: e.target.checked })} /> Liberar para o cliente</span></label>
          </div>
          <Envio campos={envio} desabilitado={envio.clienteId ? null : "Selecione o cliente antes de enviar."} aoConcluir={() => utils.documentos.invalidate()} />
        </div>
      </article>

      <section className="filtros">
        <div className="busca"><Search size={16} /><input aria-label="Buscar" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do arquivo, cliente ou chave de acesso" /></div>
        <div className="filtro"><label htmlFor="doc-cli">Cliente</label><select id="doc-cli" value={clienteId} onChange={e => setClienteId(e.target.value)}><option value="">Todos</option>{clientes.data?.map(c => <option key={c.id} value={c.id}>{c.razaoSocial}</option>)}</select></div>
        <div className="filtro"><label htmlFor="doc-comp">Competência</label><select id="doc-comp" value={competencia} onChange={e => setCompetencia(e.target.value)}><option value="">Todas</option>{comps.map(c => <option key={c} value={c}>{comp(c)}</option>)}</select></div>
        <div className="filtro"><label htmlFor="doc-cat">Tipo</label><select id="doc-cat" value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Todos</option>{CATEGORIAS_DOC.map(c => <option key={c} value={c}>{CATEGORIA_DOC_LABEL[c]}</option>)}</select></div>
      </section>

      <article className="painel">
        {lista.isLoading ? <Carregando /> : lista.error ? <ErroCarga erro={lista.error} /> : filtrados.length === 0 ? <Vazio titulo="Nenhum documento" texto="Envie acima ou peça ao cliente para usar o portal." icone={<FileCode2 size={28} />} /> : (
          <div className="tabela-rolagem"><table className="tabela">
            <thead><tr><th>Arquivo</th><th>Cliente</th><th>Comp.</th><th>Dados do XML</th><th>Enviado</th><th></th></tr></thead>
            <tbody>{filtrados.map(d => (
              <tr key={d.id}>
                <td><strong>{d.nomeOriginal}</strong><span className="sub">{CATEGORIA_DOC_LABEL[d.categoria]} · {bytes(d.tamanho)}</span></td>
                <td>{d.cliente}</td>
                <td className="mono">{comp(d.competencia)}</td>
                <td>{d.infoXml ? <>
                  <span>{d.infoXml.tipo}{d.infoXml.valorTotal ? ` · ${moeda(d.infoXml.valorTotal)}` : ""}</span>
                  {d.infoXml.cnpjEmitente && <span className="sub mono">Emit. {formatarDocumento(d.infoXml.cnpjEmitente)}</span>}
                  {d.infoXml.alertas.map((a, i) => <span key={i} className="sub" style={{ color: "var(--ambar)" }}>⚠ {a}</span>)}
                </> : "—"}</td>
                <td>{d.enviadoPor ?? "—"}{d.enviadoPorPapel === "cliente" && <> <Chip tom="ambar">portal</Chip></>}<span className="sub">{dataHoraBR(d.criadoEm)}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="botao-icone" title={d.visivelCliente ? "Visível no portal — clique para ocultar" : "Oculto do cliente — clique para liberar"} aria-label={d.visivelCliente ? "Ocultar do portal" : "Liberar no portal"} onClick={() => atualizar.mutate({ id: d.id, visivelCliente: !d.visivelCliente })}>{d.visivelCliente ? <Eye size={16} color="#2f5ea8" /> : <EyeOff size={16} />}</button>
                  <a className="botao-icone" href={urlDownload(d.id)} aria-label={`Baixar ${d.nomeOriginal}`}><Download size={16} /></a>
                  {eu.data?.papel === "admin" && <button className="botao-icone" aria-label="Excluir" onClick={() => setExcluir({ id: d.id, nome: d.nomeOriginal })}><Trash2 size={15} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </article>

      <Modal aberto={!!excluir} fechar={() => setExcluir(null)} titulo="Excluir documento" descricao={`${excluir?.nome} será apagado definitivamente. A exclusão fica registrada no histórico com o motivo.`}
        rodape={<><button className="botao botao-secundario" onClick={() => setExcluir(null)}>Cancelar</button><button className="botao botao-perigo" disabled={motivo.trim().length < 5 || apagar.isPending} onClick={() => apagar.mutate({ id: excluir!.id, motivo })}>Excluir</button></>}>
        <Campo rotulo="Motivo *" dica="Ex.: enviado em duplicidade, arquivo do cliente errado"><input value={motivo} onChange={e => setMotivo(e.target.value)} /></Campo>
      </Modal>
    </>
  );
}
