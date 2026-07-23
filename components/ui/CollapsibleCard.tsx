"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";

// Mesmo breakpoint usado no resto do layout (SidebarContext.tsx) — em
// mobile há tantas destas cards a separar secções de edição (curso/aula)
// que ver tudo aberto de uma vez é só scroll sem fim; em desktop há espaço
// de sobra, ficam sempre abertas.
const MOBILE_QUERY = "(max-width: 767px)";

export function CollapsibleCard({
  title,
  children,
  className = "",
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(true);

  // useLayoutEffect (não useEffect) — corre antes da 1ª pintura, evita um
  // frame visível com a card aberta em mobile antes de fechar sozinha.
  useLayoutEffect(() => {
    setExpanded(!window.matchMedia(MOBILE_QUERY).matches);
  }, []);

  return (
    <Card className={`overflow-hidden p-0 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
        aria-expanded={expanded}
      >
        <h2 className="font-medium">{title}</h2>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </Card>
  );
}
