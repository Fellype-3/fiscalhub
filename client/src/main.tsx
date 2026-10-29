import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { Toaster, toast } from "sonner";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./estilos.css";
import { trpc } from "./lib/trpc";
import App from "./App";

function naoAutorizado(erro: unknown) {
  return erro instanceof TRPCClientError && erro.data?.code === "UNAUTHORIZED";
}

function Raiz() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: (n, e) => !naoAutorizado(e) && n < 2, refetchOnWindowFocus: true, staleTime: 15_000 } },
    queryCache: new QueryCache({ onError: e => { if (naoAutorizado(e)) queryClient.invalidateQueries({ queryKey: [["auth", "eu"]] }); } }),
    mutationCache: new MutationCache({
      onError: (e, _v, _c, m) => { if (!m.options.onError) toast.error(e.message); },
    }),
  }));
  const [trpcClient] = useState(() => trpc.createClient({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, fetch: (u, o) => fetch(u, { ...o, credentials: "same-origin" }) })],
  }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Raiz /></StrictMode>);
