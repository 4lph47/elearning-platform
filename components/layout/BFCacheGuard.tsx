"use client";

import { useEffect } from "react";

// Sair (signOut) navega para "/" com uma página nova a sério — mas carregar
// para trás no browser depois disso podia servir a página anterior direto
// do bfcache (snapshot congelado do DOM, sem passar pelo servidor/middleware
// outra vez), mostrando a sessão antiga ainda "logada" apesar da cookie já
// ter sido invalidada. "pageshow" com persisted=true é exatamente essa
// restauração do bfcache — força um reload a sério, que volta a passar pelo
// middleware e busca o estado de sessão atual.
export function BFCacheGuard() {
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
