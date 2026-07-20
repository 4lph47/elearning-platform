"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { getYouTubeId } from "@/lib/youtube";
import type { CourseCardData } from "@/components/course/CourseCard";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

export function CourseTile({
  course,
  className = "",
  href,
  progressPercent,
  hidePrice,
}: {
  course: CourseCardData;
  className?: string;
  href?: string;
  progressPercent?: number;
  hidePrice?: boolean;
}) {
  const [showTrailer, setShowTrailer] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const youtubeId = course.trailerUrl ? getYouTubeId(course.trailerUrl) : null;

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  function handleEnter() {
    if (!course.trailerUrl) return;
    hoverTimer.current = setTimeout(() => setShowTrailer(true), 500);
  }

  function handleLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowTrailer(false);
  }

  return (
    <Link
      href={href ?? `/courses/${course.slug}`}
      prefetch
      className={`group block ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-blue-500/60 group-hover:shadow-lg group-hover:shadow-black/40">
        {showTrailer && youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
            title={course.title}
            allow="autoplay; encrypted-media"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        ) : showTrailer && course.trailerUrl ? (
          <video src={course.trailerUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
        ) : course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-500">
            {course.title.charAt(0).toUpperCase()}
          </div>
        )}

        {!showTrailer && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black">
              <Play size={15} fill="currentColor" />
            </span>
          </div>
        )}

        {!hidePrice && (
          <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {course.price === 0 ? "Grátis" : `${course.price.toFixed(2)}€`}
          </span>
        )}

        {typeof progressPercent === "number" && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
            <div className="h-full bg-blue-500" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-blue-600 dark:text-blue-400">{course.category}</span>
          <span className="text-slate-400 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">{LEVEL_LABEL[course.level] ?? course.level}</span>
        </div>
        <h3 className="mt-0.5 line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {course.title}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {course.instructorName} · {course.lessonCount} aulas
        </p>
        {course.ratingCount > 0 && (
          <div className="mt-1">
            <StarRating rating={course.rating} count={course.ratingCount} />
          </div>
        )}
      </div>
    </Link>
  );
}
