"use client";

import { Fragment, useRef } from "react";
import Link from "next/link";
import { ChevronDown, Check, Monitor, Type as TypeIcon, HelpCircle, ClipboardCheck, Lock } from "lucide-react";
import { textBoxFromElement } from "@/components/course/CardTransitionContext";
import { useTextFly } from "@/components/course/TextFlyContext";

interface LessonItem {
  id: string;
  title: string;
  isFreePreview: boolean;
  durationSeconds: number | null;
  type: "VIDEO" | "TEXT";
  order: number;
  quizId: string | null;
}

interface ModuleQuizItem {
  id: string;
  title: string;
  order: number;
}

interface ModuleItem {
  id: string;
  title: string;
  lessons: LessonItem[];
  quizzes: ModuleQuizItem[];
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

// Aula+quiz próprio (item.kind "lesson") ou quiz de módulo (item.kind "quiz")
// intercalados por `order` — mesma posição que o instrutor definiu ao
// arrastar (ver app/api/instructor/modules/[moduleId]/reorder/route.ts).
type MergedEntry =
  | { kind: "lesson"; order: number; lesson: LessonItem }
  | { kind: "quiz"; order: number; quiz: ModuleQuizItem };

function mergeModuleItems(module: ModuleItem): MergedEntry[] {
  return [
    ...module.lessons.map((lesson) => ({ kind: "lesson" as const, order: lesson.order, lesson })),
    ...module.quizzes.map((quiz) => ({ kind: "quiz" as const, order: quiz.order, quiz })),
  ].sort((a, b) => a.order - b.order);
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
  currentQuizId,
  percent,
  completedCount,
  totalLessons,
}: {
  slug: string;
  modules: ModuleItem[];
  progressByLessonId: Record<string, boolean>;
  doneQuizIds: string[];
  finalQuizId?: string | null;
  isOwner: boolean;
  isEnrolled: boolean;
  currentLessonId?: string;
  currentQuizId?: string;
  percent: number;
  completedCount: number;
  totalLessons: number;
}) {
  const quizAccessible = isOwner || isEnrolled;
  const doneQuizIdSet = new Set(doneQuizIds);
  const { state: textFlyState, start: startTitleFly } = useTextFly();
  const titleRefs = useRef(new Map<string, HTMLSpanElement>());

  function handleLessonClick(lessonId: string, title: string) {
    const el = titleRefs.current.get(lessonId);
    if (!el) return;
    startTitleFly(lessonId, title, textBoxFromElement(el));
  }

  return (
    <div className="sticky top-20 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900">
      <div className="border-b border-slate-200 p-4 dark:border-white/10">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">O teu progresso</h2>
        {isEnrolled ? (
          <div className="mt-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{percent}%</span>
              <span className="pb-1 text-xs text-slate-500 dark:text-slate-400">
                {completedCount}/{totalLessons} itens
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Preview grátis — inscreve-te para acompanhar o progresso.</p>
        )}
      </div>
      <div className="max-h-[55vh] overflow-y-auto">
        {modules.map((module, mi) => (
          <div key={module.id} className="border-b border-slate-200 last:border-0 dark:border-white/10">
            <details open={module.lessons.some((l) => l.id === currentLessonId)} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 px-4 py-2 dark:bg-slate-900/60">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Módulo {mi + 1} · {module.title}
                </span>
                <ChevronDown size={14} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <ul>
                {mergeModuleItems(module).map((entry) => {
                  if (entry.kind === "quiz") {
                    const quiz = entry.quiz;
                    return (
                      <li key={quiz.id}>
                        {quizAccessible ? (
                          <Link
                            href={`/courses/${slug}/quiz/${quiz.id}`}
                            prefetch
                            onClick={() => handleLessonClick(quiz.id, `Quiz · ${quiz.title}`)}
                            className={`flex items-center gap-2 border-l-4 px-4 py-2 text-sm ${
                              quiz.id === currentQuizId
                                ? "border-blue-500 bg-blue-600/10 text-slate-900 dark:text-white"
                                : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                            }`}
                          >
                            {doneQuizIdSet.has(quiz.id) ? <DoneBadge /> : <HelpCircle size={16} className="shrink-0 text-slate-600" />}
                            <span
                              ref={(el) => {
                                if (el) titleRefs.current.set(quiz.id, el);
                              }}
                              style={{
                                visibility: textFlyState?.id === quiz.id && !textFlyState.revealed ? "hidden" : "visible",
                              }}
                              className="flex-1"
                            >
                              Quiz · {quiz.title}
                            </span>
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-400 dark:text-slate-500">
                            <Lock size={16} className="shrink-0" />
                            <span className="flex-1">Quiz · {quiz.title}</span>
                          </span>
                        )}
                      </li>
                    );
                  }

                  const l = entry.lesson;
                  const accessible = isOwner || isEnrolled || l.isFreePreview;
                  const isCurrent = l.id === currentLessonId;
                  const isDone = progressByLessonId[l.id];
                  return (
                    <Fragment key={l.id}>
                      <li>
                        {accessible ? (
                          <Link
                            href={`/courses/${slug}/lessons/${l.id}`}
                            prefetch
                            onClick={() => handleLessonClick(l.id, l.title)}
                            className={`flex items-center gap-2 border-l-4 px-4 py-2 text-sm ${
                              isCurrent
                                ? "border-blue-500 bg-blue-600/10 text-slate-900 dark:text-white"
                                : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                            }`}
                          >
                            {isDone ? <DoneBadge /> : <LessonTypeIcon type={l.type} />}
                            <span
                              ref={(el) => {
                                if (el) titleRefs.current.set(l.id, el);
                              }}
                              style={{
                                visibility: textFlyState?.id === l.id && !textFlyState.revealed ? "hidden" : "visible",
                              }}
                              className="flex-1"
                            >
                              {l.title}
                            </span>
                            {l.durationSeconds && (
                              <span className="text-xs text-slate-400 dark:text-slate-500">{Math.round(l.durationSeconds / 60)}min</span>
                            )}
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 text-sm text-slate-400 dark:text-slate-500">
                            <Lock size={16} className="shrink-0" />
                            <span className="flex-1">{l.title}</span>
                          </span>
                        )}
                      </li>
                      {l.quizId && (
                        <li>
                          {accessible ? (
                            <Link
                              href={`/courses/${slug}/quiz/${l.quizId}`}
                              prefetch
                              onClick={() => handleLessonClick(l.quizId!, `Quiz · ${l.title}`)}
                              className={`flex items-center gap-2 border-l-4 px-4 py-2 pl-8 text-sm ${
                                l.quizId === currentQuizId
                                  ? "border-blue-500 bg-blue-600/10 text-slate-900 dark:text-white"
                                  : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                              }`}
                            >
                              {doneQuizIdSet.has(l.quizId) ? <DoneBadge /> : <HelpCircle size={16} className="shrink-0 text-slate-600" />}
                              <span
                                ref={(el) => {
                                  if (el && l.quizId) titleRefs.current.set(l.quizId, el);
                                }}
                                style={{
                                  visibility:
                                    textFlyState?.id === l.quizId && !textFlyState.revealed ? "hidden" : "visible",
                                }}
                                className="flex-1"
                              >
                                Quiz · {l.title}
                              </span>
                            </Link>
                          ) : (
                            <span className="flex items-center gap-2 border-l-4 border-transparent px-4 py-2 pl-8 text-sm text-slate-400 dark:text-slate-500">
                              <Lock size={16} className="shrink-0" />
                              <span className="flex-1">Quiz · {l.title}</span>
                            </span>
                          )}
                        </li>
                      )}
                    </Fragment>
                  );
                })}
              </ul>
            </details>
          </div>
        ))}

        {finalQuizId && (
          <div className="border-b border-slate-200 dark:border-white/10 last:border-0">
            {quizAccessible ? (
              <Link
                href={`/courses/${slug}/quiz/${finalQuizId}`}
                prefetch
                onClick={() => handleLessonClick(finalQuizId, "Exame final do curso")}
                className={`flex items-center gap-2 px-4 py-3 text-sm ${
                  finalQuizId === currentQuizId
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                {doneQuizIdSet.has(finalQuizId) ? <DoneBadge /> : <ClipboardCheck size={16} className="shrink-0 text-slate-600" />}
                <span
                  ref={(el) => {
                    if (el) titleRefs.current.set(finalQuizId, el);
                  }}
                  style={{
                    visibility: textFlyState?.id === finalQuizId && !textFlyState.revealed ? "hidden" : "visible",
                  }}
                  className="flex-1 font-medium"
                >
                  Exame final do curso
                </span>
              </Link>
            ) : (
              <span className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
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
