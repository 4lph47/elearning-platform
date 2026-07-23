"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Check,
  Download,
  Gauge,
  Link2,
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
import { useSidebarCollapsed } from "@/components/course/ChatOpenContext";
import { getYouTubeId } from "@/lib/youtube";
import { useAmbientColor } from "@/lib/useAmbientColor";
import { getStoredSpeed, setStoredSpeed, getStoredQuality, setStoredQuality } from "@/lib/playerPreferences";

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
  videoRenditions,
  textContent,
  initialWatchedSeconds,
  onComplete,
  cinemaMode,
  onToggleCinemaMode,
  onDoubleTapLike,
  fluidWidth,
}: {
  lessonId: string;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  hlsMasterUrl?: string | null;
  videoRenditions?: VideoRendition[];
  textContent?: string | null;
  initialWatchedSeconds: number;
  onComplete: () => void;
  cinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
  onDoubleTapLike?: () => void;
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
  const hlsRef = useRef<Hls | null>(null);
  const collapsed = useSidebarCollapsed();
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

    const hls = new Hls();
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
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
    setHlsCurrentLevel(levelIndex);
    setQualityOpen(false);
    setMenuOpen(false);
  }

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(getStoredSpeed);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [loop, setLoop] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<number[]>(seededHeatmapBaseline(lessonId));
  const lastHeatmapRenderRef = useRef(0);
  const [, setHeatmapVersion] = useState(0);

  // Duplo-clique/duplo-tap: 1º clique adia o play/pause (setTimeout); se um
  // 2º chegar a tempo, cancela-se o adiado e interpreta-se como gesto duplo
  // (seek ou like, consoante a zona do vídeo onde caiu). 220ms em vez de
  // 300ms — cliques normais (play/pause) ficavam com atraso perceptível;
  // duplo-tap intencional continua bem dentro disto na prática.
  const DOUBLE_CLICK_MS = 220;
  const lastClickRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const gestureIdRef = useRef(0);
  const [likeBurst, setLikeBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ dir: "back" | "fwd"; id: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSpeedOpen(false);
        setQualityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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

  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    setDuration(e.currentTarget.duration);
    // playbackRate persistido (lib/playerPreferences) aplica-se aqui — o
    // <video> nasce sempre a 1x, só fica na velocidade guardada depois disto.
    e.currentTarget.playbackRate = playbackRate;
    // Só na 1ª carga real — trocar de qualidade também dispara loadedmetadata
    // (o <video> recarrega do zero com o novo src) e tem o seu próprio
    // resume de posição em setQuality(), não deve saltar de volta para o
    // watchedSeconds antigo guardado no servidor.
    if (!hasAppliedInitialSeekRef.current && initialWatchedSeconds > 0 && initialWatchedSeconds < e.currentTarget.duration) {
      e.currentTarget.currentTime = initialWatchedSeconds;
      hasAppliedInitialSeekRef.current = true;
    }
  }

  function setQuality(quality: string) {
    const video = videoRef.current;
    const wasPlaying = Boolean(video && !video.paused);
    const resumeAt = video?.currentTime ?? 0;
    setSelectedQuality(quality);
    setStoredQuality(quality);
    setQualityOpen(false);
    setMenuOpen(false);

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
    await sendProgress({ completed: true });
    onComplete();
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
    setTimeout(() => setLikeBurst((b) => (b?.id === id ? null : b)), 800);
  }

  function triggerSeekFlash(dir: "back" | "fwd") {
    gestureIdRef.current += 1;
    const id = gestureIdRef.current;
    setSeekFlash({ dir, id });
    setTimeout(() => setSeekFlash((s) => (s?.id === id ? null : s)), 500);
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
      togglePlay();
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

  function setRate(rate: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setStoredSpeed(rate);
    setSpeedOpen(false);
    setMenuOpen(false);
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
    setMenuOpen(false);
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
  const dragStateRef = useRef<{ startX: number; startY: number; dy: number; dragging: boolean } | null>(null);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  const DRAG_ACTIVATE_PX = 12;
  const DRAG_MAX_PX = 200;
  const DRAG_COMMIT_PX = DRAG_MAX_PX * 0.45;

  function handleFullscreenTouchStart(e: React.TouchEvent) {
    if (window.innerWidth >= 1024) return;
    const t = e.touches[0];
    dragStateRef.current = { startX: t.clientX, startY: t.clientY, dy: 0, dragging: false };
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
        // só confirma o drag com movimento vertical claro — evita competir
        // com um tap simples (toggle play) ou um swipe horizontal (troca
        // de aula) que passem por cima do vídeo.
        if (Math.abs(dy) < DRAG_ACTIVATE_PX || Math.abs(dx) > Math.abs(dy)) return;
        start.dragging = true;
        container!.style.transition = "none";
        setIsDraggingVideo(true);
      }

      e.preventDefault();
      start.dy = dy;
      const isFs = Boolean(document.fullscreenElement);
      let scale = 1;
      if (!isFs && dy < 0) {
        scale = 1 + (Math.min(-dy, DRAG_MAX_PX) / DRAG_MAX_PX) * 0.6;
      } else if (isFs && dy > 0) {
        scale = 1 - (Math.min(dy, DRAG_MAX_PX) / DRAG_MAX_PX) * 0.4;
      }
      container!.style.transform = scale !== 1 ? `scale(${scale})` : "";
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

    const isFs = Boolean(document.fullscreenElement);
    if (!isFs && start.dy <= -DRAG_COMMIT_PX) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else if (isFs && start.dy >= DRAG_COMMIT_PX) {
      document.exitFullscreen().catch(() => {});
    } else if (isFs && start.dy <= -DRAG_COMMIT_PX && window.innerHeight > window.innerWidth) {
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
    setMenuOpen(false);
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

  const widthClass = fluidWidth ? "" : `lg:max-w-none ${collapsed ? "lg:w-[1350px]" : "lg:w-[1020px]"}`;
  const playerClassName = `aspect-video w-full rounded-lg bg-black ${widthClass}`;
  const heatmapPath = buildHeatmapAreaPath(heatmapRef.current);
  const heatmapLinePath = buildHeatmapLinePath(heatmapRef.current);

  return (
    <div className="space-y-4">
      {type === "TEXT" ? (
        <div
          className={`overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-neutral-900 ${widthClass}`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{textContent}</p>
        </div>
      ) : (
        <div className="relative" style={cinemaMode && !youtubeId ? { contain: "layout" } : undefined}>
          {cinemaMode && !youtubeId && (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 -bottom-6 -top-12 -z-10 rounded-[40px] blur-3xl transition-colors duration-500 lg:-inset-x-16 lg:-bottom-16 lg:-top-28"
              style={{ backgroundColor: ambientColor, opacity: 0.6 }}
            />
          )}
          {youtubeId ? (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&enablejsapi=1&playsinline=1`}
              title="Vídeo da aula"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: "listening", id: youtubeId, channel: "widget" }),
                  "*"
                );
              }}
              className={playerClassName}
            />
          ) : (
            <div
              ref={containerRef}
              className={`group relative touch-manipulation overflow-hidden ${isDraggingVideo ? "z-50" : ""} ${playerClassName}`}
              onContextMenu={handleContextMenu}
              onTouchStart={handleFullscreenTouchStart}
              onTouchEnd={handleFullscreenTouchEnd}
            >
              <video
                ref={videoRef}
                className="h-full w-full object-contain"
                src={usingHls ? undefined : activeSrc ?? undefined}
                playsInline
                crossOrigin="anonymous"
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onVolumeChange={(e) => {
                  setMuted(e.currentTarget.muted);
                  setVolume(e.currentTarget.volume);
                }}
                onClick={handleVideoClick}
              />

              {likeBurst && (
                <div
                  key={likeBurst.id}
                  className="pointer-events-none absolute z-20 animate-like-pop"
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

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-6 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                <div className="group/progress relative h-4">
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
                    className="absolute inset-x-0 bottom-0 h-4 w-full cursor-pointer appearance-none bg-transparent
                      [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,#3b82f6_var(--progress),rgba(255,255,255,0.3)_var(--progress))]
                      [&::-webkit-slider-thumb]:mt-[-4.5px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:shadow-black/50
                      [&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,#3b82f6_var(--progress),rgba(255,255,255,0.3)_var(--progress))]
                      [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-500"
                    aria-label="Progresso do vídeo"
                  />
                </div>

                <div className="mt-2 flex items-center gap-3 text-white">
                  <button type="button" onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproduzir"} className="hover:text-blue-400">
                    {playing ? <Pause size={22} /> : <Play size={22} />}
                  </button>

                  <div className="group/volume flex items-center">
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

                  <span className="text-xs tabular-nums text-slate-200">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex-1" />

                  <button type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "Sair de ecrã inteiro" : "Ecrã inteiro"}
                    className="hover:text-blue-400"
                  >
                    {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                  </button>

                  <div ref={menuRef} className="relative flex items-center">
                    <button type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="Definições"
                      title="Definições"
                      className="flex items-center hover:text-blue-400"
                    >
                      <Settings size={20} />
                    </button>

                    {menuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-52 rounded-lg border border-white/10 bg-neutral-800/70 py-1 text-sm shadow-xl backdrop-blur-md">
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

                        {onToggleCinemaMode && (
                          <button type="button"
                            onClick={() => {
                              onToggleCinemaMode();
                              setMenuOpen(false);
                            }}
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
                      </div>
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
