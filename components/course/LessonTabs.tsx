"use client";

import { useState } from "react";
import { Paperclip, Eye, Presentation } from "lucide-react";

export interface LessonResourceData {
  id: string;
  name: string;
  url: string;
  type: "PDF" | "IMAGE" | "VIDEO" | "OTHER" | "SLIDES";
}

export function LessonTabs({
  overview,
  resources,
  onSelectResource,
  progress,
  comments,
}: {
  overview: string;
  resources: LessonResourceData[];
  onSelectResource?: (resource: LessonResourceData) => void;
  progress?: React.ReactNode;
  comments?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"overview" | "resources" | "progress" | "comments">("overview");

  return (
    <div>
      <div className="flex gap-6 border-b border-white/10">
        <button
          onClick={() => setTab("overview")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "overview" ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Visão geral
        </button>
        <button
          onClick={() => setTab("resources")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "resources" ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          Recursos {resources.length > 0 && `(${resources.length})`}
        </button>
        {progress && (
          <button
            onClick={() => setTab("progress")}
            className={`border-b-2 px-1 py-2 text-sm font-medium lg:hidden ${
              tab === "progress" ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            Progresso
          </button>
        )}
        {comments && (
          <button
            onClick={() => setTab("comments")}
            className={`border-b-2 px-1 py-2 text-sm font-medium lg:hidden ${
              tab === "comments" ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
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
          <p className="whitespace-pre-wrap leading-relaxed">{overview}</p>
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
