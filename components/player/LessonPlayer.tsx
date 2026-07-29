"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import {
  Captions,
  CaptionsOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Link2,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Settings,
  Sparkles,
  ThumbsUp,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getYouTubeId } from "@/lib/youtube";
import { useAmbientColor } from "@/lib/useAmbientColor";
import {
  getStoredSpeed,
  setStoredSpeed,
  getStoredQuality,
  setStoredQuality,
  getStoredCaptionsOn,
  setStoredCaptionsOn,
  getStoredAutoplayOn,
  setStoredAutoplayOn,
} from "@/lib/playerPreferences";

export interface VideoRendition {
  quality: string;
  url: string;
  width: number;
  height: number;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HEATMAP_BUCKETS = 40;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Curva suave (mountain-range) tipo "most replayed" do YouTube: viewBox 1000x100,
// pontos ligados por curvas quadráticas passando pelos pontos médios entre eles.
function heatmapPoints(counts: number[]) {
  const n = counts.length;
  // log1p em vez de linear: cada play adicional aumenta a altura cada vez menos
  // (10º play sobe pouco face ao 1º), evitando que um trecho revisitado disparado dispute
  // toda a escala.
  const max = Math.max(1, ...counts.map((c) => Math.log1p(c)));
  return counts.map((c, i) => {
    const x = (i / (n - 1)) * 1000;
    const y = 100 - Math.max(0.08, Math.log1p(c) / max) * 85;
    return [x, y] as const;
  });
}

function smoothCurve(points: readonly (readonly [number, number])[]) {
  let d = `${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    d += ` Q${x0},${y0} ${mx},${my}`;
  }
  const last = points[points.length - 1];
  d += ` L${last[0]},${last[1]}`;
  return d;
}

function buildHeatmapAreaPath(counts: number[]) {
  const points = heatmapPoints(counts);
  return `M0,100 L${smoothCurve(points)} L1000,100 Z`;
}

function buildHeatmapLinePath(counts: number[]) {
  const points = heatmapPoints(counts);
  return `M${smoothCurve(points)}`;
}

// Gera uma linha de base com altos e baixos simulando histórico de visualizações
// anteriores. Determinístico por lessonId (mesma aula = mesma forma sempre).
function seededHeatmapBaseline(lessonId: string): number[] {
  let seed = 0;
  for (let i = 0; i < lessonId.length; i++) seed = (seed * 31 + lessonId.charCodeAt(i)) >>> 0;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  }
  const raw = Array.from({ length: HEATMAP_BUCKETS }, () => 4 + rand() * 16);
  // suaviza com média móvel para parecer uma curva natural, não ruído
  return raw.map((_, i) => {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    return (prev + raw[i] + next) / 3;
  });
}

export function LessonPlayer({
  lessonId,
  type,
  contentUrl,
  hlsMasterUrl,
  captionsUrl,
  videoRenditions,
  textContent,
  initialWatchedSeconds,
  onComplete,
  cinemaMode,
  onToggleCinemaMode,
  onDoubleTapLike,
  fluidWidth,
  hasPrevious,
  hasNext,
  onGoPrevious,
  onGoNext,
  autoplayNext,
}: {
  lessonId: string;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  hlsMasterUrl?: string | null;
  // Legendas WebVTT geradas no worker a seguir à compressão do vídeo (ver
  // worker/index.js:transcribeToVtt) — ficheiro pequeno, servido
  // diretamente do Storage.
  captionsUrl?: string | null;
  videoRenditions?: VideoRendition[];
  textContent?: string | null;
  initialWatchedSeconds: number;
  onComplete: () => void;
  cinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
  onDoubleTapLike?: () => void;
  // Ecrã de fim de vídeo (replay + setas de navegação) — só mostra as
  // setas se houver mesmo aula anterior/seguinte.
  hasPrevious?: boolean;
  hasNext?: boolean;
  onGoPrevious?: () => void;
  onGoNext?: () => void;
  // Definições > Cursos ("Reproduzir próxima aula automaticamente") — só
  // liga o contador quando true e há mesmo aula seguinte.
  autoplayNext?: boolean;
  // Página da aula usa larguras fixas em lg (alinhadas ao resto do layout,
  // sidebar/chat incluídos) — em qualquer sítio mais estreito (ex.: preview
  // no editor, dentro de uma card a meio de um grid) isso transbordava.
  // fluidWidth mantém sempre w-full, sem overrides fixos em lg.
  fluidWidth?: boolean;
}) {
  const lastSentRef = useRef(0);
  const hasAppliedInitialSeekRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const thumbVideoRef = useRef<HTMLVideoElement>(null);
  const thumbHlsRef = useRef<Hls | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const mobileMenuBtnRef = useRef<HTMLDivElement>(null);
  const youtubeId = contentUrl ? getYouTubeId(contentUrl) : null;
  const ambientColor = useAmbientColor(videoRef, Boolean(cinemaMode) && !youtubeId && type === "VIDEO");

  // HLS (master.m3u8 gerado pelo worker, ver worker/index.js) é o caminho
  // normal a partir de agora — o vídeo fica reproduzível assim que a 1ª
  // variante existe, o browser troca de qualidade sozinho. contentUrl/
  // videoRenditions (mp4 plano) ficam só de recurso: aulas antigas de antes
  // desta mudança, ou uma aula nova enquanto o worker ainda nem começou.
  const usingHls = Boolean(hlsMasterUrl) && !youtubeId;

  // Só oferece o seletor quando há mais que uma rendition (senão não há
  // escolha nenhuma a fazer) — ordenadas da maior pra menor resolução.
  const sortedRenditions = [...(videoRenditions ?? [])].sort((a, b) => b.height - a.height);
  const hasLegacyQualityOptions = !usingHls && sortedRenditions.length > 1;
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const activeSrc = selectedQuality
    ? sortedRenditions.find((r) => r.quality === selectedQuality)?.url ?? contentUrl
    : contentUrl;

  useEffect(() => {
    if (usingHls || sortedRenditions.length === 0) return;
    const stored = getStoredQuality();
    const match = stored && sortedRenditions.some((r) => r.quality === stored) ? stored : sortedRenditions[0].quality;
    setSelectedQuality(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, usingHls]);

  // Níveis HLS (uma "rung" da escada = um <video>-friendly bitrate/resolução)
  // — populados quando o hls.js lê o master.m3u8. currentLevel -1 = Auto
  // (hls.js escolhe sozinho consoante a largura de banda).
  const [hlsLevels, setHlsLevels] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [hlsCurrentLevel, setHlsCurrentLevel] = useState(-1);

  // Mostra um indicador de carregamento em vez de deixar o vídeo parecer
  // parado/preso enquanto a 1ª frame ainda não chegou (troca de fonte —
  // upload novo, mudança de qualidade, etc.). Falso assim que o browser tem
  // dados suficientes pra desenhar algo (onLoadedData), nunca num
  // temporizador fixo — reflete o tempo real de carregamento.
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => {
    setVideoReady(false);
  }, [hlsMasterUrl, activeSrc, usingHls]);

  useEffect(() => {
    if (!usingHls || !hlsMasterUrl) return;
    const video = videoRef.current;
    if (!video) return;

    setHlsLevels([]);
    setHlsCurrentLevel(-1);

    // Sempre hls.js, mesmo em browsers com suporte nativo a HLS (Safari, e
    // aparentemente Chrome mais recente também) — HLS nativo não expõe API
    // nenhuma pra ler/escolher níveis de qualidade em JS, o seletor deste
    // menu ficava sempre vazio nesses browsers mesmo com a master playlist
    // certa (3 variantes, confirmado). hls.js dá controlo consistente em
    // qualquer browser que suporte MediaSource Extensions.
    if (!Hls.isSupported()) {
      // Só chega aqui em browsers sem MSE nem HLS nativo — não deve
      // acontecer em prática, mas sem isto o vídeo nem tentava tocar.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsMasterUrl;
      }
      return;
    }

    // capLevelToPlayerSize: no modo automático (sem escolha manual no menu
    // de qualidade), nunca descodifica mais resolução do que o próprio
    // elemento <video> está a mostrar em ecrã — decodificar 1080p num
    // player mostrado a 400px de largura só gasta CPU à toa, e é
    // exatamente esse excesso que causava pausas a meio da reprodução em
    // aparelhos mais fracos. Escolha manual de qualidade continua a
    // funcionar na mesma (isto só limita o automático).
    // startLevel: 0 — força o 1º carregamento a começar pela rendition mais
    // pequena (mais rápida a chegar), em vez do hls.js adivinhar às cegas
    // sem nenhuma amostra de largura de banda ainda. Só afeta a escolha
    // inicial; o automático (ABR) continua livre depois disso.
    const hls = new Hls({ capLevelToPlayerSize: true, startLevel: 0 });
    hlsRef.current = hls;
    hls.loadSource(hlsMasterUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setHlsLevels(hls.levels.map((l, index) => ({ index, height: l.height, bitrate: l.bitrate })));
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
      setHlsCurrentLevel(data.level);
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [usingHls, hlsMasterUrl]);

  function setHlsQuality(levelIndex: number) {
    // hls.currentLevel = X reencaminha pra outra rendition (fetch novo,
    // buffer diferente) — mostra o loading já aqui, não só quando o
    // "waiting" nativo disparar (pode demorar um instante a chegar).
    setVideoReady(false);
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
    setHlsCurrentLevel(levelIndex);
    setQualityOpen(false);
  }

  const [playing, setPlaying] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  // Contagem decrescente do "a avançar em Xs" no ecrã de fim — cada tick
  // reagenda-se a si próprio via setTimeout; ao chegar a 0 dispara onGoNext
  // fora do setState (nunca dentro do updater, que corre durante o commit).
  const [autoAdvanceIn, setAutoAdvanceIn] = useState<number | null>(null);
  function cancelAutoAdvance() {
    setAutoAdvanceIn(null);
  }
  useEffect(() => {
    if (autoAdvanceIn === null) return;
    if (autoAdvanceIn <= 0) {
      setAutoAdvanceIn(null);
      onGoNext?.();
      return;
    }
    const t = setTimeout(() => setAutoAdvanceIn((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceIn]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(getStoredSpeed);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [loop, setLoop] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(getStoredCaptionsOn);
  const [autoplayOn, setAutoplayOn] = useState(getStoredAutoplayOn);
  function toggleAutoplay() {
    setAutoplayOn((v) => {
      const next = !v;
      setStoredAutoplayOn(next);
      return next;
    });
  }
  const trackRef = useRef<HTMLTrackElement>(null);
  // <track default={...}> só decide o estado INICIAL de quando a track é
  // adicionada — não é reativo depois disso. Controla-se o modo (showing/
  // hidden) diretamente no TextTrack, não no atributo.
  useEffect(() => {
    const track = trackRef.current?.track;
    if (track) track.mode = captionsOn ? "showing" : "hidden";
  }, [captionsOn, captionsUrl]);
  function toggleCaptions() {
    setCaptionsOn((v) => {
      const next = !v;
      setStoredCaptionsOn(next);
      return next;
    });
  }
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<number[]>(seededHeatmapBaseline(lessonId));
  const lastHeatmapRenderRef = useRef(0);
  const [, setHeatmapVersion] = useState(0);
  // Preview de scrub (mobile): filmstrip horizontal, gerado num <video>/
  // <canvas> escondidos dedicados só a isto — nunca mexe no <video>
  // principal (evita interromper a reprodução em curso pra "roubar" frames).
  const scrubDraggingRef = useRef(false);
  const progressDragRef = useRef<{ startY: number; revealed: boolean; alreadyExpanded: boolean } | null>(null);
  const barExpandedRef = useRef(false);
  const [barExpanded, setBarExpandedState] = useState(false);
  // A linha visível do slider fica ~8px acima do fundo da própria row (a
  // row é h-10/40px pra dar área de toque maior, mas o <input> encosta em
  // bottom-0 dela com só h-4/16px, e a track fica centrada nesse h-4 — daí
  // o -8 extra, senão a caixa invisível encostava mas a linha visível não).
  const PROGRESS_LIFT_MAX = 76; // bottom-2(8) + 76 = 84px = topo da filmstrip(92) - 8 (offset da linha dentro da row).
  const PROGRESS_REVEAL_DY = 60;
  const FILMSTRIP_COUNT = 20;
  const THUMB_W = 64;
  const FILMSTRIP_HEIGHT = 88;
  const FILMSTRIP_BOTTOM = 4;
  const filmstripScrollRef = useRef<HTMLDivElement>(null);
  const filmstripCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  // Preview on hover (desktop): 1 frame só, segue o rato, aparece por cima
  // da barra — reaproveita o mesmo <video> escondido e a mesma seekAndDraw
  // da filmstrip mobile, só que num único canvas.
  const hoverCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPreview, setHoverPreview] = useState<{ time: number; x: number } | null>(null);
  const lastHoverUpdateRef = useRef(0);
  const [filmstripTimes, setFilmstripTimes] = useState<number[] | null>(null);
  const [scrubTime, setScrubTime] = useState(0);
  // Quanto o play central sobe quando a barra expande — limitado à altura do
  // vídeo (containerRef), senão em vídeos baixos (ecrã em paisagem, etc.) o
  // botão passava do próprio iframe.
  const [playButtonLift, setPlayButtonLift] = useState(0);
  const lastScrubLabelRef = useRef(0);
  const filmstripSeekTimerRef = useRef<number | null>(null);

  function setBarExpanded(v: boolean) {
    barExpandedRef.current = v;
    setBarExpandedState(v);
  }

  // Duplo-clique/duplo-tap: 1º clique adia o play/pause (setTimeout); se um
  // 2º chegar a tempo, cancela-se o adiado e interpreta-se como gesto duplo
  // (seek ou like, consoante a zona do vídeo onde caiu). 220ms em vez de
  // 300ms — cliques normais (play/pause) ficavam com atraso perceptível;
  // duplo-tap intencional continua bem dentro disto na prática.
  const DOUBLE_CLICK_MS = 220;
  const lastClickRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  // O clique que fecha o menu de definições (fora dele) cai em cima do
  // próprio vídeo — sem isto, o mesmo toque que só devia dispensar o menu
  // também dava play/pause ou escondia/mostrava os controlos.
  const suppressNextVideoClickRef = useRef(false);
  const gestureIdRef = useRef(0);
  const [likeBurst, setLikeBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ dir: "back" | "fwd"; id: number } | null>(null);
  const [centerIcon, setCenterIcon] = useState<{ type: "play" | "pause"; id: number } | null>(null);
  // Um só estado para mobile (toque) e desktop (rato) — nenhum dos dois usa
  // :hover CSS puro, que ficava visível para sempre enquanto o rato
  // simplesmente descansasse parado em cima do vídeo. Clique/toque mostra na
  // hora; mexer o rato também (ver handleControlsActivity); ambos agendam o
  // mesmo temporizador de esconder ao fim de um tempo parado.
  const [controlsShown, setControlsShown] = useState(false);
  const controlsHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      // O menu em si vive num portal (fora do vídeo, ver render mais
      // abaixo) — clicar lá dentro não conta como "fora", precisa de
      // verificar os dois sítios (botão + conteúdo portalado).
      const insideDesktopBtn = menuRef.current?.contains(target) ?? false;
      const insideMobileBtn = mobileMenuBtnRef.current?.contains(target) ?? false;
      const insidePortal = menuPortalRef.current?.contains(target) ?? false;
      if (!insideDesktopBtn && !insideMobileBtn && !insidePortal) {
        setMenuOpen(false);
        setSpeedOpen(false);
        setQualityOpen(false);
        suppressNextVideoClickRef.current = true;
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Botão está dentro do vídeo (overflow-hidden, e agora também pode ter um
  // transform ativo durante o gesto de arrastar) — o menu, se ficasse lá
  // dentro, era cortado sempre que não coubesse no espaço visível. Calcula
  // a posição a partir do botão e o conteúdo do menu é portalado pra
  // document.body (ver render), fora de qualquer limitação do vídeo.
  // Recebe o evento (não usa mais o menuRef fixo) porque agora há dois
  // botões possíveis que abrem este menu — o de desktop (na barra de
  // controlos) e o de mobile (canto superior direito) — e a posição tem de
  // ser calculada a partir de QUAL DOS DOIS foi clicado.
  function toggleSettingsMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        // Botão perto do topo do ecrã (caso mobile, canto superior direito) — o menu
        // expande pra BAIXO dele. Botão perto do fundo (caso desktop, barra de
        // controlos) — expande pra CIMA, como antes.
        const opensDown = rect.top < window.innerHeight / 2;
        setMenuPosition(
          opensDown
            ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
            : { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
        );
      }
      return next;
    });
  }

  useEffect(() => {
    if (!contextMenuPos) return;
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenuPos]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Setas esquerda/direita do teclado (desktop) — mesmo efeito do duplo-clique
  // nos lados do vídeo. Ignora quando o foco está num campo de escrita ou
  // noutro input (ex: os sliders de volume/progresso já usam as setas).
  useEffect(() => {
    if (youtubeId) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowLeft") {
        seekBy(-10);
        triggerSeekFlash("back");
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        seekBy(10);
        triggerSeekFlash("fwd");
        e.preventDefault();
      } else if (e.code === "Space") {
        // Sem isto, espaço faz o que faz em qualquer página (scroll pra
        // baixo) em vez de play/pause — o normal em qualquer player de vídeo.
        e.preventDefault();
        togglePlay();
        const isPaused = videoRef.current?.paused ?? true;
        triggerCenterIcon(isPaused ? "pause" : "play", isPaused);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function handleEnter() {
      setIsPiP(true);
    }
    function handleLeave() {
      setIsPiP(false);
    }
    video.addEventListener("enterpictureinpicture", handleEnter);
    video.addEventListener("leavepictureinpicture", handleLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnter);
      video.removeEventListener("leavepictureinpicture", handleLeave);
    };
  }, [youtubeId]);

  // Se os metadados carregarem antes do React anexar o listener onLoadedMetadata
  // (vídeo pequeno/em cache local, muito rápido), o evento nunca chega a ser apanhado
  // e duration fica presa a 0. Este catch-up sincroniza o estado se já estiver disponível.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || youtubeId) return;
    if (video.readyState >= 1) {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
    }
  }, [youtubeId]);

  async function sendProgress(payload: { watchedSeconds?: number; completed?: boolean }) {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, ...payload }),
    });
  }

  function initializeVideo(video: HTMLVideoElement) {
    setDuration(video.duration);
    // playbackRate persistido (lib/playerPreferences) aplica-se aqui — o
    // <video> nasce sempre a 1x, só fica na velocidade guardada depois disto.
    video.playbackRate = playbackRate;
    // Só na 1ª carga real — trocar de qualidade também dispara loadedmetadata
    // (o <video> recarrega do zero com o novo src) e tem o seu próprio
    // resume de posição em setQuality(), não deve saltar de volta para o
    // watchedSeconds antigo guardado no servidor.
    const isFirstLoad = !hasAppliedInitialSeekRef.current;
    // < 95% (não só < duration) — um progresso guardado já perto do fim
    // (aula vista até ao fim antes) fazia reabrir saltar quase pro fim,
    // tocar uma fração de segundo, terminar sozinho e já disparar o avanço
    // automático pra próxima aula/quiz sem o utilizador chegar a ver nada.
    // Reabrir uma aula já dada deve deixar rever desde o início, não
    // empurrar logo pra fora dela.
    if (isFirstLoad && initialWatchedSeconds > 0 && initialWatchedSeconds < video.duration * 0.95) {
      video.currentTime = initialWatchedSeconds;
    }
    if (isFirstLoad) {
      hasAppliedInitialSeekRef.current = true;
      if (!autoplayOn) {
        // Reprodução automática desligada nas definições — nasce em pausa,
        // com os controlos já visíveis (ícone de play central) pra ficar
        // óbvio que é preciso clicar.
        setControlsShown(true);
        return;
      }
      // Autoplay com som só passa nos browsers se já houve engagement
      // prévio no domínio — sem isso o play() rejeita e o vídeo fica
      // parado, sem erro nenhum visível. Truque padrão (Netflix, etc.):
      // arranca mudo (sempre permitido), tira o mute assim que a
      // reprodução pega — desmutar depois de já a tocar não é bloqueado.
      video.muted = true;
      video
        .play()
        .then(() => {
          video.muted = false;
        })
        .catch(() => {
          // Autoplay recusado mesmo mudo (raro) — não deixa o vídeo parado
          // sem indicação nenhuma: mostra os controlos (ícone de play
          // central) já nesta 1ª carga, tal como aconteceria depois de
          // qualquer pausa manual.
          setControlsShown(true);
        });
    }
  }

  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    initializeVideo(e.currentTarget);
  }

  // O <video src> já vem no HTML gerado pelo servidor — o browser pode
  // disparar "loadedmetadata" antes da hidratação chegar a anexar o
  // onLoadedMetadata do React (perde-se o evento, o vídeo fica parado e sem
  // seek/autoplay nenhum aplicado). Num refresh isso é muito mais provável
  // que numa navegação client-side (aí o React já está de pé antes do
  // <video> existir). Se os metadados já estiverem prontos mal montamos,
  // inicializa diretamente em vez de esperar por um evento que já passou.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || youtubeId) return;
    if (video.readyState >= 1) initializeVideo(video);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setQuality(quality: string) {
    const video = videoRef.current;
    const wasPlaying = Boolean(video && !video.paused);
    const resumeAt = video?.currentTime ?? 0;
    setVideoReady(false);
    setSelectedQuality(quality);
    setStoredQuality(quality);
    setQualityOpen(false);

    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      const resume = () => {
        v.currentTime = resumeAt;
        if (wasPlaying) v.play();
        v.removeEventListener("loadedmetadata", resume);
      };
      v.addEventListener("loadedmetadata", resume);
    });
  }

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const video = e.currentTarget;
    setCurrentTime(video.currentTime);

    if (video.duration > 0) {
      const bucket = Math.min(HEATMAP_BUCKETS - 1, Math.floor((video.currentTime / video.duration) * HEATMAP_BUCKETS));
      heatmapRef.current[bucket] += 1;
      const now = video.currentTime;
      if (now - lastHeatmapRenderRef.current > 1) {
        lastHeatmapRenderRef.current = now;
        setHeatmapVersion((v) => v + 1);
      }
    }

    const now = Math.floor(video.currentTime);
    if (now - lastSentRef.current < 5) return;
    lastSentRef.current = now;

    const isNearEnd = video.duration > 0 && now / video.duration >= 0.95;
    sendProgress({ watchedSeconds: now, completed: isNearEnd || undefined });
    if (isNearEnd) onComplete();
  }

  async function handleEnded() {
    setPlaying(false);
    setVideoEnded(true);
    // Ecrã de fim entra visível e conta como "atividade" — sem isto ficava
    // sempre visível (nunca escondia com o resto dos controlos) e, se o
    // rato já estivesse parado há um tempo quando o vídeo terminou, podia
    // nascer já escondido.
    handleControlsActivity();
    // sendProgress do handleTimeUpdate só corre a cada 5s de currentTime —
    // sem gravar aqui o watchedSeconds real do fim, ficava preso nesse
    // último valor (ex.: 30 num vídeo de 32s, 94% < limiar de 95%). Reabrir
    // a aula via initializeVideo só olha para esse número (não para
    // completed), e via essa lacuna concluía "ainda a meio" e saltava de
    // volta quase pro fim — mais visível ainda em vídeos curtos.
    const finalDuration = videoRef.current?.duration;
    await sendProgress({
      watchedSeconds: Number.isFinite(finalDuration) ? Math.floor(finalDuration as number) : undefined,
      completed: true,
    });
    onComplete();

    // O await acima (POST de progresso) pode demorar — se entretanto o
    // utilizador já clicou "Repetir vídeo", o vídeo está de novo a tocar
    // (ended volta a false) e armar aqui o countdown ia disparar o
    // avanço automático a meio do replay, sem ter nada a ver com ele.
    if (!videoRef.current?.ended) return;

    // Reprodução automática desligada nas definições — nem avança sozinho
    // pra próxima aula/quiz, fica só à espera de um clique manual.
    if (autoplayNext && autoplayOn && hasNext && onGoNext) {
      setAutoAdvanceIn(5);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function seekBy(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime + delta);
  }

  function triggerLikeBurst(x: number, y: number) {
    gestureIdRef.current += 1;
    const id = gestureIdRef.current;
    setLikeBurst({ x, y, id });
    onDoubleTapLike?.();
    setTimeout(() => setLikeBurst((b) => (b?.id === id ? null : b)), 700);
  }

  function triggerSeekFlash(dir: "back" | "fwd") {
    gestureIdRef.current += 1;
    const id = gestureIdRef.current;
    setSeekFlash({ dir, id });
    setTimeout(() => setSeekFlash((s) => (s?.id === id ? null : s)), 500);
  }

  // Ícone central de play/pause no clique simples — mostra o ícone do
  // ESTADO NOVO (a pausar mostra o play que vai retomar; a retomar mostra o
  // pause que vai pausar), junto com os controlos do fundo (barra).
  // Pausado: fica tudo visível INDEFINIDAMENTE (persist=true) — só some no
  // próximo clique (dar play) — assim dá sempre pra ver que está pausado e
  // que se deve clicar em play. A dar play: é só uma confirmação breve
  // (persist=false), desaparece sozinho a seguir — o vídeo em reprodução
  // não deve ficar com elementos por cima indefinidamente, nem parado o
  // rato por cima dele (ver handleControlsActivity mais abaixo).
  const CENTER_ICON_MS = 700;
  function triggerCenterIcon(type: "play" | "pause", persist: boolean) {
    gestureIdRef.current += 1;
    const id = gestureIdRef.current;
    setCenterIcon({ type, id });
    setControlsShown(true);
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
    if (persist) return;
    setTimeout(() => setCenterIcon((c) => (c?.id === id ? null : c)), CENTER_ICON_MS);
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsShown(false);
      controlsHideTimerRef.current = null;
    }, CENTER_ICON_MS);
  }

  // Desktop: mexer o rato por cima do vídeo mostra os controlos, mas — ao
  // contrário do :hover CSS de antes — não os mantém visíveis enquanto o
  // rato ficar parado lá em cima. Cada movimento reinicia o temporizador;
  // sem mais movimento nenhum, escondem-se sozinhos ao fim de CONTROLS_IDLE_MS,
  // exatamente como já acontecia ao tocar no mobile.
  const CONTROLS_IDLE_MS = 2500;
  function handleControlsActivity() {
    setControlsShown(true);
    if (controlsHideTimerRef.current) window.clearTimeout(controlsHideTimerRef.current);
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsShown(false);
      controlsHideTimerRef.current = null;
    }, CONTROLS_IDLE_MS);
  }

  function handleControlsMouseLeave() {
    if (controlsHideTimerRef.current) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
    setControlsShown(false);
  }

  // Terços laterais avançam/recuam 10s; o terço central "gosta" (like) com
  // animação no ponto exato do toque — mesmo gesto em mobile (duplo-tap) e
  // desktop (duplo-clique), porque ambos disparam onClick.
  function handleDoubleInteraction(xRatio: number, localX: number, localY: number) {
    if (xRatio < 0.4) {
      seekBy(-10);
      triggerSeekFlash("back");
    } else if (xRatio > 0.6) {
      seekBy(10);
      triggerSeekFlash("fwd");
    } else {
      triggerLikeBurst(localX, localY);
    }
  }

  function handleVideoClick(e: React.MouseEvent<HTMLVideoElement>) {
    if (suppressNextVideoClickRef.current) {
      // Este clique só serviu para dispensar o menu de definições (o
      // listener de clique-fora já tratou disso) — não deve também mexer
      // no vídeo por baixo.
      suppressNextVideoClickRef.current = false;
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (!rect) {
      togglePlay();
      return;
    }
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const now = Date.now();
    const last = lastClickRef.current;
    if (last !== null && now - last < DOUBLE_CLICK_MS) {
      lastClickRef.current = null;
      handleDoubleInteraction(localX / rect.width, localX, localY);
      return;
    }
    lastClickRef.current = now;
    clickTimerRef.current = window.setTimeout(() => {
      // Mobile (sem rato — a mesma zona só tem toque): um toque simples
      // fora de qualquer botão só deve mostrar/esconder os controlos, como
      // no YouTube/qualquer player mobile — dar play/pause sem mostrar nada
      // deixa o utilizador sem forma de saber o que aconteceu nem de
      // reverter. Desktop mantém o clique = play/pause de sempre.
      if (window.innerWidth < 1024) {
        if (controlsShown) {
          handleControlsMouseLeave();
        } else {
          handleControlsActivity();
        }
        lastClickRef.current = null;
        clickTimerRef.current = null;
        return;
      }
      togglePlay();
      // video.paused já reflete o estado NOVO aqui (play()/pause() aplicam-no
      // sincronamente, mesmo antes da reprodução em si começar/parar de
      // verdade) — não é preciso adivinhar antes de chamar togglePlay().
      // Ícone mostra a ação que ACABOU de acontecer (pausou → ícone de
      // pause; deu play → ícone de play), não a próxima ação possível.
      const isPaused = videoRef.current?.paused ?? true;
      triggerCenterIcon(isPaused ? "pause" : "play", isPaused);
      lastClickRef.current = null;
      clickTimerRef.current = null;
    }, DOUBLE_CLICK_MS);
  }

  // O botão de play central (mobile) fica exatamente em cima da zona de
  // "gosto" do duplo-tap (handleDoubleInteraction, terço do meio) — sem
  // isto, o botão intercetava cada toque e dava play/pause duas vezes
  // seguidas em vez do 2º toque completar o duplo-tap de like. Reusa os
  // mesmos timers/lógica do vídeo: toque único (depois do prazo) = play/
  // pause; dois toques a tempo = like, nunca seek (está sempre no centro).
  function handleCenterButtonClick() {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const now = Date.now();
    const last = lastClickRef.current;
    if (last !== null && now - last < DOUBLE_CLICK_MS) {
      lastClickRef.current = null;
      const rect = containerRef.current?.getBoundingClientRect();
      triggerLikeBurst(rect ? rect.width / 2 : 0, rect ? rect.height / 2 : 0);
      return;
    }
    lastClickRef.current = now;
    clickTimerRef.current = window.setTimeout(() => {
      togglePlay();
      const isPaused = videoRef.current?.paused ?? true;
      triggerCenterIcon(isPaused ? "pause" : "play", isPaused);
      lastClickRef.current = null;
      clickTimerRef.current = null;
    }, DOUBLE_CLICK_MS);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(e.target.value);
    video.volume = value;
    video.muted = value === 0;
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
  }

  // Fonte do <video> escondido usado só pra desenhar thumbnails de scrub —
  // criada só na 1ª vez que se arrasta a barra (não no mount), pra não gastar
  // banda/CPU em aulas onde ninguém chega a arrastar. Espelha a mesma lógica
  // de HLS do player principal, mas em instância própria (não pode partilhar
  // o <video> a tocar, senão interrompia a reprodução real).
  function ensureThumbSource() {
    const thumbVideo = thumbVideoRef.current;
    if (!thumbVideo || thumbVideo.dataset.ready) return;
    thumbVideo.dataset.ready = "1";
    if (usingHls && hlsMasterUrl) {
      if (Hls.isSupported()) {
        // startLevel 0 + prende sempre na rendition mais pequena — um
        // thumbnail de 64x88 não precisa de 1080p, e sem isto o hls.js
        // escolhia por estimativa de largura de banda (podia ir alto),
        // carregando segmentos maiores que só atrasavam o preview.
        const hls = new Hls({ startLevel: 0 });
        thumbHlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          hls.currentLevel = 0;
        });
        hls.loadSource(hlsMasterUrl);
        hls.attachMedia(thumbVideo);
      } else if (thumbVideo.canPlayType("application/vnd.apple.mpegurl")) {
        thumbVideo.src = hlsMasterUrl;
      }
    } else {
      // Mesma lógica pro caminho legacy (mp4 plano): a rendition mais
      // pequena disponível, não a que o utilizador escolheu pra ver o vídeo.
      const smallest = sortedRenditions.length > 0 ? sortedRenditions[sortedRenditions.length - 1].url : activeSrc;
      if (smallest) thumbVideo.src = smallest;
    }
  }

  // Escolhe o momento "mais importante" (pico do heatmap) dentro de cada
  // fatia igual da timeline — dá FILMSTRIP_COUNT frames espalhados por todo
  // o vídeo, cada um destacando o instante mais visto/repetido da sua fatia.
  function pickImportantMoments(count: number, totalDuration: number): number[] {
    const buckets = heatmapRef.current;
    const segmentSize = buckets.length / count;
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
      const start = Math.floor(i * segmentSize);
      const end = Math.max(start + 1, Math.floor((i + 1) * segmentSize));
      let bestIdx = start;
      let bestVal = -Infinity;
      for (let b = start; b < end && b < buckets.length; b++) {
        if (buckets[b] > bestVal) {
          bestVal = buckets[b];
          bestIdx = b;
        }
      }
      times.push(((bestIdx + 0.5) / buckets.length) * totalDuration);
    }
    return times;
  }

  // Timeout de segurança em ambos: se o seek/metadata nunca disparar o
  // evento (rede lenta, HLS ainda a iniciar), resolve na mesma — nunca
  // trava o resto da filmstrip por causa de UM frame.
  function seekAndDraw(video: HTMLVideoElement, canvas: HTMLCanvasElement, time: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        video.removeEventListener("seeked", onSeeked);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch {
            // canvas tainted (CORS) ou frame ainda não disponível — ignora, mantém vazio
          }
        }
        resolve();
      }
      function onSeeked() {
        finish();
      }
      if (Math.abs(video.currentTime - time) <= 0.3 && video.readyState >= 2) {
        finish();
        return;
      }
      video.addEventListener("seeked", onSeeked);
      video.currentTime = time;
      window.setTimeout(finish, 1500);
    });
  }

  function waitForMetadata(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      if (video.readyState >= 1) {
        resolve();
        return;
      }
      function onLoaded() {
        video.removeEventListener("loadedmetadata", onLoaded);
        resolve();
      }
      video.addEventListener("loadedmetadata", onLoaded);
      window.setTimeout(resolve, 3000);
    });
  }

  // Gera a filmstrip inteira uma única vez ao expandir (não em cada scroll)
  // — os frames são fixos, só a posição do scroll/marcador central é que é
  // ao vivo.
  async function buildFilmstrip(totalDuration: number) {
    const thumbVideo = thumbVideoRef.current;
    if (!thumbVideo || totalDuration <= 0) return;
    ensureThumbSource();
    // Sem isto, o loop de seeks a seguir corria com o <video> escondido
    // ainda em readyState 0 (metadados por carregar) — cada seekAndDraw
    // desistia logo e desenhava nada, dava frames em branco em todos.
    await waitForMetadata(thumbVideo);
    const times = pickImportantMoments(FILMSTRIP_COUNT, totalDuration);
    setFilmstripTimes(times);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Desenha primeiro os frames perto do tempo atual (onde o marcador central
    // já abre, ver o useEffect de centrar o scroll) — são os que aparecem
    // logo à vista; os das pontas (fora do ecrã) preenchem a seguir.
    const centerIndex =
      totalDuration > 0 ? Math.round((currentTime / totalDuration) * (times.length - 1)) : 0;
    const order = times.map((_, i) => i).sort((a, b) => Math.abs(a - centerIndex) - Math.abs(b - centerIndex));

    for (const i of order) {
      const canvas = filmstripCanvasRefs.current[i];
      if (canvas) await seekAndDraw(thumbVideo, canvas, times[i]);
    }
  }

  // Preview no hover da barra (desktop): 1 frame a seguir o rato, por cima
  // da barra (ver JSX). Throttle simples (80ms) — mousemove dispara muito
  // mais que o necessário pra um scrub visual.
  function handleProgressMouseEnter() {
    ensureThumbSource();
  }

  function handleProgressMouseMove(e: React.MouseEvent) {
    const bar = progressBarRef.current;
    if (!bar || duration <= 0) return;
    const now = Date.now();
    if (now - lastHoverUpdateRef.current < 80) return;
    lastHoverUpdateRef.current = now;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPreview({ time: ratio * duration, x: ratio * rect.width });
  }

  function handleProgressMouseLeave() {
    setHoverPreview(null);
  }

  useEffect(() => {
    if (!hoverPreview) return;
    const thumbVideo = thumbVideoRef.current;
    const canvas = hoverCanvasRef.current;
    if (!thumbVideo || !canvas) return;
    void seekAndDraw(thumbVideo, canvas, hoverPreview.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverPreview?.time]);

  useEffect(() => {
    if (barExpanded) {
      void buildFilmstrip(duration);
      const h = containerRef.current?.clientHeight ?? 0;
      const maxLift = Math.max(0, h / 2 - 44); // 32 (raio do botão) + 12 (respiro)
      setPlayButtonLift(Math.min(110, maxLift));
    } else {
      setFilmstripTimes(null);
      setPlayButtonLift(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barExpanded]);

  // Ao abrir a filmstrip, centra o scroll no tempo atual do vídeo (não
  // começa sempre do zero). scrollLeft mapeia 1:1 pro tempo porque os
  // espaçadores de "50%" de cada lado (ver JSX) fazem centerX = scrollLeft.
  useEffect(() => {
    if (!filmstripTimes) return;
    const el = filmstripScrollRef.current;
    if (!el || duration <= 0) return;
    const totalWidth = FILMSTRIP_COUNT * THUMB_W;
    el.scrollLeft = (currentTime / duration) * totalWidth;
    setScrubTime(currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmstripTimes]);

  // Scroll horizontal nativo = o gesto de "swipe esquerda/direita" (o browser
  // já trata o touch, não precisa de handler de touch custom). O marcador
  // central fica fixo; o tempo em cima dele reflete o que está por baixo
  // dele (scrollLeft / largura total). Procura o tempo em tempo real
  // (throttled) mas só faz seek de verdade ao vídeo depois do scroll
  // assentar (debounce), pra não bombardear o HLS com seeks a cada frame.
  function handleFilmstripScroll() {
    const el = filmstripScrollRef.current;
    if (!el || duration <= 0) return;
    const totalWidth = FILMSTRIP_COUNT * THUMB_W;
    const time = Math.min(duration, Math.max(0, (el.scrollLeft / totalWidth) * duration));
    const now = Date.now();
    if (now - lastScrubLabelRef.current > 50) {
      lastScrubLabelRef.current = now;
      setScrubTime(time);
    }
    if (filmstripSeekTimerRef.current) window.clearTimeout(filmstripSeekTimerRef.current);
    filmstripSeekTimerRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video) video.currentTime = time;
    }, 120);
  }

  // stopPropagation nos três handlers: a barra vive dentro do container que
  // também escuta touchstart/touchend pro gesto de arrastar pra
  // maximizar/minimizar o vídeo (ver handleFullscreenTouchStart/End) — sem
  // isto, arrastar na barra também dispararia esse gesto ao mesmo tempo.
  //
  // A barra em si sobe ao vivo com o dedo (mutação direta do DOM via
  // progressBarRef, não estado — um re-render React por pixel arrastado
  // engasgava) — só depois de arrastar o suficiente pra cima (
  // PROGRESS_REVEAL_DY) é que o preview aparece, no espaço que a barra foi
  // libertando por baixo dela ao subir.
  // Uma vez expandida (swipe up completo), a barra fica em cima — não volta
  // a descer ao largar o dedo. Só recolhe quando se toca fora dela (ver
  // useEffect de collapse mais abaixo, "clicar noutra coisa").
  function collapseBar() {
    setBarExpanded(false);
    const bar = progressBarRef.current;
    if (bar) {
      bar.style.transition = "transform 150ms ease-out";
      bar.style.transform = "";
      window.setTimeout(() => {
        if (progressBarRef.current === bar) bar.style.transition = "";
      }, 150);
    }
  }

  function handleProgressTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    progressDragRef.current = {
      startY: e.touches[0].clientY,
      revealed: barExpandedRef.current,
      alreadyExpanded: barExpandedRef.current,
    };
    scrubDraggingRef.current = true;
    ensureThumbSource();
  }

  // touchmove tem de ser um listener NATIVO (não onTouchMove do React) com
  // { passive: false } — mesmo motivo do gesto de fullscreen mais abaixo: só
  // assim preventDefault() consegue mesmo travar o scroll vertical da
  // página a meio do gesto (onTouchMove do React é passivo por default, e
  // sem isto o scroll da página "rouba" o arrasto — a barra parecia não
  // subir e o preview nunca chegava a revelar-se, era o scroll a ganhar).
  useEffect(() => {
    const bar = progressBarRef.current;
    if (!bar) return;
    function onTouchMove(e: TouchEvent) {
      const drag = progressDragRef.current;
      if (!drag || !scrubDraggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];

      // Já expandida desde o touchstart — fica sempre no topo, não recalcula
      // o lift a partir de dy (senão "caía" pra baixo no início deste novo
      // gesto antes de voltar a subir).
      if (drag.alreadyExpanded) return;

      const dy = Math.max(0, drag.startY - touch.clientY);
      if (bar) bar.style.transform = dy > 0 ? `translateY(-${Math.min(PROGRESS_LIFT_MAX, dy)}px)` : "";
      drag.revealed = dy > PROGRESS_REVEAL_DY;
    }
    bar.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => bar.removeEventListener("touchmove", onTouchMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProgressTouchEnd(e: React.TouchEvent) {
    const drag = progressDragRef.current;
    if (!drag) return;
    e.stopPropagation();
    scrubDraggingRef.current = false;
    progressDragRef.current = null;

    if (drag.revealed) {
      // Ficou (ou já estava) expandida — trava no topo, não recolhe sozinha.
      setBarExpanded(true);
      const bar = progressBarRef.current;
      if (bar) {
        bar.style.transition = "transform 150ms ease-out";
        bar.style.transform = `translateY(-${PROGRESS_LIFT_MAX}px)`;
        window.setTimeout(() => {
          if (progressBarRef.current === bar) bar.style.transition = "";
        }, 150);
      }
      return;
    }
    collapseBar();
  }

  // "Clicar noutra coisa" recolhe a barra expandida — qualquer toque/clique
  // fora dela conta (vídeo, botões, etc.), tal como os outros menus deste
  // player já fazem (ver useEffect do menuOpen/contextMenuPos).
  useEffect(() => {
    function handleOutside(e: Event) {
      if (!barExpandedRef.current) return;
      const target = e.target as Node;
      if (progressBarRef.current?.contains(target)) return;
      if (filmstripScrollRef.current?.contains(target)) return;
      collapseBar();
    }
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("mousedown", handleOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setRate(rate: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setStoredSpeed(rate);
    setSpeedOpen(false);
  }

  async function togglePiP() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP indisponível neste browser/contexto — ignora
    }
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }

  // Mobile: tocar no vídeo e arrastar segue o dedo AO VIVO (escala visual),
  // como um mini-player a crescer — solta depois de passar o meio do
  // percurso e compromete-se a sério (Fullscreen API nativa); solta antes
  // disso e volta ao tamanho normal. Arrastar pra cima cresce (maximizar);
  // já em fullscreen, arrastar pra baixo encolhe (minimizar). Os listeners
  // ficam sempre ativos (não só quando maximizado), senão nunca havia gesto
  // pra ENTRAR em fullscreen. Só em ecrã pequeno — desktop não maximiza por
  // gesto.
  type DragMode = "maximize" | "minimize" | "rotate";
  const dragStateRef = useRef<{ startX: number; startY: number; dy: number; dragging: boolean; mode: DragMode | null } | null>(
    null
  );
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  const DRAG_ACTIVATE_PX = 12;
  const DRAG_MAX_PX = 200;
  const DRAG_COMMIT_PX = DRAG_MAX_PX * 0.45;

  function handleFullscreenTouchStart(e: React.TouchEvent) {
    if (window.innerWidth >= 1024) return;
    const t = e.touches[0];
    dragStateRef.current = { startX: t.clientX, startY: t.clientY, dy: 0, dragging: false, mode: null };
  }

  // touchmove tem de ser um listener NATIVO (não onTouchMove do React) com
  // { passive: false } — só assim preventDefault() consegue mesmo travar o
  // scroll da página; listeners passivos (o default do browser pra
  // touchmove, por performance) ignoram preventDefault() silenciosamente.
  // A escala em si também é mutação direta do DOM (não estado React) — nada
  // de re-render a cada frame do gesto (o heatmap SVG por baixo recalcula
  // em cada render), só assim fica mesmo 1:1 com o dedo sem engasgar.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onTouchMove(e: TouchEvent) {
      const start = dragStateRef.current;
      if (!start || window.innerWidth >= 1024) return;
      const t = e.touches[0];
      const dx = t.clientX - start.startX;
      const dy = t.clientY - start.startY;

      if (!start.dragging) {
        // só confirma o drag com movimento vertical CLARO — evita competir
        // com um tap simples (toggle play) ou um swipe horizontal (troca
        // de aula) que passem por cima do vídeo. Exige dx ainda pequeno (não
        // só menor que dy) — um swipe horizontal real quase sempre tem uma
        // pequena oscilação vertical no início (arco natural do dedo), e só
        // comparar dx com dy nesse 1º instante bastava pra ela "ganhar" e
        // prender o gesto em modo minimize/maximize (vídeo encolhia/crescia
        // a meio de um swipe de trocar de aula que nunca teve intenção
        // vertical nenhuma).
        if (Math.abs(dy) < DRAG_ACTIVATE_PX || Math.abs(dx) > DRAG_ACTIVATE_PX) return;
        const isFsNow = Boolean(document.fullscreenElement);
        if (!isFsNow && dy < 0) start.mode = "maximize";
        else if (isFsNow && dy > 0) start.mode = "minimize";
        else if (isFsNow && dy < 0) start.mode = "rotate";
        else return; // arrastar pra baixo já no tamanho mínimo — nada a fazer

        start.dragging = true;
        container!.style.transition = "none";
        setIsDraggingVideo(true);

        // Minimizar SAI do Fullscreen API logo aqui, no início do gesto —
        // tal como maximizar só ENTRA no fim (handleFullscreenTouchEnd), o
        // arrasto ao vivo acontece sempre num elemento NORMAL, nunca dentro
        // do "top layer" do browser (onde o transform em tempo real não
        // seguia o dedo tão bem — é a raiz de minimizar parecer menos fluido
        // que maximizar). Se soltar antes do ponto de compromisso, volta a
        // entrar em fullscreen no fim (ver handleFullscreenTouchEnd).
        if (start.mode === "minimize") {
          document.exitFullscreen().catch(() => {});
        }
      }

      if (start.mode === "rotate") return; // sem feedback visual, só o gesto de rodar no fim
      e.preventDefault();
      start.dy = dy;
      let scale = 1;
      let translateY = 0;
      if (start.mode === "maximize") {
        scale = 1 + (Math.min(-dy, DRAG_MAX_PX) / DRAG_MAX_PX) * 0.6;
      } else if (start.mode === "minimize") {
        // encolhe E desloca-se com o dedo (não fica parado a encolher no
        // sítio) — sensação de arrastar o vídeo pra baixo a sério, tipo
        // mini-player.
        scale = 1 - (Math.min(dy, DRAG_MAX_PX) / DRAG_MAX_PX) * 0.4;
        translateY = Math.min(dy, DRAG_MAX_PX);
      }
      container!.style.transform = scale !== 1 || translateY !== 0 ? `translateY(${translateY}px) scale(${scale})` : "";
    }

    container.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => container.removeEventListener("touchmove", onTouchMove);
  }, []);

  function handleFullscreenTouchEnd(e: React.TouchEvent) {
    const start = dragStateRef.current;
    dragStateRef.current = null;
    if (!start || window.innerWidth >= 1024) return;
    if (!start.dragging) return; // só um tap — o click normal (play/pause) trata disso

    e.preventDefault(); // evita que o toque solto dispare um click sintético a seguir
    const container = containerRef.current;
    if (container) {
      container.style.transition = "transform 200ms ease-out";
      container.style.transform = "";
    }
    setIsDraggingVideo(false);

    if (start.mode === "maximize") {
      if (start.dy <= -DRAG_COMMIT_PX) containerRef.current?.requestFullscreen().catch(() => {});
    } else if (start.mode === "minimize") {
      // Já saiu do fullscreen no início do gesto (ver onTouchMove). Se não
      // arrastou o suficiente para confirmar, cancela — volta a entrar.
      if (start.dy < DRAG_COMMIT_PX) containerRef.current?.requestFullscreen().catch(() => {});
    } else if (start.mode === "rotate" && start.dy <= -DRAG_COMMIT_PX && window.innerHeight > window.innerWidth) {
      // já maximizado, continuou a arrastar pra cima com o ecrã em pé — roda pra paisagem.
      const orientation = screen.orientation as unknown as { lock?: (type: string) => Promise<void> } | undefined;
      orientation?.lock?.("landscape").catch(() => {});
    }
  }

  function handleDownload() {
    if (!contentUrl) return;
    const a = document.createElement("a");
    a.href = contentUrl;
    a.download = "";
    a.click();
  }

  function toggleLoop() {
    const video = videoRef.current;
    if (!video) return;
    video.loop = !video.loop;
    setLoop(video.loop);
    setContextMenuPos(null);
  }

  async function copyVideoUrl() {
    if (!contentUrl) return;
    await navigator.clipboard.writeText(new URL(contentUrl, window.location.href).href);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 1500);
    setTimeout(() => setContextMenuPos(null), 600);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuW = 208;
    const menuH = 84;
    const x = Math.min(Math.max(8, e.clientX - rect.left), rect.width - menuW - 8);
    const y = Math.min(Math.max(8, e.clientY - rect.top), rect.height - menuH - 8);
    setContextMenuPos({ x, y });
  }

  // API de mensagens do YouTube (enablejsapi=1): estado 0 = vídeo terminou.
  useEffect(() => {
    if (!youtubeId) return;
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data: unknown;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      const info = (data as { info?: unknown })?.info;
      if ((data as { event?: string })?.event === "onStateChange" && info === 0) {
        handleEnded();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  useEffect(() => {
    const thumbVideo = thumbVideoRef.current;
    if (thumbVideo) delete thumbVideo.dataset.ready;
    return () => {
      thumbHlsRef.current?.destroy();
      thumbHlsRef.current = null;
    };
  }, [usingHls, hlsMasterUrl, activeSrc]);

  const widthClass = fluidWidth ? "" : "";
  const playerClassName = `aspect-video w-full rounded-lg bg-black ${widthClass}`;
  const heatmapPath = buildHeatmapAreaPath(heatmapRef.current);
  const heatmapLinePath = buildHeatmapLinePath(heatmapRef.current);

  return (
    <div className="space-y-4 lg:space-y-4">
      {type === "TEXT" ? (
        <div
          className={`overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-neutral-900 ${widthClass}`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{textContent}</p>
        </div>
      ) : (
        <div className="relative overflow-visible" style={cinemaMode && !youtubeId ? { contain: "layout" } : undefined}>
          {cinemaMode && !youtubeId && (
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 z-[-1] blur-3xl transition-colors duration-500"
              style={{ backgroundColor: ambientColor, opacity: 0.6 }}
            />
          )}
          {youtubeId ? (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&enablejsapi=1&playsinline=1&autoplay=${autoplayOn ? 1 : 0}`}
              title="Vídeo da aula"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: youtubeId, channel: "widget" }),
                  "*"
                );
              }}
              className={`${playerClassName} relative`}
            />
          ) : (
            <div
              ref={containerRef}
              // touch-pan-x (não touch-manipulation) — "manipulation" inclui
              // pan-y, ou seja diz ao browser que pode fazer scroll vertical
              // nativo neste elemento, e ele começa a scrollar ao nível do
              // compositor ANTES do preventDefault() do JS sequer correr
              // (por isso o scroll da página não travava, e o arrasto vinha
              // com jank — os dois a competir pelo mesmo gesto). pan-x só
              // permite gesto horizontal nativo (troca de aula), o vertical
              // fica 100% por conta do JS do drag.
              className={`group relative touch-pan-x overflow-hidden ${isDraggingVideo ? "z-50" : ""} ${playerClassName}`}
              onContextMenu={handleContextMenu}
              onTouchStart={handleFullscreenTouchStart}
              onTouchEnd={handleFullscreenTouchEnd}
              onMouseEnter={handleControlsActivity}
              onMouseMove={handleControlsActivity}
              onMouseLeave={handleControlsMouseLeave}
            >
              <video
                ref={videoRef}
                className={`lesson-video h-full w-full object-contain ${controlsShown ? "captions-lifted" : ""}`}
                src={usingHls ? undefined : activeSrc ?? undefined}
                playsInline
                crossOrigin="anonymous"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => {
                  setPlaying(true);
                  setVideoEnded(false);
                }}
                onPause={() => setPlaying(false)}
                onVolumeChange={(e) => {
                  setMuted(e.currentTarget.muted);
                  setVolume(e.currentTarget.volume);
                }}
                onLoadedData={() => setVideoReady(true)}
                // "waiting" nativo cobre QUALQUER paragem por falta de dados
                // — não só a 1ª carga: rebuffer a meio por rede lenta,
                // mudança de qualidade, etc. "playing"/"canplay" tiram o
                // loading assim que há dados outra vez — "canplay" cobre o
                // caso de estar em pausa (não vai disparar "playing"
                // sozinho), "playing" confirma que voltou mesmo a reproduzir.
                onWaiting={() => setVideoReady(false)}
                onPlaying={() => setVideoReady(true)}
                onCanPlay={() => setVideoReady(true)}
                onClick={handleVideoClick}
              >
                {captionsUrl && (
                  <track
                    ref={trackRef}
                    kind="captions"
                    srcLang="pt"
                    label="Português (automático)"
                    src={captionsUrl}
                    default={captionsOn}
                  />
                )}
              </video>

              <video ref={thumbVideoRef} muted playsInline preload="auto" crossOrigin="anonymous" className="hidden" aria-hidden="true" />

              {!videoReady && (usingHls || activeSrc) && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                  <Loader2 size={112} strokeWidth={0.75} className="animate-spin text-white" />
                </div>
              )}

              {/* Settings: no mobile sobe pro canto superior direito (fora da barra de
                  baixo); no desktop continua na barra de controlos (ver mais abaixo, escondido
                  aqui via lg:hidden). Some com fadeout junto dos outros controlos ao dar play. */}
              <div
                className={`absolute right-2 top-2 z-30 flex items-center gap-2 text-white transition-opacity duration-150 lg:hidden ${
                  controlsShown ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {captionsUrl && (
                  <button type="button"
                    onClick={toggleCaptions}
                    aria-label={captionsOn ? "Desativar legendas" : "Ativar legendas"}
                    aria-pressed={captionsOn}
                    className="flex h-9 w-9 items-center justify-center text-white"
                  >
                    {captionsOn ? <Captions size={23} /> : <CaptionsOff size={23} />}
                  </button>
                )}
                <div ref={mobileMenuBtnRef} className="relative">
                  <button type="button"
                    onClick={toggleSettingsMenu}
                    aria-label="Definições"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                  >
                    <Settings size={21} />
                  </button>
                </div>
              </div>

              {/* Maximizar: no mobile fica no canto inferior direito, mas acima da barra
                  (mesmo nível do tempo do vídeo), não sobre ela. Some quando a barra está
                  expandida (a filmstrip ocupa esse canto). */}
              <div
                className={`absolute bottom-7 right-2 z-30 text-white transition-opacity duration-150 lg:hidden ${
                  controlsShown && !barExpanded ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <button type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Sair de ecrã inteiro" : "Ecrã inteiro"}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                >
                  {isFullscreen ? <Minimize size={21} /> : <Maximize size={21} />}
                </button>
              </div>

              {likeBurst && (
                <div
                  key={likeBurst.id}
                  className="pointer-events-none absolute z-[25] animate-like-pop"
                  style={{ left: likeBurst.x, top: likeBurst.y }}
                >
                  <ThumbsUp size={72} className="fill-blue-400 text-blue-400 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                </div>
              )}

              {seekFlash && (
                <div
                  key={seekFlash.id}
                  className={`pointer-events-none absolute inset-y-0 z-20 flex w-1/3 animate-seek-flash items-center ${
                    seekFlash.dir === "back" ? "left-0 justify-start pl-6" : "right-0 justify-end pr-6"
                  }`}
                >
                  <span className="flex flex-col items-center gap-1 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                    {seekFlash.dir === "back" ? <RotateCcw size={32} /> : <RotateCw size={32} />}
                    <span className="text-xs font-semibold">10s</span>
                  </span>
                </div>
              )}

              {centerIcon && (
                <div key={centerIcon.id} className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden animate-center-pop lg:block">
                  {centerIcon.type === "play" ? (
                    <Play size={64} className="fill-white text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                  ) : (
                    <Pause size={64} className="fill-white text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" />
                  )}
                </div>
              )}

              {/* Botão de play/pause central: no mobile substitui o botão inline da barra
                  de baixo (que fica escondido, ver lg:block mais abaixo) — igual ao YouTube.
                  Some com fadeout junto dos outros controlos ao dar play. */}
              <button
                type="button"
                onClick={handleCenterButtonClick}
                aria-label={playing ? "Pausar" : "Reproduzir"}
                style={{
                  transform: barExpanded ? `translate(-50%, calc(-50% - ${playButtonLift}px))` : "translate(-50%, -50%)",
                  transition: "transform 200ms ease-out, opacity 150ms",
                }}
                className={`absolute left-1/2 top-1/2 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm lg:hidden ${
                  // Pausado: fica sempre visível, nunca esconde com o resto
                  // dos controlos por inatividade — precisa de dar pra ver
                  // (e clicar) mesmo que o vídeo tenha nascido em pausa (ex.:
                  // reprodução automática desligada, autoplay recusado pelo
                  // browser num refresh) sem ninguém ter mexido no ecrã ainda.
                  // videoEnded exclui aqui — senão fica ao lado do botão de
                  // repetir do ecrã de fim (ambos "pausados" ao mesmo tempo).
                  !videoEnded && (controlsShown || !playing) ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {playing ? <Pause size={30} className="fill-white" /> : <Play size={30} className="fill-white" />}
              </button>

              {/* Ecrã de fim: repetir no centro (mesma zona do duplo-tap de like) e
                  setas minimalistas pros lados pra trocar de aula — só aparecem se
                  houver mesmo aula anterior/seguinte. */}
              {videoEnded && (
                <div className="absolute inset-0 z-40 flex items-center justify-between bg-black/60 px-2 sm:px-6">
                  {hasPrevious ? (
                    <button type="button"
                      onClick={() => {
                        cancelAutoAdvance();
                        onGoPrevious?.();
                      }}
                      aria-label="Aula anterior"
                      className="flex h-12 w-12 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white"
                    >
                      <ChevronLeft size={36} strokeWidth={1.25} />
                    </button>
                  ) : (
                    <div className="h-12 w-12 shrink-0" />
                  )}

                  <button type="button"
                    onClick={() => {
                      cancelAutoAdvance();
                      const video = videoRef.current;
                      if (!video) return;
                      video.currentTime = 0;
                      video.play();
                    }}
                    aria-label="Repetir vídeo"
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
                  >
                    <RotateCcw size={30} />
                  </button>

                  {hasNext ? (
                    <div className="flex shrink-0 flex-col items-center gap-1.5">
                      <button type="button"
                        onClick={() => {
                          cancelAutoAdvance();
                          onGoNext?.();
                        }}
                        aria-label="Próxima aula"
                        className="flex h-12 w-12 items-center justify-center text-white/70 transition-colors hover:text-white"
                      >
                        <ChevronRight size={36} strokeWidth={1.25} />
                      </button>
                      {autoAdvanceIn !== null && (
                        <button
                          type="button"
                          onClick={cancelAutoAdvance}
                          className="flex flex-col items-center whitespace-nowrap rounded-full bg-black/50 px-2.5 py-1 text-[11px] leading-tight text-white/80 hover:text-white"
                        >
                          <span>Próxima em {autoAdvanceIn}s</span>
                          <span>cancelar</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="h-12 w-12 shrink-0" />
                  )}
                </div>
              )}

              <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-6 transition-opacity duration-150 ${controlsShown ? "opacity-100" : "opacity-0"}`}>
                <div
                  ref={progressBarRef}
                  onTouchStart={handleProgressTouchStart}
                  onTouchEnd={handleProgressTouchEnd}
                  onMouseEnter={handleProgressMouseEnter}
                  onMouseMove={handleProgressMouseMove}
                  onMouseLeave={handleProgressMouseLeave}
                  className="group/progress absolute inset-x-0 bottom-2 z-40 h-10 px-3 lg:relative lg:inset-auto lg:bottom-auto lg:h-4 lg:px-0"
                >
                  {hoverPreview && (
                    <div
                      className="pointer-events-none absolute bottom-full z-30 mb-2 hidden -translate-x-1/2 flex-col items-center gap-1 lg:flex"
                      style={{
                        left: Math.min(
                          Math.max(hoverPreview.x, 60),
                          (progressBarRef.current?.clientWidth ?? hoverPreview.x + 60) - 60
                        ),
                      }}
                    >
                      <canvas
                        ref={hoverCanvasRef}
                        width={112}
                        height={63}
                        className="rounded border border-white/30 bg-black shadow-lg"
                      />
                      <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        {formatTime(hoverPreview.time)}
                      </span>
                    </div>
                  )}
                  <svg
                    viewBox="0 0 1000 100"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-x-0 bottom-full mb-2 h-12 w-full opacity-0 transition-opacity duration-150 group-hover/progress:opacity-100"
                  >
                    <defs>
                      <linearGradient id={`heatfade-${lessonId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>
                    </defs>
                    <path d={heatmapPath} fill={`url(#heatfade-${lessonId})`} />
                    <path d={heatmapLinePath} fill="none" stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </svg>

                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    style={{ "--progress": `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
                    className="absolute inset-x-0 bottom-0 h-4 w-full touch-pan-x cursor-pointer appearance-none bg-transparent
                      [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#3b82f6_var(--progress),rgba(255,255,255,0.3)_var(--progress))]
                      [&::-webkit-slider-thumb]:mt-[-4.5px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:shadow-black/50
                      [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,#3b82f6_var(--progress),rgba(255,255,255,0.3)_var(--progress))]
                      [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-500"
                    aria-label="Progresso do vídeo"
                  />
                </div>

                {/* Filmstrip de scrub (mobile): só aparece enquanto a barra está expandida
                    (swipe up, ver barExpanded). Ocupa toda a área livre por baixo da barra,
                    com um marcador central fixo — arrastar horizontalmente (scroll nativo,
                    trata do swipe esquerda/direita sozinho) muda qual frame fica por baixo
                    do marcador, e isso é que decide o tempo (ver handleFilmstripScroll). */}
                {barExpanded && filmstripTimes && (
                  <>
                    <div
                      ref={filmstripScrollRef}
                      onScroll={handleFilmstripScroll}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute inset-x-0 z-30 flex overflow-x-auto lg:hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      style={{ bottom: FILMSTRIP_BOTTOM, height: FILMSTRIP_HEIGHT }}
                    >
                      <div className="flex-shrink-0" style={{ width: "50%" }} />
                      {filmstripTimes.map((t, i) => (
                        <div key={i} className="h-full flex-shrink-0" style={{ width: THUMB_W }}>
                          <canvas
                            ref={(el) => {
                              filmstripCanvasRefs.current[i] = el;
                            }}
                            width={THUMB_W}
                            height={FILMSTRIP_HEIGHT}
                            className="h-full w-full bg-black object-cover"
                          />
                        </div>
                      ))}
                      <div className="flex-shrink-0" style={{ width: "50%" }} />
                    </div>

                    {/* Marcador central: fixo, não se move — é a filmstrip que desliza por
                        baixo dele. */}
                    <div
                      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center lg:hidden"
                      style={{ bottom: FILMSTRIP_BOTTOM, height: FILMSTRIP_HEIGHT }}
                    >
                      <div className="h-full w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
                    </div>

                    <div
                      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center lg:hidden"
                      style={{ bottom: FILMSTRIP_BOTTOM + FILMSTRIP_HEIGHT + 6 }}
                    >
                      <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        {formatTime(scrubTime)}
                      </span>
                    </div>
                  </>
                )}

                <div className="absolute inset-x-0 bottom-7 flex items-center gap-3 px-3 text-white lg:static lg:inset-auto lg:bottom-auto lg:mt-2 lg:px-0">
                  <button type="button" onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproduzir"} className="hidden hover:text-blue-400 lg:block">
                    {playing ? <Pause size={22} /> : <Play size={22} />}
                  </button>

                  <div className="group/volume hidden items-center lg:flex">
                    <button type="button" onClick={toggleMute} aria-label={muted ? "Ativar som" : "Silenciar"} className="flex items-center hover:text-blue-400">
                      {muted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      style={{ "--vol": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
                      className="ml-1 h-3 w-0 cursor-pointer appearance-none overflow-hidden bg-transparent opacity-0 transition-all duration-150 group-hover/volume:w-16 group-hover/volume:opacity-100
                        [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#ffffff_var(--vol),rgba(255,255,255,0.3)_var(--vol))]
                        [&::-webkit-slider-thumb]:mt-[-3.5px] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                        [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,#ffffff_var(--vol),rgba(255,255,255,0.3)_var(--vol))]
                        [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
                      aria-label="Volume"
                    />
                  </div>

                  <span className="text-sm tabular-nums text-slate-200">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex-1" />

                  <button type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "Sair de ecrã inteiro" : "Ecrã inteiro"}
                    className="hidden hover:text-blue-400 lg:block"
                  >
                    {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                  </button>

                  <div ref={menuRef} className="relative hidden items-center lg:flex">
                    <button type="button"
                      onClick={toggleSettingsMenu}
                      aria-label="Definições"
                      title="Definições"
                      className="flex items-center hover:text-blue-400"
                    >
                      <Settings size={20} />
                    </button>

                    {menuOpen &&
                      menuPosition &&
                      createPortal(
                        <div
                          ref={menuPortalRef}
                          style={{
                            position: "fixed",
                            top: menuPosition.top,
                            bottom: menuPosition.bottom,
                            right: menuPosition.right,
                          }}
                          className="z-[100] w-52 rounded-lg border border-white/10 bg-neutral-800/70 py-1 text-sm shadow-xl backdrop-blur-md">
                        <button type="button"
                          onClick={handleDownload}
                          className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <Download size={16} />
                          Download
                        </button>

                        <button type="button"
                          onClick={() => setSpeedOpen((v) => !v)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <Gauge size={16} />
                          Velocidade
                          <span className="ml-auto text-slate-400">{playbackRate}x</span>
                        </button>
                        {speedOpen && (
                          <div className="px-3 pb-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              {PLAYBACK_RATES.map((rate) => (
                                <span key={rate} className={rate === playbackRate ? "font-semibold text-white" : ""}>
                                  {rate}x
                                </span>
                              ))}
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={PLAYBACK_RATES.length - 1}
                              step={1}
                              value={Math.max(0, PLAYBACK_RATES.indexOf(playbackRate))}
                              onChange={(e) => setRate(PLAYBACK_RATES[Number(e.target.value)])}
                              className="mt-1 w-full accent-blue-500"
                              aria-label="Velocidade de reprodução"
                            />
                          </div>
                        )}

                        {(usingHls ? hlsLevels.length > 1 : hasLegacyQualityOptions) && (
                          <>
                            <button type="button"
                              onClick={() => setQualityOpen((v) => !v)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                            >
                              <Video size={16} />
                              Qualidade
                              <span className="ml-auto text-slate-400">
                                {usingHls
                                  ? hlsCurrentLevel === -1
                                    ? "Auto"
                                    : `${hlsLevels.find((l) => l.index === hlsCurrentLevel)?.height ?? ""}p`
                                  : selectedQuality}
                              </span>
                            </button>
                            {qualityOpen && (
                              <div className="pb-1">
                                {usingHls ? (
                                  <>
                                    <button type="button"
                                      onClick={() => setHlsQuality(-1)}
                                      className={`flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-xs ${
                                        hlsCurrentLevel === -1 ? "text-blue-400" : "text-slate-300 hover:bg-white/10"
                                      }`}
                                    >
                                      Auto
                                      {hlsCurrentLevel === -1 && <Check size={13} className="ml-auto" />}
                                    </button>
                                    {[...hlsLevels]
                                      .sort((a, b) => b.height - a.height)
                                      .map((l) => (
                                        <button type="button"
                                          key={l.index}
                                          onClick={() => setHlsQuality(l.index)}
                                          className={`flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-xs ${
                                            l.index === hlsCurrentLevel ? "text-blue-400" : "text-slate-300 hover:bg-white/10"
                                          }`}
                                        >
                                          {l.height}p
                                          {l.index === hlsCurrentLevel && <Check size={13} className="ml-auto" />}
                                        </button>
                                      ))}
                                  </>
                                ) : (
                                  sortedRenditions.map((r) => (
                                    <button type="button"
                                      key={r.quality}
                                      onClick={() => setQuality(r.quality)}
                                      className={`flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-xs ${
                                        r.quality === selectedQuality ? "text-blue-400" : "text-slate-300 hover:bg-white/10"
                                      }`}
                                    >
                                      {r.quality}
                                      {r.quality === selectedQuality && <Check size={13} className="ml-auto" />}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        )}

                        <button type="button"
                          onClick={togglePiP}
                          className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <PictureInPicture2 size={16} />
                          Picture-in-picture
                          {isPiP && <span className="ml-auto text-blue-400">✓</span>}
                        </button>

                        {captionsUrl && (
                          <button type="button"
                            onClick={toggleCaptions}
                            className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10"
                          >
                            <Captions size={16} />
                            Legendas
                            <span
                              role="switch"
                              aria-checked={captionsOn}
                              className={`ml-auto flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                                captionsOn ? "bg-blue-500" : "bg-white/20"
                              }`}
                            >
                              <span
                                className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                                  captionsOn ? "translate-x-3.5" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                          </button>
                        )}

                        {onToggleCinemaMode && (
                          <button type="button"
                            onClick={onToggleCinemaMode}
                            className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10"
                          >
                            <Sparkles size={16} />
                            Modo ambiente
                            <span
                              role="switch"
                              aria-checked={cinemaMode}
                              className={`ml-auto flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                                cinemaMode ? "bg-blue-500" : "bg-white/20"
                              }`}
                            >
                              <span
                                className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                                  cinemaMode ? "translate-x-3.5" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                          </button>
                        )}

                        <button type="button"
                          onClick={toggleAutoplay}
                          className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <Play size={16} />
                          Reprodução automática
                          <span
                            role="switch"
                            aria-checked={autoplayOn}
                            className={`ml-auto flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                              autoplayOn ? "bg-blue-500" : "bg-white/20"
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                                autoplayOn ? "translate-x-3.5" : "translate-x-0.5"
                              }`}
                            />
                          </span>
                        </button>
                        </div>,
                        // Em ecrã inteiro de verdade (Fullscreen API), o
                        // browser só desenha o próprio elemento fullscreen —
                        // um portal em document.body (fora dele) fica
                        // invisível, mesmo com z-index altíssimo. Portala
                        // pro container quando maximizado; document.body nos
                        // outros casos (onde escapar do overflow-hidden do
                        // vídeo é que interessava).
                        isFullscreen && containerRef.current ? containerRef.current : document.body
                      )}
                  </div>
                </div>
              </div>

              {contextMenuPos && (
                <div
                  ref={contextMenuRef}
                  style={{ position: "absolute", left: contextMenuPos.x, top: contextMenuPos.y }}
                  className="z-50 w-52 rounded-lg border border-white/10 bg-neutral-800/70 py-1 text-sm shadow-xl backdrop-blur-md"
                >
                  <button type="button"
                    onClick={toggleLoop}
                    className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                  >
                    <Repeat size={16} />
                    Repetir
                    {loop && <Check size={16} className="ml-auto text-blue-400" />}
                  </button>
                  <button type="button"
                    onClick={copyVideoUrl}
                    className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                  >
                    <Link2 size={16} />
                    {urlCopied ? "Copiado!" : "Copiar URL do vídeo"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
