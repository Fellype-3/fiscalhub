import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { criarContextoExpress } from "./trpc";
import { rotasArquivos } from "./arquivos";
import { ENV } from "./env";

/** Bloqueia requisições que alteram dados vindas de outro site (proteção CSRF). */
function mesmaOrigem(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origem = req.headers.origin || req.headers.referer;
  if (!origem) return next(); // ferramentas sem navegador; o cookie SameSite=Lax já protege
  try {
    const host = new URL(origem).host;
    const permitidos = [req.headers.host, ENV.appUrl ? new URL(ENV.appUrl).host : null].filter(Boolean);
    if (permitidos.includes(host)) return next();
  } catch { /* cai no bloqueio */ }
  res.status(403).json({ erro: "Origem não permitida." });
}

export function criarApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: ENV.producao ? [] : null,
      },
    },
    strictTransportSecurity: ENV.producao,
  }));
  app.use(cookieParser());
  app.use("/api", mesmaOrigem);
  app.get("/api/saude", (_req, res) => res.json({ ok: true }));
  app.use(rotasArquivos);
  app.use("/api/trpc", express.json({ limit: "1mb" }), createExpressMiddleware({ router: appRouter, createContext: criarContextoExpress }));
  app.use("/api", (_req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

  const publico = path.resolve(process.cwd(), "dist/public");
  if (fs.existsSync(publico)) {
    app.use(express.static(publico, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.join(publico, "index.html")));
  }
  return app;
}
