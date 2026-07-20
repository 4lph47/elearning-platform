"use client";

import { useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { LessonTabs, type LessonResourceData } from "@/components/course/LessonTabs";
import { QuizPlayer } from "@/components/course/QuizPlayer";
import { useChatOpen, useSidebarCollapsed } from "@/components/course/ChatOpenContext";
import { SlideDeckViewer } from "@/components/course/SlideDeckViewer";
import { buildSlideDeck } from "@/lib/slideDeck";
import { SpreadsheetPreviewViewer } from "@/components/course/SpreadsheetPreviewViewer";
import { buildSpreadsheetPreview } from "@/lib/spreadsheetPreview";

interface QuizData {
  id: string;
  title: string;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  attemptsUsed: number;
  questions: { id: string; text: string; options: { id: string; text: string }[] }[];
}

function PreviewContent({ resource }: { resource: LessonResourceData }) {
  if (resource.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resource.url} alt={resource.name} className="h-full w-full object-contain" />;
  }
  if (resource.type === "VIDEO") {
    return <video controls src={resource.url} className="h-full w-full bg-black" />;
  }
  if (resource.type === "SLIDES") {
    return <SlideDeckViewer slides={buildSlideDeck(resource.name)} />;
  }
  if (resource.type === "OTHER" && /\.xlsx?$/i.test(resource.name)) {
    return <SpreadsheetPreviewViewer preview={buildSpreadsheetPreview(resource.name)} />;
  }
  return (
    <iframe
      src={`${resource.url}#toolbar=0&navpanes=0&scrollbar=0`}
      className="h-full w-full border-0"
      title={resource.name}
    />
  );
}

export function LessonBody({
  header,
  lessonId,
  contentUrl,
  initialCompleted,
  initialWatchedSeconds,
  overview,
  resources,
  quiz,
  progress,
}: {
  header: React.ReactNode;
  lessonId: string;
  contentUrl: string;
  initialCompleted: boolean;
  initialWatchedSeconds: number;
  overview: string;
  resources: LessonResourceData[];
  quiz: QuizData | null;
  progress?: React.ReactNode;
}) {
  const chatOpen = useChatOpen();
  const collapsed = useSidebarCollapsed();
  const [previewResource, setPreviewResource] = useState<LessonResourceData | null>(null);
  const [maximized, setMaximized] = useState(false);
  const sideBySide = !chatOpen;
  const inlinePreview = sideBySide && previewResource !== null;
  const inlinePreviewHeight = collapsed ? "h-[88vh]" : "h-[70vh]";

  function closePreview() {
    setPreviewResource(null);
    setMaximized(false);
  }

  return (
    <div>
      {header}

      <div className="mt-4">
        <div className={sideBySide ? "lg:flex lg:items-stretch lg:gap-6" : ""}>
          <div className="lg:shrink-0">
            <LessonPlayer
              lessonId={lessonId}
              contentUrl={contentUrl}
              initialCompleted={initialCompleted}
              initialWatchedSeconds={initialWatchedSeconds}
            />
          </div>

          <div className={sideBySide ? "mt-6 lg:mt-0 lg:min-w-0 lg:flex-1" : ""}>
            {inlinePreview ? (
              <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-slate-950 ${inlinePreviewHeight}`}>
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                  <button
                    onClick={() => setMaximized(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Maximizar preview"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    onClick={closePreview}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Fechar preview"
                  >
                    <X size={14} />
                  </button>
                </div>
                <PreviewContent resource={previewResource} />
              </div>
            ) : (
              <LessonTabs
                overview={overview}
                resources={resources}
                progress={progress}
                onSelectResource={(r) => setPreviewResource((prev) => (prev?.id === r.id ? null : r))}
              />
            )}
          </div>
        </div>

        {!sideBySide && previewResource && (
          <div className="relative mt-3 h-[80vh] w-full overflow-hidden rounded-lg border border-white/10 bg-slate-950">
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
              <button
                onClick={() => setMaximized(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Maximizar preview"
              >
                <Maximize2 size={13} />
              </button>
              <button
                onClick={closePreview}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Fechar preview"
              >
                <X size={14} />
              </button>
            </div>
            <PreviewContent resource={previewResource} />
          </div>
        )}

        {quiz && (
          <div className="mt-6">
            <QuizPlayer
              quizId={quiz.id}
              title={quiz.title}
              questions={quiz.questions}
              maxAttempts={quiz.maxAttempts}
              timeLimitMinutes={quiz.timeLimitMinutes}
              attemptsUsed={quiz.attemptsUsed}
            />
          </div>
        )}
      </div>

      {previewResource && maximized && (
        <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-2xl lg:inset-10">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="truncate text-sm font-medium text-slate-200">{previewResource.name}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMaximized(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10"
                aria-label="Restaurar preview"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={closePreview}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/10"
                aria-label="Fechar preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="relative flex-1">
            <PreviewContent resource={previewResource} />
          </div>
        </div>
      )}
    </div>
  );
}
