import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2, CalendarCheck2, FolderOpen, History, Inbox, LayoutDashboard, LogOut, Menu, ScrollText, ShieldCheck, Users, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Avatar } from "./ui";
import { PAPEL_LABEL, type Papel } from "@shared/dominio";

type U = { id: number; nome: string; papel: Papel; email: string };

export function Layout({ usuario, children }: { usuario: U; children: ReactNode }) {
  const [local] = useLocation();
  const [aberta, setAberta] = useState(false);
  const utils = trpc.useUtils();
  const resumo = trpc.painel.resumo.useQuery({ somenteMeus: false }, { staleTime: 60_000 });
  const info = trpc.painel.info.useQuery(undefined, { staleTime: 300_000 });
  const sair = trpc.auth.sair.useMutation({ onSuccess: () => { utils.invalidate(); window.location.href = "/"; } });

  const a = resumo.data?.alertas;
  const principais = [
    { href: "/", rotulo: "Painel", icone: LayoutDashboard },
    { href: "/obrigacoes", rotulo: "Obrigações do mês", icone: CalendarCheck2, contador: a ? a.tarefasVencidas : undefined, alerta: !!a?.tarefasVencidas },
    { href: "/demandas", rotulo: "Demandas", icone: Inbox, contador: a ? a.demandasAbertas : undefined, alerta: !!a?.demandasVencidas },
    { href: "/clientes", rotulo: "Clientes", icone: Building2, contador: resumo.data?.totalClientes },
    { href: "/documentos", rotulo: "Documentos", icone: FolderOpen },
  ];
  const gestao = [
    { href: "/regras", rotulo: "Regras e prazos", icone: ScrollText, contador: resumo.data ? resumo.data.regras.semRevisao || undefined : undefined, alerta: !!resumo.data?.regras.semRevisao },
    ...(usuario.papel === "admin" ? [{ href: "/equipe", rotulo: "Equipe e acessos", icone: Users }] : []),
    { href: "/historico", rotulo: "Histórico", icone: History },
    { href: "/conta", rotulo: "Minha conta", icone: ShieldCheck },
  ];
  const ativo = (href: string) => (href === "/" ? local === "/" : local.startsWith(href));
  const atual = [...principais, ...gestao].find(i => ativo(i.href));

  const item = (i: (typeof principais)[number] & { alerta?: boolean }) => (
    <Link key={i.href} href={i.href} className={ativo(i.href) ? "ativo" : ""} onClick={() => setAberta(false)} aria-current={ativo(i.href) ? "page" : undefined}>
      <i.icone size={18} strokeWidth={ativo(i.href) ? 2.3 : 1.8} />
      <span>{i.rotulo}</span>
      {i.contador !== undefined && <span className={`contador ${i.alerta ? "alerta" : ""}`}>{i.contador}</span>}
    </Link>
  );

  return (
    <div className="app">
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <aside className={`lateral ${aberta ? "aberta" : ""}`} aria-label="Menu principal">
        <div className="marca"><span className="marca-sinal">fh<span>.</span></span> FISCALHUB</div>
        <button className="botao-icone lateral-fechar" onClick={() => setAberta(false)} aria-label="Fechar menu"><X size={18} /></button>
        <div className="lateral-rotulo">Operação</div>
        <nav className="nav">{principais.map(item)}</nav>
        <div className="lateral-rotulo">Gestão</div>
        <nav className="nav">{gestao.map(item)}</nav>
        <div className="lateral-rodape">
          <div className="usuario">
            <Avatar nome={usuario.nome} id={usuario.id} />
            <div className="usuario-texto"><strong>{usuario.nome}</strong><span>{PAPEL_LABEL[usuario.papel]}</span></div>
            <button className="botao-icone" onClick={() => sair.mutate()} aria-label="Sair" title="Sair"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {aberta && <div className="veu" onClick={() => setAberta(false)} />}
      <main className="principal" id="conteudo">
        <header className="topo">
          <button className="botao-icone menu-movel" onClick={() => setAberta(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="topo-trilha">FiscalHub / <strong>{atual?.rotulo ?? "Página"}</strong></div>
          <span className="ocultar-movel" style={{ fontSize: 13, color: "var(--fraco)" }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
        </header>
        {info.data?.demo && (
          <div className="faixa-demo">Ambiente com <strong>dados de demonstração</strong> (clientes e CNPJs fictícios). Para começar de verdade, rode <code>npm run demo:limpar</code> no servidor.</div>
        )}
        <div className="pagina">{children}</div>
      </main>
    </div>
  );
}
