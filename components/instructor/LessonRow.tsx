"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, Type as TypeIcon } from "lucide-react";
import { Badge } from "@/components/ui/Card";
import { LessonForm } from "@/components/instructor/LessonForm";
import type { QuizData } from "@/components/instructor/QuizEditor";

export interface LessonResourceData {
  id: string;
  name: string;
  url: string;
}

export interface LessonData {
  id: string;
  title: string;
  order: number;
  isFreePreview: boolean;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  textContent?: string | null;
  durationSeconds: number | null;
  description?: string | null;
  contributors?: { id: string }[];
  resources: LessonResourceData[];
  quiz?: QuizData | null;
}

export function LessonRow({
  lesson,
  courseSlug,
  courseAuthors,
}: {
  lesson: LessonData;
  courseSlug: string;
  courseAuthors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (!confirm(`Eliminar a aula "${lesson.title}"?`)) return;
    const res = await fetch(`/api/instructor/lessons/${lesson.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <LessonForm
        moduleId={null}
        lesson={lesson}
        nextOrder={lesson.order}
        courseAuthors={courseAuthors}
        onDone={() => {
          setEditing(false);
          router.refresh();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {lesson.type === "TEXT" ? (
          <TypeIcon size={16} className="text-slate-400" />
        ) : (
          <Video size={16} className="text-slate-400" />
        )}
        <span>{lesson.title}</span>
        {lesson.isFreePreview && <Badge tone="success">Preview grátis</Badge>}
        {lesson.resources.length > 0 && <Badge>{lesson.resources.length} anexo(s)</Badge>}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/courses/${courseSlug}/lessons/${lesson.id}`} className="text-slate-400 hover:text-slate-900">
          Ver
        </Link>
        <button onClick={() => setEditing(true)} className="text-slate-700 hover:underline">
          Editar
        </button>
        <button onClick={handleDelete} className="text-red-600 hover:underline">
          Eliminar
        </button>
      </div>
    </div>
  );
}
