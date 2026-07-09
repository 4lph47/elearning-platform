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
}: {
  overview: string;
  resources: LessonResourceData[];
  onSelectResource?: (resource: LessonResourceData) => void;
}) {
  const [tab, setTab] = useState<"overview" | "resources">("overview");

  return (
    <div>
      <div className="flex gap-6 border-b border-slate-200">
        <button
          onClick={() => setTab("overview")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "overview" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Visão geral
        </button>
        <button
          onClick={() => setTab("resources")}
          className={`border-b-2 px-1 py-2 text-sm font-medium ${
            tab === "resources" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Recursos {resources.length > 0 && `(${resources.length})`}
        </button>
      </div>

      <div className="py-4 text-sm text-slate-700">
        {tab === "overview" ? (
          <p className="whitespace-pre-wrap leading-relaxed">{overview}</p>
        ) : resources.length === 0 ? (
          <p className="text-slate-400">Esta aula não tem materiais de apoio.</p>
        ) : (
          <ul className="space-y-2">
            {resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <span className="flex items-center gap-2">
                  {r.type === "SLIDES" ? (
                    <Presentation size={14} className="text-slate-400" />
                  ) : (
                    <Paperclip size={14} className="text-slate-400" />
                  )}
                  {r.name}
                </span>
                <div className="flex items-center gap-3">
                  {onSelectResource && (
                    <button
                      onClick={() => onSelectResource(r)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <Eye size={14} /> Pré-visualizar
                    </button>
                  )}
                  <a
                    href={r.url}
                    download={r.name}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
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
