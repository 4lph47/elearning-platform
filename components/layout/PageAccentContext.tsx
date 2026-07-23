"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export interface PageAccent {
  top: string;
  mid: string;
}

interface PageAccentContextValue {
  accent: PageAccent | null;
  setAccent: (accent: PageAccent | null) => void;
}

const PageAccentContext = createContext<PageAccentContextValue | null>(null);

// Navbar e o conteúdo da página são irmãos em layout.tsx (não pai/filho) —
// uma página como o perfil público do instrutor não consegue passar a sua
// cor para o header via props. Este contexto vive acima dos dois só para
// isso: a página escreve (setAccent), o header lê (accent).
export function PageAccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<PageAccent | null>(null);
  return <PageAccentContext.Provider value={{ accent, setAccent }}>{children}</PageAccentContext.Provider>;
}

export function usePageAccent() {
  const ctx = useContext(PageAccentContext);
  if (!ctx) throw new Error("usePageAccent must be used within PageAccentProvider");
  return ctx;
}
