import { createTRPCReact, type inferReactQueryProcedureOptions } from "@trpc/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();
export type Saidas = inferRouterOutputs<AppRouter>;
export type OpcoesQuery = inferReactQueryProcedureOptions<AppRouter>;
