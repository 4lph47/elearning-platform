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
    // double rAF: guarantees the browser paints the offset starting position
    // before we flip to settled, so the transition actually animates - the
    // minimum possible gap, tied to the paint cycle instead of a guessed timer.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSwipeEnter(null));
    });
    return () => cancelAnimationFrame(frame);
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
      setTimeout(() => router.push(nextHref), 900);
    } else if (dx > 0 && previousHref) {
      setSwipeExit("right");
      sessionStorage.setItem(STORAGE_KEY, "right");
      setTimeout(() => router.push(previousHref), 900);
    }
  }

  let swipeClassName: string;
  if (swipeExit === "left") {
    swipeClassName = "transition-all duration-[900ms] ease-in -translate-x-10 opacity-0";
  } else if (swipeExit === "right") {
    swipeClassName = "transition-all duration-[900ms] ease-in translate-x-10 opacity-0";
  } else if (swipeEnter === "left") {
    swipeClassName = "transition-all duration-[900ms] ease-out translate-x-10 opacity-0";
  } else if (swipeEnter === "right") {
    swipeClassName = "transition-all duration-[900ms] ease-out -translate-x-10 opacity-0";
  } else {
    swipeClassName = "transition-all duration-[900ms] ease-out translate-x-0 opacity-100";
  }

  return { handleTouchStart, handleTouchEnd, swipeClassName };
}
