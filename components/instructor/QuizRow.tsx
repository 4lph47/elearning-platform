"use client";

import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/Card";
import { FadeLink } from "@/components/course/FadeLink";

export interface ModuleQuizData {
  id: string;
  title: string;
  order: number;
  questions: { id: string }[];
}

// Quiz de módulo é um item da lista igual a uma aula (ver ModuleSection.tsx)
// — pode estar em qualquer posição entre aulas, arrastável como elas.
export function QuizRow({
  quiz,
  courseId,
  moduleId,
}: {
  quiz: ModuleQuizData;
  courseId: string;
  moduleId: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Eliminar o quiz "${quiz.title}"?`)) return;
    const res = await fetch(`/api/instructor/quizzes/${quiz.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-1.5 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="truncate">{quiz.title}</span>
        <Badge>{quiz.questions.length} pergunta{quiz.questions.length !== 1 ? "s" : ""}</Badge>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        <FadeLink
          href={`/instructor/courses/${courseId}/modules/${moduleId}/quizzes/${quiz.id}`}
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
