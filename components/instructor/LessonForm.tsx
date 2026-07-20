"use client";

import { useState } from "react";
import { Paperclip, FileText, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";
import { QuizEditor } from "@/components/instructor/QuizEditor";
import type { LessonData } from "@/components/instructor/LessonRow";

export function LessonForm({
  moduleId,
  lesson,
  nextOrder,
  courseAuthors,
  onDone,
  onCancel,
}: {
  moduleId: string | null;
  lesson?: LessonData;
  nextOrder: number;
  courseAuthors: { id: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(lesson);

  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [isFreePreview, setIsFreePreview] = useState(lesson?.isFreePreview ?? false);
  const [type, setType] = useState<"VIDEO" | "TEXT">(lesson?.type ?? "VIDEO");
  const [contentUrl, setContentUrl] = useState<string | null>(lesson?.contentUrl ?? null);
  const [textContent, setTextContent] = useState(lesson?.textContent ?? "");
  const [contributorIds, setContributorIds] = useState<string[]>(
    lesson?.contributors?.map((c) => c.id) ?? []
  );
  const [resources, setResources] = useState(lesson?.resources ?? []);
  const [resourceKind, setResourceKind] = useState<"VIDEO" | "DOCUMENT" | "IMAGE">("DOCUMENT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleContributor(id: string) {
    setContributorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (type === "VIDEO" && !contentUrl) {
      setError("Envia o vídeo desta aula antes de guardar");
      return;
    }
    if (type === "TEXT" && !textContent.trim()) {
      setError("Escreve o conteúdo desta aula antes de guardar");
      return;
    }

    setSaving(true);
    const payload = {
      title,
      order: lesson?.order ?? nextOrder,
      isFreePreview,
      type,
      contentUrl: type === "VIDEO" ? contentUrl : null,
      textContent: type === "TEXT" ? textContent : null,
      description: description.trim() || null,
      contributorIds,
    };

    const url = isEditing ? `/api/instructor/lessons/${lesson!.id}` : `/api/instructor/modules/${moduleId}/lessons`;
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar aula");
      return;
    }

    onDone();
  }

  async function handleAddResource(uploaded: { url: string; sizeBytes: number; name: string; mimeType?: string }) {
    if (!lesson) return;
    const res = await fetch(`/api/instructor/lessons/${lesson.id}/resources`, {
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
    if (!lesson) return;
    const res = await fetch(`/api/instructor/lessons/${lesson.id}/resources/${resourceId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3">
      <div>
        <Label htmlFor={`lesson-title-${lesson?.id ?? "new"}`}>Título da aula</Label>
        <Input
          id={`lesson-title-${lesson?.id ?? "new"}`}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <Label>Tipo de aula</Label>
        <div className="flex gap-2">
          {(["VIDEO", "TEXT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${
                type === t ? "border-slate-700 bg-slate-800 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "VIDEO" ? "Vídeo" : "Texto"}
            </button>
          ))}
        </div>
      </div>

      {type === "VIDEO" ? (
        <div>
          <Label>Vídeo da aula (obrigatório)</Label>
          <FileUploadInput kind="VIDEO" onUploaded={(r) => setContentUrl(r.url)} />
          <p className="my-1.5 text-center text-xs text-slate-400">ou</p>
          <Input
            placeholder="Colar link do YouTube (https://youtube.com/watch?v=...)"
            defaultValue={contentUrl?.includes("youtu") ? contentUrl : ""}
            onBlur={(e) => e.target.value && setContentUrl(e.target.value)}
          />
          {contentUrl && <p className="mt-1 text-xs text-slate-500">Vídeo atual: {contentUrl}</p>}
        </div>
      ) : (
        <div>
          <Label htmlFor={`lesson-text-${lesson?.id ?? "new"}`}>Conteúdo da aula (obrigatório)</Label>
          <Textarea
            id={`lesson-text-${lesson?.id ?? "new"}`}
            rows={8}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Escreve o conteúdo desta aula em texto..."
          />
        </div>
      )}

      <div>
        <Label htmlFor={`lesson-description-${lesson?.id ?? "new"}`}>Descrição da aula (opcional)</Label>
        <Textarea
          id={`lesson-description-${lesson?.id ?? "new"}`}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isFreePreview}
          onChange={(e) => setIsFreePreview(e.target.checked)}
          className="rounded border-slate-300"
        />
        Aula disponível como preview grátis (sem matrícula)
      </label>

      {courseAuthors.length > 1 && (
        <div>
          <Label>Envolvidos nesta aula</Label>
          <div className="space-y-1">
            {courseAuthors.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={contributorIds.includes(a.id)}
                  onChange={() => toggleContributor(a.id)}
                  className="rounded border-slate-300"
                />
                {a.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="border-t border-slate-200 pt-3">
          <Label>Materiais de apoio (anexos extra: PDF, imagem...)</Label>
          <ul className="mb-2 space-y-1">
            {resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Paperclip size={14} className="text-slate-400" />
                  {r.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveResource(r.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
          <div className="mb-2 flex gap-2">
            {(["DOCUMENT", "IMAGE", "VIDEO"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setResourceKind(k)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  resourceKind === k
                    ? "border-slate-700 bg-slate-800 text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
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
        </div>
      )}

      {isEditing && (
        <div className="border-t border-slate-200 pt-3">
          <QuizEditor scope="LESSON" parentId={lesson!.id} label="Quiz da aula" existingQuiz={lesson?.quiz} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "A guardar..." : "Guardar aula"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
