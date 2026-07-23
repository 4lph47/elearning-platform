"use client";

import { useState } from "react";
import { Paperclip, FileText, Image as ImageIcon, Video, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";
import { ResourcePreviewContent } from "@/components/course/ResourcePreviewContent";
import type { LessonResourceData } from "@/components/course/LessonTabs";

const KIND_OPTIONS = ["DOCUMENT", "IMAGE", "VIDEO"] as const;

// Miniatura sempre visível (sem precisar de clicar) — imagem/vídeo reais,
// ícone para o resto. Clicar abre o mesmo visualizador do aluno
// (ResourcePreviewContent) em grande, para mais detalhe.
function InlineThumb({ resource }: { resource: LessonResourceData }) {
  if (resource.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resource.url} alt={resource.name} className="h-full w-full object-cover" />;
  }
  if (resource.type === "VIDEO") {
    return <video src={resource.url} muted playsInline className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-white/5">
      <FileText size={22} className="text-slate-400 dark:text-slate-500" />
    </div>
  );
}

export function LessonResourcesCard({
  lessonId,
  initialResources,
}: {
  lessonId: string;
  initialResources: LessonResourceData[];
}) {
  const [resources, setResources] = useState(initialResources);
  const [resourceKind, setResourceKind] = useState<(typeof KIND_OPTIONS)[number]>("DOCUMENT");
  const [preview, setPreview] = useState<LessonResourceData | null>(null);

  async function handleAddResource(uploaded: { url: string; sizeBytes: number; name: string; mimeType?: string }) {
    const res = await fetch(`/api/instructor/lessons/${lessonId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: uploaded.name,
        url: uploaded.url,
        sizeBytes: uploaded.sizeBytes,
        mimeType: uploaded.mimeType,
      }),
    });
    if (res.ok) {
      const resource = await res.json();
      setResources((prev) => [...prev, resource]);
    }
  }

  async function handleRemoveResource(resourceId: string) {
    const res = await fetch(`/api/instructor/lessons/${lessonId}/resources/${resourceId}`, { method: "DELETE" });
    if (res.ok) setResources((prev) => prev.filter((r) => r.id !== resourceId));
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-medium">Recursos</h2>

      {resources.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Ainda sem anexos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {resources.map((r) => (
            <div key={r.id} className="group relative">
              <button
                type="button"
                onClick={() => setPreview(r)}
                className="relative block aspect-video w-full overflow-hidden rounded-md border border-slate-200 dark:border-white/10"
              >
                <InlineThumb resource={r} />
                <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-xs text-white">
                  {r.name}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleRemoveResource(r.id)}
                aria-label="Remover recurso"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition-opacity sm:h-5 sm:w-5 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {KIND_OPTIONS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setResourceKind(k)}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
              resourceKind === k
                ? "border-slate-800 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            {k === "DOCUMENT" && (
              <>
                <FileText size={14} /> Documento
              </>
            )}
            {k === "IMAGE" && (
              <>
                <ImageIcon size={14} /> Imagem
              </>
            )}
            {k === "VIDEO" && (
              <>
                <Video size={14} /> Vídeo
              </>
            )}
          </button>
        ))}
      </div>
      <FileUploadInput kind={resourceKind} onUploaded={handleAddResource} />

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-neutral-900 px-3 py-2">
              <span className="flex items-center gap-1.5 truncate text-sm text-white">
                <Paperclip size={14} className="shrink-0 text-slate-400" />
                {preview.name}
              </span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Fechar pré-visualização"
                className="shrink-0 text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative flex-1">
              <ResourcePreviewContent resource={preview} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
