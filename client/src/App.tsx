import { Route, Switch, Redirect } from "wouter";
import { trpc } from "./lib/trpc";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import TrocarSenha from "./pages/TrocarSenha";
import Painel from "./pages/Painel";
import Clientes from "./pages/Clientes";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Obrigacoes from "./pages/Obrigacoes";
import Demandas from "./pages/Demandas";
import Documentos from "./pages/Documentos";
import Regras from "./pages/Regras";
import Equipe from "./pages/Equipe";
import Historico from "./pages/Historico";
import Conta from "./pages/Conta";
import Portal from "./pages/Portal";
import { Vazio } from "./components/ui";

function Carregando() {
  return <div className="carregando" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="marca-sinal" style={{ color: "#0d1b2a", fontSize: 34 }}>fh<span>.</span></div></div>;
}

export default function App() {
  const eu = trpc.auth.eu.useQuery(undefined, { staleTime: 60_000, retry: false });
  if (eu.isLoading) return <Carregando />;
  const usuario = eu.data;
  if (!usuario) return <Login />;
  if (usuario.trocarSenha) return <TrocarSenha usuario={usuario} />;
  if (usuario.papel === "cliente") return <Portal usuario={usuario} />;

  return (
    <Layout usuario={usuario}>
      <Switch>
        <Route path="/" component={Painel} />
        <Route path="/clientes" component={Clientes} />
        <Route path="/clientes/:id">{p => <ClienteDetalhe id={Number(p.id)} />}</Route>
        <Route path="/obrigacoes" component={Obrigacoes} />
        <Route path="/demandas" component={Demandas} />
        <Route path="/documentos" component={Documentos} />
        <Route path="/regras" component={Regras} />
        <Route path="/equipe">{usuario.papel === "admin" ? <Equipe /> : <Redirect to="/" />}</Route>
        <Route path="/historico" component={Historico} />
        <Route path="/conta">{<Conta usuario={usuario} />}</Route>
        <Route><Vazio titulo="Página não encontrada" texto="O endereço não existe ou foi movido." acao={<a className="botao botao-secundario" href="/">Voltar ao painel</a>} /></Route>
      </Switch>
    </Layout>
  );
}
