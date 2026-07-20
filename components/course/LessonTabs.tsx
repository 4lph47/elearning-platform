"use client";

import { useState } from "react";
import Link from "next/link";
import { Paperclip, Eye, Presentation } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

export interface LessonResourceData {
  id: string;
  name: string;
  url: string;
  type: "PDF" | "IMAGE" | "VIDEO" | "OTHER" | "SLIDES";
}

export interface VideoMeta {
  authors: { id: string; name: string }[];
  viewCount: number;
  likeCount: number;
  createdAt: string;
}

export function LessonTabs({
  overview,
  resources,
  onSelectResource,
  progress,
  comments,
  videoMeta,
}: {
  overview: string;
  resources: LessonResourceData[];
  onSelectResource?: (resource: LessonResourceData) => void;
  progress?: React.ReactNode;
  comments?: React.ReactNode;
  videoMeta?: VideoMeta;
}) {
  const [tab, setTab] = useState<"overview" | "resources" | "progress" | "comments">("overview");

  return (
    <div>
      <div className="flex gap-6">
        <button
          onClick={() => setTab("overview")}
          className={`px-1 py-2 text-sm font-medium ${
            tab === "overview" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Geral
        </button>
        <button
          onClick={() => setTab("resources")}
          className={`px-1 py-2 text-sm font-medium ${
            tab === "resources" ? "text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Recursos {resources.length > 0 && `(${resources.length})`}
        </button>
        {progress && (
          <button
            onClick={() => setTab("progress")}
            className={`px-1 py-2 text-sm font-medium lg:hidden ${
              tab === "progress" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Progresso
          </button>
        )}
        {comments && (
          <button
            onClick={() => setTab("comments")}
            className={`px-1 py-2 text-sm font-medium lg:hidden ${
              tab === "comments" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Comentários
          </button>
        )}
      </div>

      <div className={tab === "progress" || tab === "comments" ? "py-4" : "py-4 text-sm text-slate-300"}>
        {tab === "progress" ? (
          progress
        ) : tab === "comments" ? (
          comments
        ) : tab === "overview" ? (
          <div>
            <p className="whitespace-pre-wrap leading-relaxed">{overview}</p>

            {videoMeta && (
              <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
                {videoMeta.authors[0] && (
                  <Link
                    href={`/instructors/${videoMeta.authors[0].id}`}
                    className="flex items-center gap-3 hover:text-white"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {videoMeta.authors[0].name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {videoMeta.authors.map((a) => a.name).join(", ")}
                      </p>
                      <p className="text-xs text-slate-500">
                        Instrutor{videoMeta.authors.length > 1 ? "es" : ""} desta aula
                      </p>
                    </div>
                  </Link>
                )}

                <div>
                  <p className="text-sm font-semibold text-white">Detalhes da aula</p>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Publicada</dt>
                      <dd className="text-slate-200">{timeAgo(videoMeta.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Visualizações</dt>
                      <dd className="text-slate-200">{videoMeta.viewCount.toLocaleString("pt-PT")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Gostos</dt>
                      <dd className="text-slate-200">{videoMeta.likeCount.toLocaleString("pt-PT")}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        ) : resources.length === 0 ? (
          <p className="text-slate-500">Esta aula não tem materiais de apoio.</p>
        ) : (
          <ul className="space-y-2">
            {resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                <span className="flex items-center gap-2">
                  {r.type === "SLIDES" ? (
                    <Presentation size={14} className="text-slate-500" />
                  ) : (
                    <Paperclip size={14} className="text-slate-500" />
                  )}
                  {r.name}
                </span>
                <div className="flex items-center gap-3">
                  {onSelectResource && (
                    <button
                      onClick={() => onSelectResource(r)}
                      className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                    >
                      <Eye size={14} /> Pré-visualizar
                    </button>
                  )}
                  <a
                    href={r.url}
                    download={r.name}
                    className="text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Descarregar
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
