"use client";

import { useSwipeNav } from "@/lib/useSwipeNav";

export function SwipeNavShell({
  nav,
  previousHref,
  nextHref,
  children,
}: {
  nav?: React.ReactNode;
  previousHref?: string | null;
  nextHref?: string | null;
  children: React.ReactNode;
}) {
  const { handleTouchStart, handleTouchEnd, swipeClassName } = useSwipeNav(previousHref, nextHref);

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={swipeClassName}>
      {nav}
      {children}
    </div>
  );
}
