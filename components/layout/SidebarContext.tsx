"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type SidebarState = "closed" | "full" | "mini";

interface SidebarContextValue {
  state: SidebarState;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

// Md breakpoint (768px) — mesmo valor usado no Tailwind `md:` do resto do layout.
const MOBILE_QUERY = "(max-width: 767px)";

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Começa sempre "closed" — mesmo em desktop. Não há como saber o tamanho
  // do ecrã no servidor, e arrancar em "mini" (visível, só minimizada)
  // dava um frame da barra à mostra antes de sabermos se era mobile ou
  // desktop. Escondida por omissão elimina esse frame nos dois casos; a
  // 1ª correção abaixo é que decide se expande (desktop) ou fica assim
  // (mobile).
  const [state, setState] = useState<SidebarState>("closed");
  const isMobileRef = useRef(false);
  const hasSyncedOnceRef = useRef(false);

  // useLayoutEffect (não useEffect) — corre antes do browser pintar, senão
  // a correção só acontecia DEPOIS da 1ª pintura, dando um frame visível
  // errado. Os fades (Sidebar.tsx) vêm todos do mesmo `state`, por isso
  // corrigem-se sozinhos também.
  useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    function sync(isMobile: boolean) {
      isMobileRef.current = isMobile;
      if (!hasSyncedOnceRef.current) {
        // 1ª correção depois de montar: desktop começa minimizada (não
        // cheia), mobile fica escondida.
        hasSyncedOnceRef.current = true;
        setState(isMobile ? "closed" : "mini");
        return;
      }
      // Mudanças de viewport depois disso (resize a atravessar o breakpoint)
      // — no mobile a barra nunca pode ficar minimizada, só expandida ou
      // invisível; não mexe em nada ao voltar pra desktop (não força por
      // cima duma escolha manual da pessoa).
      if (isMobile) setState((prev) => (prev === "mini" ? "closed" : prev));
    }
    sync(mql.matches);
    const onChange = (e: MediaQueryListEvent) => sync(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (isMobileRef.current) {
      setState((prev) => (prev === "closed" ? "full" : "closed"));
    } else {
      setState((prev) => (prev === "closed" ? "full" : prev === "full" ? "mini" : "full"));
    }
  }, []);

  const close = useCallback(() => setState("closed"), []);

  return <SidebarContext.Provider value={{ state, toggle, close }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
