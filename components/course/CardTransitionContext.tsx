"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface TransitionBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TransitionTextBox extends TransitionBox {
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
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
  // "hero" voa o texto até à posição real na página de curso (CourseHero
  // chama arrive() com os targets). "lesson-video"/"lesson-text" não têm
  // onde o texto aterrar — mantém-se durante o zoom e esmorece (fade) assim
  // que o vídeo começa a voar, em vez de tentar voar para lado nenhum.
  destinationKind: TransitionKind;
  // Tamanho normal (1x), antes do zoom-hover da row (CourseRow.tsx) — o clone
  // nasce aqui e cresce até videoBox (já escalado 1.15x) de forma gradual,
  // em vez de nascer logo no tamanho final. Sem zoom (fora de uma row), são
  // a mesma caixa — o "crescimento" é um no-op.
  videoRawBox: TransitionBox;
  titleRawBox: TransitionTextBox | null;
  categoryRawBox: TransitionTextBox | null;
  instructorRawBox: TransitionTextBox | null;
  ratingRawBox: TransitionBox | null;
  videoBox: TransitionBox;
  titleBox: TransitionTextBox | null;
  categoryBox: TransitionTextBox | null;
  instructorBox: TransitionTextBox | null;
  ratingBox: TransitionBox | null;
  title: string;
  category: string;
  instructorName: string;
  lessonCount: number;
  rating: number;
  ratingCount: number;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  youtubeId: string | null;
  videoTime: number;
  capturedAt: number;
  // Ancestral scrollável do card (ex.: a row horizontal em CourseRow.tsx) —
  // o clone vive fora dela (overlay fixed no layout raiz), por isso o scroll
  // interno desta row (scrollLeft) não a acompanha sozinho. Guarda-se a
  // referência + a posição de scroll no instante do clique, pra o overlay
  // poder seguir o delta ao vivo (ver CardTransitionOverlay.tsx).
  scrollOriginEl: HTMLElement | null;
  scrollOriginLeft: number;
  scrollOriginTop: number;
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

// Página inteira (CourseHero, player de aula) que quer poder ser ORIGEM de
// uma transição — ao contrário de um card (CourseTile), não tem título/
// categoria/instrutor/rating ao lado do vídeo para clonar, só o vídeo.
export interface TransitionVideoSource {
  getBox: () => TransitionBox;
  getVideoTime: () => number;
  videoUrl: string | null;
  youtubeId: string | null;
  thumbnailUrl: string | null;
}

interface StartFromSourceOptions {
  cardId: string;
  slug: string;
  destinationKind: TransitionKind;
}

interface CardTransitionContextValue {
  state: TransitionState | null;
  start: (payload: StartPayload) => void;
  arrive: (slug: string, targets: ArriveTargets) => void;
  reveal: () => void;
  finish: () => void;
  registerSource: (slug: string, source: TransitionVideoSource) => () => void;
  // Usado por links que navegam a partir de uma página-fonte registada
  // (ex.: botão "Continuar curso", item da lista de aulas) — mede a caixa do
  // vídeo dessa página na hora e arranca a transição. Retorna false se não
  // houver fonte registada para este slug (ex.: JS ainda a montar).
  startFromSource: (opts: StartFromSourceOptions) => boolean;
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

  // Mapa de fontes registadas não precisa de re-render ao mudar — CourseHero
  // e o player de aula registam-se ao montar (useEffect), independente do
  // ciclo de render deste provider.
  const sourcesRef = useRef(new Map<string, TransitionVideoSource>());

  const registerSource = useCallback((slug: string, source: TransitionVideoSource) => {
    sourcesRef.current.set(slug, source);
    return () => {
      if (sourcesRef.current.get(slug) === source) sourcesRef.current.delete(slug);
    };
  }, []);

  const startFromSource = useCallback(
    ({ cardId, slug, destinationKind }: StartFromSourceOptions) => {
      const source = sourcesRef.current.get(slug);
      if (!source) return false;
      const videoBox = source.getBox();
      start({
        cardId,
        slug,
        destinationKind,
        videoRawBox: videoBox,
        titleRawBox: null,
        categoryRawBox: null,
        instructorRawBox: null,
        ratingRawBox: null,
        videoBox,
        titleBox: null,
        categoryBox: null,
        instructorBox: null,
        ratingBox: null,
        title: "",
        category: "",
        instructorName: "",
        lessonCount: 0,
        rating: 0,
        ratingCount: 0,
        thumbnailUrl: source.thumbnailUrl,
        videoUrl: source.videoUrl,
        youtubeId: source.youtubeId,
        videoTime: source.getVideoTime(),
        capturedAt: Date.now(),
        scrollOriginEl: null,
        scrollOriginLeft: 0,
        scrollOriginTop: 0,
      });
      return true;
    },
    [start]
  );

  return (
    <CardTransitionContext.Provider value={{ state, start, arrive, reveal, finish, registerSource, startFromSource }}>
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

// Sobe a árvore a partir do elemento clicado à procura de um ancestral com
// scroll próprio (ex.: a row horizontal de CourseRow.tsx, overflow-x-auto) —
// esse scroll não é acompanhado pelo overlay (position:fixed, fora da row).
// null se não houver nenhum (card fora de qualquer row com scroll).
export function findScrollAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// Vídeo não pode reaparecer do zero em cada elemento novo (clone, depois hero) —
// soma o tempo já decorrido desde a captura ao ponto onde o vídeo ia.
export function elapsedVideoTime(videoTime: number, capturedAt: number): number {
  return videoTime + (Date.now() - capturedAt) / 1000;
}

export function textBoxFromElement(el: HTMLElement): TransitionTextBox {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  // line-height real (não uma classe leading-* adivinhada) — o clone é um
  // <div> à parte, com o seu próprio line-height por omissão; se não bater
  // certo com o elemento original, o texto nasce deslocado dentro da caixa
  // (a "half-leading" extra por cima empurra o texto pra baixo). computed
  // pode vir "normal" (sem valor numérico na cascata) — aproxima como o
  // browser faz.
  const parsedLineHeight = parseFloat(style.lineHeight);
  const lineHeight = Number.isNaN(parsedLineHeight) ? fontSize * 1.2 : parsedLineHeight;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    fontSize,
    lineHeight,
    // Peso real (não uma classe font-bold adivinhada) — negrito é mais largo
    // que normal no mesmo tamanho; um clone bold medido a partir de um
    // elemento normal não cabe na largura capturada e corta a última letra.
    fontWeight: style.fontWeight,
    color: style.color,
  };
}

// Zoom-hover das rows (CourseRow.tsx) tem de bater exatamente com este valor
// (classe Tailwind "scale-[1.15]" é literal, não pode vir desta constante).
// CourseTile.tsx usa este número para forçar o mesmo scale (sem transição)
// só para medir a posição final antes de clonar — o browser calcula a
// posição, não há matemática de transform-origin para replicar aqui.
export const ROW_ZOOM_SCALE = 1.15;
