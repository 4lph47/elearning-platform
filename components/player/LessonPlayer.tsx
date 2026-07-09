"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSidebarCollapsed } from "@/components/course/ChatOpenContext";

export function LessonPlayer({
  lessonId,
  contentUrl,
  initialCompleted,
  initialWatchedSeconds,
}: {
  lessonId: string;
  contentUrl: string;
  initialCompleted: boolean;
  initialWatchedSeconds: number;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const lastSentRef = useRef(0);
  const collapsed = useSidebarCollapsed();

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
    if (isNearEnd) setCompleted(true);
  }

  async function markComplete() {
    await sendProgress({ completed: true });
    setCompleted(true);
  }

  return (
    <div className="space-y-4">
      <video
        controls
        className={`aspect-video w-full rounded-lg bg-black lg:max-w-none ${
          collapsed ? "lg:w-[1080px]" : "lg:w-[800px]"
        }`}
        src={contentUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={markComplete}
      />

      {completed ? (
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900">
            <Check size={12} strokeWidth={3} className="text-white" />
          </span>
          Aula concluída
        </p>
      ) : (
        <Button onClick={markComplete} variant="outline">
          Marcar como concluída
        </Button>
      )}
    </div>
  );
}
