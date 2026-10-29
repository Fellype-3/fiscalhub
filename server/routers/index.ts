import { router } from "../trpc";
import { authRouter } from "./auth";
import { clientesRouter } from "./clientes";
import { demandasRouter } from "./demandas";
import { documentosRouter } from "./documentos";
import { equipeRouter } from "./equipe";
import { painelRouter } from "./painel";
import { portalRouter } from "./portal";
import { regrasRouter } from "./regras";
import { tarefasRouter } from "./tarefas";

export const appRouter = router({
  auth: authRouter,
  painel: painelRouter,
  clientes: clientesRouter,
  tarefas: tarefasRouter,
  demandas: demandasRouter,
  documentos: documentosRouter,
  regras: regrasRouter,
  equipe: equipeRouter,
  portal: portalRouter,
});

export type AppRouter = typeof appRouter;
