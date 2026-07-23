"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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
  const [state, setState] = useState<SidebarState>("mini");
  const isMobileRef = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    function sync(isMobile: boolean) {
      isMobileRef.current = isMobile;
      // No mobile a barra nunca pode ficar minimizada — só expandida ou invisível.
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
