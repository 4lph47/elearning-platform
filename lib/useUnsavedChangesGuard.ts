"use client";

import { useEffect } from "react";
import { useFadeNav } from "@/components/course/FadeNavContext";

// Cobre as duas formas de "sair": navegação dentro da app (fadeNavigate —
// clicar num link/voltar) e navegação do próprio browser (fechar separador,
// refresh, escrever novo URL — beforeunload, texto do popup controlado
// pelo browser, não customizável).
export function useUnsavedChangesGuard(isDirty: boolean) {
  const { setNavigationGuard } = useFadeNav();

  useEffect(() => {
    setNavigationGuard(isDirty ? () => true : null);
    return () => setNavigationGuard(null);
  }, [isDirty, setNavigationGuard]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}
