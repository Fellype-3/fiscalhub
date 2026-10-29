import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc, type Saidas } from "@/lib/trpc";
import { Cabecalho, Campo, Carregando, Chip, ErroCarga, Modal } from "@/components/ui";
import { comp, dataBR, dataHoraBR } from "@/lib/formato";
import {
  AJUSTES, AJUSTE_LABEL, ATIVIDADES, ATIVIDADE_LABEL, ESFERAS, ESFERA_LABEL, REGIMES, REGIME_LABEL, TIPOS_VENCIMENTO, TIPO_VENCIMENTO_LABEL, UFS,
  type Ajuste, type Atividade, type Esfera, type Regime, type TipoVencimento,
} from "@shared/dominio";

type Regra = Saidas["regras"]["listar"][number];

function descreverVencimento(r: Pick<Regra, "tipoVencimento" | "dia" | "mesesApos" | "ajuste">) {
  const mes = r.mesesApos === 0 ? "do próprio mês" : r.mesesApos === 1 ? "do mês seguinte" : `do ${r.mesesApos}º mês seguinte`;
  if (r.tipoVencimento === "ultimo_dia_util") return `Último dia útil ${mes}`;
  if (!r.dia) return "Dia não definido";
  if (r.tipoVencimento === "dia_util_n") return `${r.dia}º dia útil ${mes}`;
  return `Dia ${r.dia} ${mes}${r.ajuste === "proximo" ? " (prorroga se não útil)" : r.ajuste === "anterior" ? " (antecipa se não útil)" : ""}`;
}

export default function Regras() {
  const eu = trpc.auth.eu.useQuery();
  const admin = eu.data?.papel === "admin";
  const utils = trpc.useUtils();
  const lista = trpc.regras.listar.useQuery();
  const [editar, setEditar] = useState<Regra | "nova" | null>(null);
  const revisar = trpc.regras.revisar.useMutation({ onSuccess: () => { toast.success("Regra marcada como revisada"); utils.regras.invalidate(); utils.painel.invalidate(); utils.tarefas.invalidate(); } });

  return (
    <>
      <Cabecalho sobretitulo="Gerador de calendário" titulo="Regras e prazos"
        descricao="Cada regra diz quem tem a obrigação (regime, UF, município, atividade) e quando vence. Toda regra precisa de fonte oficial e revisão do contador responsável."
        acoes={<button className="botao botao-primario" onClick={() => setEditar("nova")}><Plus size={16} /> Nova regra</button>} />
      <div className="aviso aviso-ambar">
        <AlertTriangle size={16} />
        <div>Prazos mudam por ato normativo (e com a transição da Reforma Tributária — CBS/IBS). As regras iniciais foram montadas a partir da agenda tributária da Receita de 2026 e <strong>precisam ser conferidas</strong> antes de valer. Regras estaduais e municipais vêm sem dia: preencha com base na SEFAZ e na prefeitura de cada cliente.</div>
      </div>

      <article className="painel" style={{ marginBottom: 14 }}>
        {lista.isLoading ? <Carregando /> : lista.error ? <ErroCarga erro={lista.error} /> : (
          <div className="tabela-rolagem"><table className="tabela">
            <thead><tr><th>Obrigação</th><th>Quem tem</th><th>Vencimento</th><th>Exemplo</th><th>Revisão</th><th></th></tr></thead>
            <tbody>{lista.data!.map(r => (
              <tr key={r.id} style={{ opacity: r.ativa ? 1 : .55 }}>
                <td><strong>{r.nome}</strong><span className="sub">{ESFERA_LABEL[r.esfera]}{!r.ativa ? " · inativa" : ""} · {r.tarefas} tarefa(s)</span></td>
                <td style={{ maxWidth: 260 }}>
                  {r.regimes.map(x => REGIME_LABEL[x as Regime]).join(", ")}
                  <span className="sub">{r.ufs.length ? r.ufs.join(", ") : "Todas as UFs"}{r.municipios.length ? ` · ${r.municipios.join(", ")}` : ""}{r.atividades.length ? ` · ${r.atividades.map(a => ATIVIDADE_LABEL[a as Atividade]).join("/")}` : ""}</span>
                </td>
                <td>{r.completa ? descreverVencimento(r) : <Chip tom="ambar">Definir dia</Chip>}</td>
                <td className="mono">{r.exemplo.vencimento ? <>{comp(r.exemplo.competencia)} → {dataBR(r.exemplo.vencimento)}</> : "—"}</td>
                <td>
                  {r.revisadaEm ? <><Chip tom="lima"><BadgeCheck size={13} /> Revisada</Chip><span className="sub">{r.revisadaPor} · {dataHoraBR(r.revisadaEm)}</span></> : <Chip tom="ambar">Aguardando revisão</Chip>}
                  {r.fonteUrl && <a className="sub botao-texto" href={r.fonteUrl} target="_blank" rel="noreferrer noopener">Fonte <ExternalLink size={11} /></a>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="botao-icone" aria-label={`Editar ${r.nome}`} onClick={() => setEditar(r)}><Pencil size={15} /></button>
                  {admin && !r.revisadaEm && r.completa && <button className="botao botao-secundario botao-pequeno" onClick={() => revisar.mutate({ id: r.id })}>Marcar revisada</button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {!admin && <div className="painel-rodape"><span>Só administradores (contador responsável) podem marcar uma regra como revisada.</span></div>}
      </article>

      <section className="grade-meio">
        <Feriados />
        <ModeloChecklist admin={admin} />
      </section>

      <ModalRegra regra={editar} fechar={() => setEditar(null)} />
    </>
  );
}

function ModalRegra({ regra, fechar }: { regra: Regra | "nova" | null; fechar: () => void }) {
  const utils = trpc.useUtils();
  const vazio = { nome: "", esfera: "federal" as Esfera, regimes: [] as Regime[], ufs: [] as string[], municipios: "", atividades: [] as Atividade[], tipoVencimento: "dia_fixo" as TipoVencimento, dia: "" as string | number, mesesApos: 1, ajuste: "proximo" as Ajuste, fonteUrl: "", fonteNota: "", ativa: true };
  const [f, setF] = useState(vazio);
  useEffect(() => {
    if (!regra) return;
    setF(regra === "nova" ? vazio : {
      nome: regra.nome, esfera: regra.esfera, regimes: regra.regimes as Regime[], ufs: regra.ufs, municipios: regra.municipios.join(", "), atividades: regra.atividades as Atividade[],
      tipoVencimento: regra.tipoVencimento, dia: regra.dia ?? "", mesesApos: regra.mesesApos, ajuste: regra.ajuste, fonteUrl: regra.fonteUrl ?? "", fonteNota: regra.fonteNota ?? "", ativa: regra.ativa,
    });
  }, [regra]);
  const salvar = trpc.regras.salvar.useMutation({ onSuccess: () => { toast.success("Regra salva", { description: "Alterações de prazo ou abrangência voltam a exigir revisão." }); utils.regras.invalidate(); utils.painel.invalidate(); fechar(); } });
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]);

  return (
    <Modal aberto={!!regra} fechar={fechar} largo sobretitulo={regra === "nova" ? "Nova regra" : "Editar regra"} titulo={regra === "nova" ? "Cadastrar obrigação" : (regra as Regra | null)?.nome ?? ""}
      descricao="Dica: para obrigações estaduais ou municipais com prazos diferentes, crie uma regra por UF ou município."
      rodape={<><button className="botao botao-secundario" onClick={fechar}>Cancelar</button><button form="form-regra" className="botao botao-primario" disabled={salvar.isPending}>Salvar</button></>}>
      <form id="form-regra" className="form" onSubmit={e => {
        e.preventDefault();
        salvar.mutate({
          id: regra && regra !== "nova" ? regra.id : undefined, nome: f.nome, esfera: f.esfera, regimes: f.regimes, ufs: f.ufs as any, atividades: f.atividades,
          municipios: f.municipios.split(",").map(m => m.trim()).filter(Boolean), tipoVencimento: f.tipoVencimento, dia: f.dia === "" ? null : Number(f.dia),
          mesesApos: Number(f.mesesApos), ajuste: f.ajuste, fonteUrl: f.fonteUrl || null, fonteNota: f.fonteNota || null, ativa: f.ativa,
        });
      }}>
        <Campo rotulo="Nome da obrigação *" inteiro><input required value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: EFD ICMS/IPI — GO" /></Campo>
        <Campo rotulo="Esfera"><select value={f.esfera} onChange={e => setF({ ...f, esfera: e.target.value as Esfera })}>{ESFERAS.map(x => <option key={x} value={x}>{ESFERA_LABEL[x]}</option>)}</select></Campo>
        <label className="campo"><span>Situação</span><span className="opcao" style={{ height: 40 }}><input type="checkbox" checked={f.ativa} onChange={e => setF({ ...f, ativa: e.target.checked })} /> Regra ativa</span></label>
        <div className="campo inteiro"><span>Regimes *</span><div className="opcoes">{REGIMES.map(x => <label key={x} className="opcao"><input type="checkbox" checked={f.regimes.includes(x)} onChange={() => setF({ ...f, regimes: alternar(f.regimes, x) })} />{REGIME_LABEL[x]}</label>)}</div></div>
        <div className="campo inteiro"><span>Atividades (nenhuma = todas)</span><div className="opcoes">{ATIVIDADES.map(x => <label key={x} className="opcao"><input type="checkbox" checked={f.atividades.includes(x)} onChange={() => setF({ ...f, atividades: alternar(f.atividades, x) })} />{ATIVIDADE_LABEL[x]}</label>)}</div></div>
        <div className="campo inteiro"><span>UFs (nenhuma = todas)</span><div className="opcoes">{UFS.map(x => <label key={x} className="opcao" style={{ padding: "4px 7px" }}><input type="checkbox" checked={f.ufs.includes(x)} onChange={() => setF({ ...f, ufs: alternar(f.ufs, x) })} />{x}</label>)}</div></div>
        <Campo rotulo="Municípios (separe por vírgula; vazio = todos)" inteiro><input value={f.municipios} onChange={e => setF({ ...f, municipios: e.target.value })} placeholder="Ex.: Goiânia, Aparecida de Goiânia" /></Campo>
        <Campo rotulo="Tipo de vencimento"><select value={f.tipoVencimento} onChange={e => setF({ ...f, tipoVencimento: e.target.value as TipoVencimento })}>{TIPOS_VENCIMENTO.map(x => <option key={x} value={x}>{TIPO_VENCIMENTO_LABEL[x]}</option>)}</select></Campo>
        {f.tipoVencimento !== "ultimo_dia_util" && <Campo rotulo={f.tipoVencimento === "dia_util_n" ? "Qual dia útil" : "Dia do mês"} dica="Vazio = regra incompleta (não gera tarefas)"><input type="number" min={1} max={31} value={f.dia} onChange={e => setF({ ...f, dia: e.target.value })} /></Campo>}
        <Campo rotulo="Mês do vencimento"><select value={f.mesesApos} onChange={e => setF({ ...f, mesesApos: Number(e.target.value) })}><option value={0}>Mesmo mês da competência</option><option value={1}>Mês seguinte</option><option value={2}>2º mês seguinte</option><option value={3}>3º mês seguinte</option></select></Campo>
        {f.tipoVencimento === "dia_fixo" && <Campo rotulo="Se cair em dia não útil"><select value={f.ajuste} onChange={e => setF({ ...f, ajuste: e.target.value as Ajuste })}>{AJUSTES.map(x => <option key={x} value={x}>{AJUSTE_LABEL[x]}</option>)}</select></Campo>}
        <Campo rotulo="Link da fonte oficial" inteiro><input type="url" value={f.fonteUrl} onChange={e => setF({ ...f, fonteUrl: e.target.value })} placeholder="https://www.gov.br/receitafederal/… ou site da SEFAZ" /></Campo>
        <Campo rotulo="Base legal / observações" inteiro><textarea value={f.fonteNota} onChange={e => setF({ ...f, fonteNota: e.target.value })} placeholder="Ato normativo, artigo, particularidades" /></Campo>
      </form>
    </Modal>
  );
}

function Feriados() {
  const utils = trpc.useUtils();
  const [ano, setAno] = useState(new Date().getFullYear());
  const q = trpc.regras.feriados.useQuery({ ano });
  const [f, setF] = useState({ data: "", nome: "", uf: "", municipio: "" });
  const salvar = trpc.regras.salvarFeriado.useMutation({ onSuccess: () => { utils.regras.feriados.invalidate(); setF({ data: "", nome: "", uf: "", municipio: "" }); toast.success("Feriado cadastrado"); } });
  const excluir = trpc.regras.excluirFeriado.useMutation({ onSuccess: () => utils.regras.feriados.invalidate() });
  return (
    <article className="painel">
      <div className="painel-cabeca"><div><span className="sobretitulo">Dias úteis</span><h2>Feriados {ano}</h2></div>
        <div className="alternador"><button onClick={() => setAno(ano - 1)}>{ano - 1}</button><button className="ativo">{ano}</button><button onClick={() => setAno(ano + 1)}>{ano + 1}</button></div>
      </div>
      <div className="painel-corpo">
        <p style={{ fontSize: 13, color: "var(--suave)", marginTop: 0 }}>Nacionais (inclui Carnaval e Sexta-feira Santa) são calculados automaticamente. Cadastre os estaduais e municipais dos seus clientes — e Corpus Christi onde for feriado.</p>
        <details><summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Ver {q.data?.nacionais.length ?? ""} feriados nacionais</summary>
          {q.data?.nacionais.map(n => <div key={n.data} className="linha-simples"><span className="mono">{dataBR(n.data)}</span><span className="cresce">{n.nome}</span></div>)}
        </details>
        <div style={{ marginTop: 10 }}>
          {q.data?.locais.map(l => (
            <div key={l.id} className="linha-simples"><span className="mono">{dataBR(l.data)}</span><span className="cresce"><strong>{l.nome}</strong><span>{l.municipio ? `${l.municipio}/` : ""}{l.uf ?? "Todos"}</span></span>
              <button className="botao-icone" aria-label="Excluir feriado" onClick={() => excluir.mutate({ id: l.id })}><Trash2 size={14} /></button></div>
          ))}
        </div>
        <form className="form" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); salvar.mutate({ data: f.data, nome: f.nome, uf: (f.uf || null) as any, municipio: f.municipio || null }); }}>
          <Campo rotulo="Data"><input type="date" required value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Nome"><input required value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Aniversário da cidade" /></Campo>
          <Campo rotulo="UF"><select value={f.uf} onChange={e => setF({ ...f, uf: e.target.value })}><option value="">Todas</option>{UFS.map(u => <option key={u}>{u}</option>)}</select></Campo>
          <Campo rotulo="Município"><input value={f.municipio} onChange={e => setF({ ...f, municipio: e.target.value })} placeholder="Vazio = estadual" /></Campo>
          <div className="inteiro"><button className="botao botao-secundario botao-pequeno" disabled={salvar.isPending}><Plus size={14} /> Adicionar feriado</button></div>
        </form>
      </div>
    </article>
  );
}

function ModeloChecklist({ admin }: { admin: boolean }) {
  const utils = trpc.useUtils();
  const q = trpc.regras.modeloChecklist.useQuery();
  const [itens, setItens] = useState<{ id?: number; texto: string; ativo: boolean }[]>([]);
  useEffect(() => { if (q.data) setItens(q.data.map(i => ({ id: i.id, texto: i.texto, ativo: i.ativo }))); }, [q.data]);
  const salvar = trpc.regras.salvarModeloChecklist.useMutation({ onSuccess: () => { utils.regras.modeloChecklist.invalidate(); toast.success("Modelo salvo — vale para as próximas competências"); } });
  return (
    <article className="painel">
      <div className="painel-cabeca"><div><span className="sobretitulo">Padrão do escritório</span><h2>Checklist de fechamento</h2></div></div>
      <div className="painel-corpo">
        <p style={{ fontSize: 13, color: "var(--suave)", marginTop: 0 }}>Itens criados para cada cliente ao gerar a competência. Quem marca e quando fica registrado.</p>
        {itens.map((i, k) => (
          <div key={k} className="linha-simples">
            <input aria-label="Item ativo" type="checkbox" checked={i.ativo} disabled={!admin} onChange={e => setItens(itens.map((x, j) => j === k ? { ...x, ativo: e.target.checked } : x))} />
            <input className="cresce" style={{ border: "1px solid var(--linha)", borderRadius: 6, height: 34, padding: "0 8px" }} value={i.texto} disabled={!admin} onChange={e => setItens(itens.map((x, j) => j === k ? { ...x, texto: e.target.value } : x))} aria-label={`Item ${k + 1}`} />
            {admin && <button className="botao-icone" aria-label="Remover item" onClick={() => setItens(itens.filter((_, j) => j !== k))}><Trash2 size={14} /></button>}
          </div>
        ))}
        {admin && <div className="acoes" style={{ marginTop: 10 }}>
          <button className="botao botao-secundario botao-pequeno" onClick={() => setItens([...itens, { texto: "", ativo: true }])}><Plus size={14} /> Item</button>
          <button className="botao botao-primario botao-pequeno" disabled={salvar.isPending || itens.some(i => i.texto.trim().length < 2)} onClick={() => salvar.mutate(itens)}>Salvar modelo</button>
        </div>}
      </div>
    </article>
  );
}
