"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Lock, Printer, Award, Monitor, Type as TypeIcon, HelpCircle } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewForm } from "@/components/course/ReviewForm";

interface LessonItem {
  id: string;
  title: string;
  isFreePreview: boolean;
  durationSeconds: number | null;
  type: "VIDEO" | "TEXT";
  quiz: { id: string } | null;
}

interface ModuleItem {
  id: string;
  title: string;
  lessons: LessonItem[];
  quiz: { id: string } | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  userName: string;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function CourseDetailTabs({
  courseId,
  courseSlug,
  courseTitle,
  modules,
  isEnrolled,
  isOwner,
  reviews,
  myReview,
  completion,
  studentName,
}: {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  modules: ModuleItem[];
  isEnrolled: boolean;
  isOwner: boolean;
  reviews: ReviewItem[];
  myReview: { rating: number; comment: string } | null;
  completion: { percent: number; completedCount: number; totalItems: number } | null;
  studentName: string | null;
}) {
  const [tab, setTab] = useState<"programa" | "avaliacoes" | "certificado">("programa");
  const allLessons = modules.flatMap((m) => m.lessons);
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
  const quizAccessible = isEnrolled || isOwner;
  const reviewsAvg = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div>
      <div className="flex gap-6 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => setTab("programa")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "programa"
              ? "border-blue-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Programa
        </button>
        <button
          onClick={() => setTab("avaliacoes")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "avaliacoes"
              ? "border-blue-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Avaliações {reviews.length > 0 && `(${reviews.length})`}
        </button>
        <button
          onClick={() => setTab("certificado")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "certificado"
              ? "border-blue-500 text-slate-900 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Certificado
        </button>
      </div>

      <div className="py-5">
        {tab === "programa" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {modules.length} módulos · {allLessons.length} aulas · {formatDuration(totalDuration)} de vídeo
            </p>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
              {modules.map((module, mi) => {
                const moduleDuration = module.lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
                return (
                  <div key={module.id}>
                    <details open={mi === 0} className="group bg-white dark:bg-slate-950">
                      <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 px-4 py-3 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800/60">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          Módulo {mi + 1} · {module.title}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {module.lessons.length} aulas · {formatDuration(moduleDuration)}
                          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <ul className="divide-y divide-slate-100 dark:divide-white/5">
                        {module.lessons.map((lesson) => {
                          const accessible = isEnrolled || isOwner || lesson.isFreePreview;
                          const content = (
                            <div className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <span className="flex items-center gap-2">
                                {lesson.type === "TEXT" ? (
                                  <TypeIcon size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
                                ) : (
                                  <Monitor size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
                                )}
                                <span className={accessible ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                                  {lesson.title}
                                </span>
                                {lesson.isFreePreview && !isEnrolled && !isOwner && (
                                  <span className="whitespace-nowrap rounded-full bg-blue-600/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                    Preview grátis
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                {lesson.durationSeconds ? formatDuration(lesson.durationSeconds) : ""}
                                {!accessible && <Lock size={14} />}
                              </span>
                            </div>
                          );

                          return (
                            <li key={lesson.id}>
                              {accessible ? (
                                <Link href={`/courses/${courseSlug}/lessons/${lesson.id}`}>{content}</Link>
                              ) : (
                                content
                              )}
                              {lesson.quiz && (
                                <div className="pl-6">
                                  {quizAccessible && accessible ? (
                                    <Link href={`/courses/${courseSlug}/quiz/${lesson.quiz.id}`}>
                                      <div className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <span className="flex items-center gap-2">
                                          <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
                                          <span className="text-slate-700 dark:text-slate-200">Quiz · {lesson.title}</span>
                                        </span>
                                      </div>
                                    </Link>
                                  ) : (
                                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                                      <span className="flex items-center gap-2">
                                        <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
                                        <span className="text-slate-400 dark:text-slate-500">Quiz · {lesson.title}</span>
                                      </span>
                                      <Lock size={14} className="text-slate-400 dark:text-slate-500" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}

                        {module.quiz && (
                          <li>
                            {quizAccessible ? (
                              <Link href={`/courses/${courseSlug}/quiz/${module.quiz.id}`}>
                                <div className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                  <span className="flex items-center gap-2">
                                    <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
                                    <span className="text-slate-700 dark:text-slate-200">Quiz · {module.title}</span>
                                  </span>
                                </div>
                              </Link>
                            ) : (
                              <div className="flex items-center justify-between px-4 py-3 text-sm">
                                <span className="flex items-center gap-2">
                                  <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-600" />
                                  <span className="text-slate-400 dark:text-slate-500">Quiz · {module.title}</span>
                                </span>
                                <Lock size={14} className="text-slate-400 dark:text-slate-500" />
                              </div>
                            )}
                          </li>
                        )}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "avaliacoes" && (
          <div className="space-y-5">
            {reviews.length > 0 && (
              <div className="flex items-center gap-3">
                <StarRating rating={reviewsAvg} count={reviews.length} size="md" />
              </div>
            )}

            {isEnrolled && <ReviewForm courseId={courseId} initialRating={myReview?.rating} initialComment={myReview?.comment} />}

            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há avaliações para este curso.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {initials(r.userName)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.userName}</p>
                        <StarRating rating={r.rating} />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "certificado" &&
          (isEnrolled && completion && completion.percent >= 100 ? (
            <div>
              <div
                id="certificate"
                className="rounded-xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-50 to-white p-10 text-center dark:from-slate-900 dark:to-slate-950"
              >
                <Award size={40} className="mx-auto text-blue-600 dark:text-blue-400" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  Certificado de conclusão
                </p>
                <h3 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{studentName ?? "Aluno"}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">concluiu com sucesso o curso</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{courseTitle}</p>
                <p className="mt-4 text-xs text-slate-500">
                  {new Date().toLocaleDateString("pt-PT", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="mx-auto mt-4 flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <Printer size={16} /> Imprimir / Guardar PDF
              </button>
            </div>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-50 to-white p-10 text-center dark:from-slate-900 dark:to-slate-950">
                <div className="pointer-events-none select-none blur-[3px]">
                  <Award size={40} className="mx-auto text-blue-600 dark:text-blue-400" />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    Certificado de conclusão
                  </p>
                  <h3 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{studentName ?? "O teu nome aqui"}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">concluiu com sucesso o curso</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{courseTitle}</p>
                  <p className="mt-4 text-xs text-slate-500">
                    {new Date().toLocaleDateString("pt-PT", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 px-6 text-center dark:bg-black/55">
                  <Lock size={22} className="text-slate-600 dark:text-slate-300" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {!isEnrolled
                      ? "Inscreve-te no curso para poderes ganhar este certificado"
                      : "Completa o curso para desbloquear o teu certificado"}
                  </p>
                </div>
              </div>

              {isEnrolled && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-blue-600 transition-all"
                      style={{ width: `${completion?.percent ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {completion?.completedCount ?? 0}/{completion?.totalItems ?? 0} itens concluídos (
                    {completion?.percent ?? 0}%)
                  </p>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
