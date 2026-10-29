import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  build: { outDir: "../dist/public", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
  },
  test: { root: ".", include: ["tests/**/*.test.ts"], testTimeout: 30000 },
} as any);
