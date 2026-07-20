"use client";

import { useEffect, useRef } from "react";
import { useSidebarCollapsed } from "@/components/course/ChatOpenContext";
import { getYouTubeId } from "@/lib/youtube";

export function LessonPlayer({
  lessonId,
  type,
  contentUrl,
  textContent,
  initialWatchedSeconds,
  onComplete,
}: {
  lessonId: string;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  textContent?: string | null;
  initialWatchedSeconds: number;
  onComplete: () => void;
}) {
  const lastSentRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const collapsed = useSidebarCollapsed();
  const youtubeId = contentUrl ? getYouTubeId(contentUrl) : null;

  async function sendProgress(payload: { watchedSeconds?: number; completed?: boolean }) {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, ...payload }),
    });
  }

  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (initialWatchedSeconds > 0 && initialWatchedSeconds < e.currentTarget.duration) {
      e.currentTarget.currentTime = initialWatchedSeconds;
    }
  }

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    const now = Math.floor(video.currentTime);
    if (now - lastSentRef.current < 5) return;
    lastSentRef.current = now;

    const isNearEnd = video.duration > 0 && now / video.duration >= 0.95;
    sendProgress({ watchedSeconds: now, completed: isNearEnd || undefined });
    if (isNearEnd) onComplete();
  }

  async function handleEnded() {
    await sendProgress({ completed: true });
    onComplete();
  }

  // API de mensagens do YouTube (enablejsapi=1): estado 0 = vídeo terminou.
  useEffect(() => {
    if (!youtubeId) return;
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data: unknown;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      const info = (data as { info?: unknown })?.info;
      if ((data as { event?: string })?.event === "onStateChange" && info === 0) {
        handleEnded();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  const playerClassName = `aspect-video w-full rounded-lg bg-black lg:max-w-none ${
    collapsed ? "lg:w-[1080px]" : "lg:w-[800px]"
  }`;

  return (
    <div className="space-y-4">
      {type === "TEXT" ? (
        <div
          className={`overflow-y-auto rounded-lg border border-white/10 bg-slate-950 p-6 lg:max-w-none ${
            collapsed ? "lg:w-[1080px]" : "lg:w-[800px]"
          }`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{textContent}</p>
        </div>
      ) : youtubeId ? (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&enablejsapi=1`}
          title="Vídeo da aula"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: "listening", id: youtubeId, channel: "widget" }),
              "*"
            );
          }}
          className={playerClassName}
        />
      ) : (
        <video
          controls
          className={playerClassName}
          src={contentUrl ?? undefined}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      )}
    </div>
  );
}
