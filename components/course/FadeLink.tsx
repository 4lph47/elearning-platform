"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useFadeNav } from "@/components/course/FadeNavContext";

// Link genérico com a mesma transição fade-out/fade-in do resto do site
// (FadeNavContext) — clique normal intercetado; ctrl/cmd/shift/middle-click
// e afins continuam a abrir em separado (comportamento nativo do <a>).
export function FadeLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const { fadeNavigate } = useFadeNav();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    fadeNavigate(href.toString());
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
