"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { TransitionTextBox } from "@/components/course/CardTransitionContext";

// Voo só do título da aula (currículo -> página da aula) — ao contrário do
// CardTransitionContext (vídeo do hero), aqui não há vídeo nem cortina, só o
// texto do título a esticar da linha do currículo até ao <h1> real na página
// de destino, chave por lessonId (não courseSlug, é uma aula específica).
interface TextFlyState {
  id: string;
  text: string;
  sourceBox: TransitionTextBox;
  targetBox: TransitionTextBox;
  arrived: boolean;
  revealed: boolean;
}

interface TextFlyContextValue {
  state: TextFlyState | null;
  start: (id: string, text: string, box: TransitionTextBox) => void;
  arrive: (id: string, box: TransitionTextBox) => void;
  reveal: () => void;
  finish: () => void;
}

const TextFlyContext = createContext<TextFlyContextValue | null>(null);

export function TextFlyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TextFlyState | null>(null);

  const start = useCallback((id: string, text: string, box: TransitionTextBox) => {
    setState({ id, text, sourceBox: box, targetBox: box, arrived: false, revealed: false });
  }, []);

  const arrive = useCallback((id: string, box: TransitionTextBox) => {
    setState((s) => (s && s.id === id && !s.arrived ? { ...s, targetBox: box, arrived: true } : s));
  }, []);

  const reveal = useCallback(() => {
    setState((s) => (s ? { ...s, revealed: true } : s));
  }, []);

  const finish = useCallback(() => setState(null), []);

  return (
    <TextFlyContext.Provider value={{ state, start, arrive, reveal, finish }}>{children}</TextFlyContext.Provider>
  );
}

export function useTextFly() {
  const ctx = useContext(TextFlyContext);
  if (!ctx) throw new Error("useTextFly must be used within TextFlyProvider");
  return ctx;
}
