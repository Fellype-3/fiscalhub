import { useRef, useState } from "react";
import { CheckCircle2, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { enviarArquivos, type ResultadoEnvio } from "@/lib/arquivos";

/** Área de envio de arquivos (arrastar ou clicar). Os campos extras vão junto no formulário. */
export function Envio({ campos, aoConcluir, texto = "Arraste os arquivos aqui ou clique para escolher", dica, desabilitado }: {
  campos: Record<string, string | number | boolean | null | undefined>;
  aoConcluir?: (r: ResultadoEnvio) => void;
  texto?: string;
  dica?: string;
  desabilitado?: string | null;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null);

  async function enviar(lista: FileList | null) {
    if (!lista?.length) return;
    if (desabilitado) { toast.error(desabilitado); return; }
    setEnviando(true);
    try {
      const r = await enviarArquivos(campos, Array.from(lista));
      setResultado(r);
      if (r.enviados) toast.success(`${r.enviados} arquivo(s) recebido(s)`);
      if (r.resultados.some(x => !x.ok)) toast.warning("Alguns arquivos não foram aceitos. Veja os detalhes abaixo.");
      aoConcluir?.(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div>
      <div
        className={`zona-envio ${arrastando ? "arrastando" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={texto}
        onClick={() => entrada.current?.click()}
        onKeyDown={e => (e.key === "Enter" || e.key === " ") && entrada.current?.click()}
        onDragOver={e => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={e => { e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files); }}
      >
        <UploadCloud size={26} />
        <strong>{enviando ? "Enviando…" : texto}</strong>
        <span style={{ fontSize: 12 }}>{dica ?? "XML, PDF, imagens, planilhas e ZIP · XML é conferido na hora"}</span>
        <input ref={entrada} type="file" multiple hidden onChange={e => enviar(e.target.files)} />
      </div>
      {resultado && (
        <ul className="resultado-envio" style={{ listStyle: "none", padding: 0 }}>
          {resultado.resultados.map((r, i) => (
            <li key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              {r.ok ? <CheckCircle2 size={15} color="#4f6d12" /> : <XCircle size={15} color="#c2463b" />}
              <span><strong>{r.nome}</strong> — {r.mensagem}
                {r.alertas?.map((a, j) => <span key={j} style={{ display: "block", color: "#8a5a0b" }}>⚠ {a}</span>)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
