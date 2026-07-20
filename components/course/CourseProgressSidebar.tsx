import Link from "next/link";
import { ChevronDown, Check, Monitor, Type as TypeIcon, HelpCircle, ClipboardCheck, Lock } from "lucide-react";

interface LessonItem {
  id: string;
  title: string;
  isFreePreview: boolean;
  durationSeconds: number | null;
  type: "VIDEO" | "TEXT";
}

interface ModuleItem {
  id: string;
  title: string;
  lessons: LessonItem[];
  quizId: string | null;
}

function LessonTypeIcon({ type }: { type: "VIDEO" | "TEXT" }) {
  return type === "TEXT" ? (
    <TypeIcon size={16} className="shrink-0 text-slate-600" />
  ) : (
    <Monitor size={16} className="shrink-0 text-slate-600" />
  );
}

function DoneBadge() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600">
      <Check size={10} strokeWidth={3} className="text-white" />
    </span>
  );
}

export function CourseProgressSidebar({
  slug,
  modules,
  progressByLessonId,
  doneQuizIds,
  finalQuizId,
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
  finalQuizId?: string | null;
  isOwner: boolean;
  isEnrolled: boolean;
  currentLessonId?: string;
  percent: number;
  completedCount: number;
  totalLessons: number;
}) {
  const quizAccessible = isOwner || isEnrolled;

  return (
    <div className="sticky top-20 rounded-xl border border-white/10 bg-slate-950">
      <div className="border-b border-white/10 p-4">
        <h2 className="text-sm font-semibold text-slate-100">O teu progresso</h2>
        {isEnrolled ? (
          <div className="mt-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-white">{percent}%</span>
              <span className="pb-1 text-xs text-slate-400">
                {completedCount}/{totalLessons} itens
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Preview grátis — inscreve-te para acompanhar o progresso.</p>
        )}
      </div>
      <div className="max-h-[55vh] overflow-y-auto">
        {modules.map((module, mi) => (
          <div key={module.id} className="border-b border-white/10 last:border-0">
            <details open={module.lessons.some((l) => l.id === currentLessonId)} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-900/60 px-4 py-2">
                <span className="text-sm font-medium text-slate-200">
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
                              ? "border-blue-500 bg-blue-600/10 text-white"
                              : "border-transparent text-slate-300 hover:bg-white/5"
                          }`}
                        >
                          {isDone ? <DoneBadge /> : <LessonTypeIcon type={l.type} />}
                          <span className="flex-1">{l.title}</span>
                          {l.durationSeconds && (
                            <span className="text-xs text-slate-500">{Math.round(l.durationSeconds / 60)}min</span>
                          )}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-500">
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
                        className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                      >
                        {doneQuizIds.has(module.quizId) ? <DoneBadge /> : <HelpCircle size={16} className="shrink-0 text-slate-600" />}
                        <span className="flex-1">Quiz · {module.title}</span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-500">
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

        {finalQuizId && (
          <div className="border-b border-white/10 last:border-0">
            {quizAccessible ? (
              <Link
                href={`/courses/${slug}/quiz/${finalQuizId}`}
                className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"
              >
                {doneQuizIds.has(finalQuizId) ? <DoneBadge /> : <ClipboardCheck size={16} className="shrink-0 text-slate-600" />}
                <span className="flex-1 font-medium">Exame final do curso</span>
              </Link>
            ) : (
              <span className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                <Lock size={16} className="shrink-0" />
                <span className="flex-1 font-medium">Exame final do curso</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
