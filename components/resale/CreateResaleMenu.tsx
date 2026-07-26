"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, BookOpen, Package } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";

// Um botão só, com escolha entre revenda de curso avulso ou bundle — em vez
// de dois botões lado a lado, que ficavam ambíguos sobre qual usar primeiro.
export function CreateResaleMenu({
  canCreateListing,
  canCreateBundle,
}: {
  canCreateListing: boolean;
  canCreateBundle: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!canCreateListing && !canCreateBundle) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          open
            ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        }`}
      >
        <Plus size={15} /> Criar venda
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {canCreateListing && (
            <FadeLink
              href="/resale/listings/new"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <BookOpen size={15} /> Revenda de curso
            </FadeLink>
          )}
          {canCreateBundle && (
            <FadeLink
              href="/resale/bundles/new"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <Package size={15} /> Bundle
            </FadeLink>
          )}
        </div>
      )}
    </div>
  );
}
