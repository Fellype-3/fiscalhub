import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, Inbox, X } from "lucide-react";
import { corPorId, iniciais } from "@/lib/formato";
import { STATUS_DEMANDA_LABEL, STATUS_TAREFA_LABEL, type StatusDemanda, type StatusTarefa } from "@shared/dominio";

export function Chip({ children, tom = "", titulo }: { children: ReactNode; tom?: string; titulo?: string }) {
  return <span className={`chip ${tom ? `chip-${tom}` : ""}`} title={titulo}>{children}</span>;
}

export function Avatar({ nome, id }: { nome?: string | null; id?: number | null }) {
  return <span className={`avatar ${corPorId(id)}`} aria-hidden="true">{iniciais(nome)}</span>;
}

const TOM_TAREFA: Record<StatusTarefa, string> = {
  pendente: "", aguardando_cliente: "ambar", em_andamento: "azul", em_revisao: "violeta", entregue: "lima", nao_aplicavel: "",
};
export function ChipTarefa({ status }: { status: StatusTarefa }) {
  return <Chip tom={TOM_TAREFA[status]}>{STATUS_TAREFA_LABEL[status]}</Chip>;
}
const TOM_DEMANDA: Record<StatusDemanda, string> = {
  nova: "azul", em_andamento: "azul", aguardando_cliente: "ambar", aguardando_orgao: "violeta", concluida: "lima", cancelada: "",
};
export function ChipDemanda({ status }: { status: StatusDemanda }) {
  return <Chip tom={TOM_DEMANDA[status]}>{STATUS_DEMANDA_LABEL[status]}</Chip>;
}
export function ChipPrioridade({ p }: { p: string }) {
  if (p === "alta") return <Chip tom="coral">Alta</Chip>;
  if (p === "baixa") return <Chip>Baixa</Chip>;
  return null;
}

export function Modal({ titulo, sobretitulo, descricao, aberto, fechar, children, rodape, largo }: {
  titulo: string; sobretitulo?: string; descricao?: string; aberto: boolean; fechar: () => void; children: ReactNode; rodape?: ReactNode; largo?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([aria-label='Fechar'])")?.focus(), 30);
    return () => { document.removeEventListener("keydown", esc); anterior?.focus?.(); };
  }, [aberto]);
  if (!aberto) return null;
  return (
    <div className="fundo-modal" onMouseDown={e => e.target === e.currentTarget && fechar()}>
      <div className={`modal ${largo ? "largo" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div className="modal-cabeca">
          <div>
            {sobretitulo && <span className="sobretitulo">{sobretitulo}</span>}
            <h2 id={id}>{titulo}</h2>
            {descricao && <p>{descricao}</p>}
          </div>
          <button type="button" className="botao-icone" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
}

export function Gaveta({ aberta, fechar, titulo, sobretitulo, extra, children }: { aberta: boolean; fechar: () => void; titulo: ReactNode; sobretitulo?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  const id = useId();
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberta]);
  if (!aberta) return null;
  return (
    <>
      <div className="gaveta-fundo" onClick={fechar} />
      <aside className="gaveta" role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="gaveta-cabeca">
          <div style={{ minWidth: 0 }}>
            {sobretitulo && <span className="sobretitulo">{sobretitulo}</span>}
            <h2 id={id}>{titulo}</h2>
            {extra}
          </div>
          <button className="botao-icone" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="gaveta-corpo">{children}</div>
      </aside>
    </>
  );
}

export function Campo({ rotulo, dica, erro, children, inteiro }: { rotulo: string; dica?: string; erro?: string | null; children: ReactNode; inteiro?: boolean }) {
  return (
    <label className={`campo ${inteiro ? "inteiro" : ""}`}>
      <span>{rotulo}</span>
      {children}
      {erro ? <small className="erro" role="alert">{erro}</small> : dica ? <small>{dica}</small> : null}
    </label>
  );
}

export function Vazio({ titulo, texto, acao, icone }: { titulo: string; texto?: string; acao?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="vazio">
      {icone ?? <Inbox size={28} />}
      <strong>{titulo}</strong>
      {texto && <div>{texto}</div>}
      {acao && <div style={{ marginTop: 14 }}>{acao}</div>}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return <div className="carregando" role="status">{texto}</div>;
}

export function ErroCarga({ erro, tentar }: { erro: { message: string }; tentar?: () => void }) {
  return (
    <div className="aviso aviso-coral" role="alert">
      <AlertTriangle size={16} />
      <div>Não foi possível carregar: {erro.message} {tentar && <button className="botao-texto" onClick={tentar}>Tentar de novo</button>}</div>
    </div>
  );
}

export function Cabecalho({ sobretitulo, titulo, descricao, acoes }: { sobretitulo?: string; titulo: string; descricao?: ReactNode; acoes?: ReactNode }) {
  useEffect(() => { document.title = `${titulo} · FiscalHub`; }, [titulo]);
  return (
    <section className="cabecalho">
      <div>
        {sobretitulo && <span className="sobretitulo">{sobretitulo}</span>}
        <h1>{titulo}</h1>
        {descricao && <p>{descricao}</p>}
      </div>
      {acoes && <div className="acoes">{acoes}</div>}
    </section>
  );
}
