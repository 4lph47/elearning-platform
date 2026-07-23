"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSwipeNav } from "@/lib/useSwipeNav";

export function SwipeNavShell({
  previousHref,
  previousTitle,
  nextHref,
  nextTitle,
  children,
}: {
  previousHref?: string | null;
  previousTitle?: string | null;
  nextHref?: string | null;
  nextTitle?: string | null;
  children: React.ReactNode;
}) {
  const { handleTouchStart, handleTouchEnd, swipeClassName, goPrevious, goNext, showSpinner } = useSwipeNav(
    previousHref,
    nextHref
  );

  return (
    <div className="overflow-x-hidden">
      {showSpinner && (
        <div className="pointer-events-none fixed inset-0 z-[998] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-white/15 dark:border-t-white/70" />
        </div>
      )}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={swipeClassName}>
        <div className="mb-4 flex items-center justify-between">
          {previousHref && (
            <button
              type="button"
              onClick={goPrevious}
              className="inline-flex min-w-0 items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft size={14} className="shrink-0" />
              <span className="truncate">
                Aula anterior{previousTitle && <span className="hidden sm:inline">: {previousTitle}</span>}
              </span>
            </button>
          )}
          {nextHref && (
            <button
              type="button"
              onClick={goNext}
              className="ml-auto inline-flex min-w-0 items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              <span className="truncate">
                Próxima aula{nextTitle && <span className="hidden sm:inline">: {nextTitle}</span>}
              </span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
