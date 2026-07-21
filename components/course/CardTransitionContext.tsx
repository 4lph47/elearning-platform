"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface TransitionBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TransitionTextBox extends TransitionBox {
  fontSize: number;
  color: string;
}

export type TransitionKind = "hero" | "lesson-video" | "lesson-text";

export interface ArriveTargets {
  video: TransitionBox;
  title: TransitionTextBox | null;
  category: TransitionTextBox | null;
  instructor: TransitionTextBox | null;
  rating: TransitionBox | null;
}

interface StartPayload {
  cardId: string;
  slug: string;
  videoBox: TransitionBox;
  titleBox: TransitionTextBox | null;
  categoryBox: TransitionTextBox | null;
  instructorBox: TransitionTextBox | null;
  ratingBox: TransitionBox | null;
  title: string;
  category: string;
  instructorName: string;
  rating: number;
  ratingCount: number;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  youtubeId: string | null;
}

export interface TransitionState extends StartPayload {
  videoTargetBox: TransitionBox;
  titleTargetBox: TransitionTextBox | null;
  categoryTargetBox: TransitionTextBox | null;
  instructorTargetBox: TransitionTextBox | null;
  ratingTargetBox: TransitionBox | null;
  arrived: boolean;
  hidden: boolean;
  revealed: boolean;
}

interface CardTransitionContextValue {
  state: TransitionState | null;
  start: (payload: StartPayload) => void;
  arrive: (slug: string, targets: ArriveTargets) => void;
  reveal: () => void;
  finish: () => void;
}

const CardTransitionContext = createContext<CardTransitionContextValue | null>(null);

export function CardTransitionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TransitionState | null>(null);

  // hidden:true já aqui, sem delay — se a navegação for rápida (rota já
  // compilada/cache quente), a página seguinte pode montar em bem menos de
  // 250ms; qualquer atraso a ligar o FadeOutScrim deixava uma janela com o
  // scrim a 0 de opacidade onde a página nova pintava sem nada a tapar.
  // O card clicado continua a escapar ao scrim por z-index (CourseTile.tsx).
  const start = useCallback((payload: StartPayload) => {
    setState({
      ...payload,
      videoTargetBox: payload.videoBox,
      titleTargetBox: payload.titleBox,
      categoryTargetBox: payload.categoryBox,
      instructorTargetBox: payload.instructorBox,
      ratingTargetBox: payload.ratingBox,
      arrived: false,
      hidden: true,
      revealed: false,
    });
  }, []);

  const arrive = useCallback((slug: string, targets: ArriveTargets) => {
    setState((s) =>
      s && s.slug === slug && !s.arrived
        ? {
            ...s,
            videoTargetBox: targets.video,
            titleTargetBox: targets.title,
            categoryTargetBox: targets.category,
            instructorTargetBox: targets.instructor,
            ratingTargetBox: targets.rating,
            arrived: true,
          }
        : s
    );
  }, []);

  const reveal = useCallback(() => {
    setState((s) => (s ? { ...s, revealed: true } : s));
  }, []);

  const finish = useCallback(() => setState(null), []);

  return (
    <CardTransitionContext.Provider value={{ state, start, arrive, reveal, finish }}>
      {children}
    </CardTransitionContext.Provider>
  );
}

export function useCardTransition() {
  const ctx = useContext(CardTransitionContext);
  if (!ctx) throw new Error("useCardTransition must be used within CardTransitionProvider");
  return ctx;
}

export function boxFromRect(rect: DOMRect): TransitionBox {
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function textBoxFromElement(el: HTMLElement): TransitionTextBox {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    fontSize: parseFloat(style.fontSize),
    color: style.color,
  };
}
