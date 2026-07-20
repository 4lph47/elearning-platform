"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, X } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { getYouTubeId } from "@/lib/youtube";

function ytCommand(iframe: HTMLIFrameElement | null, func: string) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

export function CourseHero({
  title,
  description,
  category,
  isDraft,
  rating,
  ratingCount,
  enrollmentsCount,
  instructorId,
  instructorName,
  videoUrl,
  thumbnailUrl,
}: {
  title: string;
  description: string;
  category: string;
  isDraft: boolean;
  rating: number;
  ratingCount: number;
  enrollmentsCount: number;
  instructorId: string;
  instructorName: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!videoUrl || maximized) return;
    hideTimer.current = setTimeout(() => {
      if (youtubeId || !videoRef.current?.paused) setVisible(false);
    }, 3000);
  }

  useEffect(() => {
    if (videoUrl) scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  function handleMouseEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
  }

  function handleMouseMove() {
    setVisible(true);
  }

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function toggleMaximize() {
    if (!videoUrl) return;
    const next = !maximized;
    setMaximized(next);
    setVisible(true);
    if (youtubeId) {
      ytCommand(iframeRef.current, next ? "unMute" : "mute");
    } else if (videoRef.current) {
      videoRef.current.muted = !next;
    }
  }

  return (
    <div
      className="relative -mt-16 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => videoUrl && !paused && !maximized && setVisible(false)}
    >
      <div
        className={
          videoUrl
            ? maximized
              ? "fixed inset-0 z-50 cursor-pointer bg-black"
              : "absolute inset-0 cursor-pointer"
            : "absolute inset-0"
        }
        onClick={toggleMaximize}
      >
        {youtubeId ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`}
            title={title}
            allow="autoplay; encrypted-media"
            className={
              maximized
                ? "pointer-events-none absolute inset-0 h-full w-full"
                : "pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
            }
          />
        ) : videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            onPlay={() => setPaused(false)}
            onPause={() => {
              setPaused(true);
              setVisible(true);
            }}
            className="h-full w-full object-cover"
          />
        ) : thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-slate-900" />
        )}
        {!maximized && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/20 to-transparent" />
          </>
        )}
      </div>

      {videoUrl && (
        <div
          className={`z-10 flex items-center gap-2 transition-opacity duration-300 ${
            maximized ? "fixed right-4 top-20" : "absolute bottom-4 right-4"
          } ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {!youtubeId && !maximized && (
            <button
              onClick={togglePlay}
              aria-label={paused ? "Reproduzir trailer" : "Pausar trailer"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximize();
            }}
            aria-label={maximized ? "Minimizar trailer" : "Maximizar trailer"}
            className={
              maximized
                ? "flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                : "flex h-9 items-center justify-center rounded-full bg-black/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-black/80"
            }
          >
            {maximized ? <X size={16} /> : "Ecrã inteiro"}
          </button>
        </div>
      )}

      {!maximized && (
        <div className="pointer-events-none relative flex min-h-[520px] items-center px-3 py-14 pt-24 sm:min-h-[600px] sm:px-6 sm:py-20 sm:pt-28">
          <div
            className={`pointer-events-auto max-w-xl text-left transition-all duration-300 ${
              visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Link href="/courses" className="hover:text-white hover:underline">
                Cursos
              </Link>
              <span>/</span>
              <Link href={`/courses?category=${encodeURIComponent(category)}`} className="hover:text-white hover:underline">
                {category}
              </Link>
            </nav>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                {category}
              </span>
              {isDraft && (
                <span className="inline-block rounded border border-white/25 px-2 py-0.5 text-xs font-medium text-slate-300">
                  Rascunho
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 text-slate-300">{description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {ratingCount > 0 && <StarRating rating={rating} count={ratingCount} tone="dark" />}
              <span className="text-slate-400">
                {enrollmentsCount} aluno{enrollmentsCount !== 1 ? "s" : ""} matriculado{enrollmentsCount !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Criado por{" "}
              <Link href={`/instructors/${instructorId}`} className="font-medium text-slate-200 hover:text-blue-400">
                {instructorName}
              </Link>
            </p>
          </div>
        </div>
      )}
      {maximized && <div className="min-h-[520px] sm:min-h-[600px]" aria-hidden />}
    </div>
  );
}
