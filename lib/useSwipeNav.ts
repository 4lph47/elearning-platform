"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "swipeNavDir";

export function useSwipeNav(previousHref?: string | null, nextHref?: string | null) {
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const [swipeExit, setSwipeExit] = useState<"left" | "right" | null>(null);
  const [swipeEnter, setSwipeEnter] = useState<"left" | "right" | null>(() => {
    if (typeof window === "undefined") return null;
    const dir = sessionStorage.getItem(STORAGE_KEY);
    if (dir === "left" || dir === "right") {
      sessionStorage.removeItem(STORAGE_KEY);
      return dir;
    }
    return null;
  });

  useEffect(() => {
    if (!swipeEnter) return;
    const t = setTimeout(() => setSwipeEnter(null), 20);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || window.innerWidth >= 1024) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.t;
    const isSwipe = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && elapsed < 600;
    if (!isSwipe) return;

    if (dx < 0 && nextHref) {
      setSwipeExit("left");
      sessionStorage.setItem(STORAGE_KEY, "left");
      setTimeout(() => router.push(nextHref), 180);
    } else if (dx > 0 && previousHref) {
      setSwipeExit("right");
      sessionStorage.setItem(STORAGE_KEY, "right");
      setTimeout(() => router.push(previousHref), 180);
    }
  }

  const swipeStateClassName =
    swipeExit === "left"
      ? "-translate-x-10 opacity-0"
      : swipeExit === "right"
      ? "translate-x-10 opacity-0"
      : swipeEnter === "left"
      ? "translate-x-10 opacity-0"
      : swipeEnter === "right"
      ? "-translate-x-10 opacity-0"
      : "translate-x-0 opacity-100";

  const swipeClassName = `transition-all duration-200 ease-in ${swipeStateClassName}`;

  return { handleTouchStart, handleTouchEnd, swipeClassName };
}
