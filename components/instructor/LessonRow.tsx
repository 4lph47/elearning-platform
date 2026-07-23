"use client";

import { useRouter } from "next/navigation";
import { Video, Type as TypeIcon } from "lucide-react";
import { Badge } from "@/components/ui/Card";
import { FadeLink } from "@/components/course/FadeLink";
import type { QuizData } from "@/components/instructor/QuizEditor";

export interface LessonResourceData {
  id: string;
  name: string;
  url: string;
  type: "PDF" | "IMAGE" | "VIDEO" | "OTHER" | "SLIDES";
}

export interface LessonData {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  thumbnailUrl?: string | null;
  textContent?: string | null;
  durationSeconds: number | null;
  description?: string | null;
  contributors?: { id: string }[];
  resources: LessonResourceData[];
  quiz?: QuizData | null;
}

// Edição já não é inline (form a expandir por baixo) — "Editar" leva à tela
// dedicada (components/instructor/LessonEditScreen.tsx), com o conteúdo
// dividido em cards separados, mais fácil de navegar que um formulário único.
export function LessonRow({
  lesson,
  courseId,
  moduleId,
  courseSlug,
}: {
  lesson: LessonData;
  courseId: string;
  moduleId: string;
  courseSlug: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Eliminar a aula "${lesson.title}"?`)) return;
    const res = await fetch(`/api/instructor/lessons/${lesson.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-1.5 rounded-md border border-slate-100 px-3 py-2 dark:border-white/10">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {lesson.type === "TEXT" ? (
          <TypeIcon size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
        ) : (
          <Video size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
        )}
        <span className="truncate">{lesson.title}</span>
        {lesson.isFreePreview && <Badge tone="success">Preview grátis</Badge>}
        {lesson.resources.length > 0 && <Badge>{lesson.resources.length} anexo(s)</Badge>}
        {lesson.quiz && <Badge tone="info">Quiz da aula</Badge>}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        <FadeLink
          href={`/courses/${courseSlug}/lessons/${lesson.id}`}
          className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white"
        >
          Ver
        </FadeLink>
        <FadeLink
          href={`/instructor/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`}
          className="text-slate-700 hover:underline dark:text-slate-300"
        >
          Editar
        </FadeLink>
        <button onClick={handleDelete} className="text-red-600 hover:underline dark:text-red-400">
          Eliminar
        </button>
      </div>
    </div>
  );
}
