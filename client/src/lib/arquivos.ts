export type ResultadoEnvio = { enviados: number; resultados: { nome: string; ok: boolean; mensagem: string; alertas?: string[]; id?: number }[]; erro?: string };

export async function enviarArquivos(campos: Record<string, string | number | boolean | null | undefined>, arquivos: File[]): Promise<ResultadoEnvio> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v !== null && v !== undefined && v !== "") fd.append(k, String(v));
  for (const a of arquivos) fd.append("arquivos", a, a.name);
  const res = await fetch("/api/arquivos", { method: "POST", body: fd, credentials: "same-origin" });
  const corpo = await res.json().catch(() => ({ erro: "Resposta inválida do servidor." }));
  if (!res.ok) throw new Error(corpo.erro || "Falha no envio.");
  return corpo;
}

export const urlDownload = (id: number) => `/api/arquivos/${id}`;
