import Link from "next/link";
import { ChevronDown, Check, CheckCircle2, Lock } from "lucide-react";

interface LessonItem {
  id: string;
  title: string;
  isFreePreview: boolean;
  durationSeconds: number | null;
}

interface ModuleItem {
  id: string;
  title: string;
  lessons: LessonItem[];
  quizId: string | null;
}

export function CourseProgressSidebar({
  slug,
  modules,
  progressByLessonId,
  doneQuizIds,
  isOwner,
  isEnrolled,
  currentLessonId,
  percent,
  completedCount,
  totalLessons,
}: {
  slug: string;
  modules: ModuleItem[];
  progressByLessonId: Record<string, boolean>;
  doneQuizIds: Set<string>;
  isOwner: boolean;
  isEnrolled: boolean;
  currentLessonId?: string;
  percent: number;
  completedCount: number;
  totalLessons: number;
}) {
  const quizAccessible = isOwner || isEnrolled;

  return (
    <div className="sticky top-20 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800">O teu progresso</h2>
        {isEnrolled ? (
          <div className="mt-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900">{percent}%</span>
              <span className="pb-1 text-xs text-slate-500">
                {completedCount}/{totalLessons} itens
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-slate-900 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Preview grátis — matricula-te para acompanhar o progresso.</p>
        )}
      </div>
      <div className="max-h-[55vh] overflow-y-auto">
        {modules.map((module, mi) => (
          <div key={module.id} className="border-b border-slate-100 last:border-0">
            <details open={module.lessons.some((l) => l.id === currentLessonId)} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 px-4 py-2">
                <span className="text-sm font-medium text-slate-700">
                  Módulo {mi + 1} · {module.title}
                </span>
                <ChevronDown size={14} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <ul>
                {module.lessons.map((l) => {
                  const accessible = isOwner || isEnrolled || l.isFreePreview;
                  const isCurrent = l.id === currentLessonId;
                  const isDone = progressByLessonId[l.id];
                  return (
                    <li key={l.id}>
                      {accessible ? (
                        <Link
                          href={`/courses/${slug}/lessons/${l.id}`}
                          className={`flex items-center gap-2 border-l-4 px-4 py-2 text-sm ${
                            isCurrent
                              ? "border-slate-900 bg-slate-100 text-slate-900"
                              : "border-transparent text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {isDone ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900">
                              <Check size={10} strokeWidth={3} className="text-white" />
                            </span>
                          ) : (
                            <CheckCircle2 size={16} className="shrink-0 text-slate-300" />
                          )}
                          <span className="flex-1">{l.title}</span>
                          {l.durationSeconds && (
                            <span className="text-xs text-slate-400">{Math.round(l.durationSeconds / 60)}min</span>
                          )}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-400">
                          <Lock size={16} className="shrink-0" />
                          <span className="flex-1">{l.title}</span>
                        </span>
                      )}
                    </li>
                  );
                })}

                {module.quizId && (
                  <li>
                    {quizAccessible ? (
                      <Link
                        href={`/courses/${slug}/quiz/${module.quizId}`}
                        className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        {doneQuizIds.has(module.quizId) ? (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900">
                            <Check size={10} strokeWidth={3} className="text-white" />
                          </span>
                        ) : (
                          <CheckCircle2 size={16} className="shrink-0 text-slate-300" />
                        )}
                        <span className="flex-1">Quiz · {module.title}</span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-400">
                        <Lock size={16} className="shrink-0" />
                        <span className="flex-1">Quiz · {module.title}</span>
                      </span>
                    )}
                  </li>
                )}
              </ul>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
