"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export const ACCENT_COLORS: Record<string, { accent: string; hover: string; label: string }> = {
  blue: { accent: "#2563eb", hover: "#3b82f6", label: "Azul" },
  violet: { accent: "#7c3aed", hover: "#8b5cf6", label: "Violeta" },
  emerald: { accent: "#059669", hover: "#10b981", label: "Verde" },
  rose: { accent: "#e11d48", hover: "#f43f5e", label: "Rosa" },
  amber: { accent: "#d97706", hover: "#f59e0b", label: "Âmbar" },
  slate: { accent: "#334155", hover: "#475569", label: "Cinza" },
};

// Aplica as preferências de "Definições > Aparência" (cor de destaque,
// tamanho do texto, reduzir animações) assim que a sessão carrega — só no
// cliente, via CSS vars/atributos em <html> lidos por app/globals.css.
// Sem isto cada página teria de ir buscar e aplicar isto sozinha.
export function AppearanceEffects() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => {
        if (cancelled) return;
        const palette = ACCENT_COLORS[d.accentColor as string] ?? ACCENT_COLORS.blue;
        document.documentElement.style.setProperty("--accent", palette.accent);
        document.documentElement.style.setProperty("--accent-hover", palette.hover);
        document.documentElement.setAttribute("data-font-size", d.fontSize ?? "md");
        document.documentElement.setAttribute("data-reduce-motion", String(Boolean(d.reduceMotion)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, session?.user.id]);

  return null;
}
