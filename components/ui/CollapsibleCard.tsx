"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function CollapsibleCard({
  title,
  children,
  className = "",
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Sempre começa fechada, em qualquer ecrã — sem correção nenhuma depois de
  // montar (nem useLayoutEffect), por isso sem hipótese nenhuma de mostrar
  // um frame aberta antes de fechar: já nasce assim, no HTML do servidor.
  const [expanded, setExpanded] = useState(false);

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
