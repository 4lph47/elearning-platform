"use client";

import { useEffect, useRef, useState } from "react";
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
  Settings,
  Theater,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSidebarCollapsed } from "@/components/course/ChatOpenContext";
import { getYouTubeId } from "@/lib/youtube";

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
  textContent,
  initialWatchedSeconds,
  onComplete,
  cinemaMode,
  onToggleCinemaMode,
}: {
  lessonId: string;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  textContent?: string | null;
  initialWatchedSeconds: number;
  onComplete: () => void;
  cinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
}) {
  const lastSentRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [ambientColor, setAmbientColor] = useState("rgb(0,0,0)");
  const collapsed = useSidebarCollapsed();
  const youtubeId = contentUrl ? getYouTubeId(contentUrl) : null;

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [loop, setLoop] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<number[]>(seededHeatmapBaseline(lessonId));
  const lastHeatmapRenderRef = useRef(0);
  const [, setHeatmapVersion] = useState(0);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setSpeedOpen(false);
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

  // Modo cinema: amostra a cor média do frame atual para um glow ambiente atrás do vídeo.
  // Só funciona com <video> nativo — o iframe do YouTube não expõe pixels por CORS.
  useEffect(() => {
    if (!cinemaMode || youtubeId || type !== "VIDEO") return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 16;
      canvasRef.current.height = 9;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let r = 0, g = 0, b = 0;
        const pixelCount = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        setAmbientColor(`rgb(${Math.round(r / pixelCount)}, ${Math.round(g / pixelCount)}, ${Math.round(b / pixelCount)})`);
      } catch {
        // fonte cross-origin sem CORS habilitado — canvas fica "tainted", ignora
      }
    }, 200);

    return () => clearInterval(id);
  }, [cinemaMode, youtubeId, type]);

  async function sendProgress(payload: { watchedSeconds?: number; completed?: boolean }) {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, ...payload }),
    });
  }

  function handleLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    setDuration(e.currentTarget.duration);
    if (initialWatchedSeconds > 0 && initialWatchedSeconds < e.currentTarget.duration) {
      e.currentTarget.currentTime = initialWatchedSeconds;
    }
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

  const playerClassName = `aspect-video w-full rounded-lg bg-black lg:max-w-none ${
    collapsed ? "lg:w-[1080px]" : "lg:w-[800px]"
  }`;
  const heatmapPath = buildHeatmapAreaPath(heatmapRef.current);
  const heatmapLinePath = buildHeatmapLinePath(heatmapRef.current);

  return (
    <div className="space-y-4">
      {type === "TEXT" ? (
        <div
          className={`overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-neutral-900 lg:max-w-none ${
            collapsed ? "lg:w-[1080px]" : "lg:w-[800px]"
          }`}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{textContent}</p>
        </div>
      ) : (
        <div className="relative" style={cinemaMode && !youtubeId ? { contain: "layout" } : undefined}>
          {cinemaMode && !youtubeId && (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] blur-3xl transition-colors duration-500 lg:-inset-16"
              style={{ backgroundColor: ambientColor, opacity: 0.6 }}
            />
          )}
          {youtubeId ? (
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&enablejsapi=1`}
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
            <div ref={containerRef} className={`group relative overflow-hidden ${playerClassName}`} onContextMenu={handleContextMenu}>
              <video
                ref={videoRef}
                className="h-full w-full"
                src={contentUrl ?? undefined}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onVolumeChange={(e) => {
                  setMuted(e.currentTarget.muted);
                  setVolume(e.currentTarget.volume);
                }}
                onClick={togglePlay}
              />

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
                  <button onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproduzir"} className="hover:text-blue-400">
                    {playing ? <Pause size={22} /> : <Play size={22} />}
                  </button>

                  <div className="group/volume flex items-center">
                    <button onClick={toggleMute} aria-label={muted ? "Ativar som" : "Silenciar"} className="flex items-center hover:text-blue-400">
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

                  <button onClick={toggleFullscreen} aria-label={isFullscreen ? "Sair de ecrã inteiro" : "Ecrã inteiro"} className="hover:text-blue-400">
                    {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                  </button>

                  <div ref={menuRef} className="relative flex items-center">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="Definições"
                      title="Definições"
                      className="flex items-center hover:text-blue-400"
                    >
                      <Settings size={20} />
                    </button>

                    {menuOpen && (
                      <div className="absolute bottom-full right-0 mb-2 w-52 rounded-lg border border-white/10 bg-neutral-800/70 py-1 text-sm shadow-xl backdrop-blur-md">
                        <button
                          onClick={handleDownload}
                          className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <Download size={16} />
                          Download
                        </button>

                        <button
                          onClick={() => setSpeedOpen((v) => !v)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <Gauge size={16} />
                          Velocidade
                          <span className="ml-auto text-slate-400">{playbackRate}x</span>
                        </button>
                        {speedOpen && (
                          <div className="grid grid-cols-3 gap-1 px-3 pb-2">
                            {PLAYBACK_RATES.map((rate) => (
                              <button
                                key={rate}
                                onClick={() => setRate(rate)}
                                className={`rounded px-2 py-1 text-xs ${
                                  rate === playbackRate ? "bg-blue-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
                                }`}
                              >
                                {rate}x
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={togglePiP}
                          className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                        >
                          <PictureInPicture2 size={16} />
                          Picture-in-picture
                          {isPiP && <span className="ml-auto text-blue-400">✓</span>}
                        </button>

                        {onToggleCinemaMode && (
                          <button
                            onClick={() => {
                              onToggleCinemaMode();
                              setMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2 text-slate-200 hover:bg-white/10"
                          >
                            <Theater size={16} />
                            Modo cinema
                            {cinemaMode && <span className="ml-auto text-blue-400">✓</span>}
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
                  <button
                    onClick={toggleLoop}
                    className="flex w-full items-center gap-2 px-3 py-2 text-slate-200 hover:bg-white/10"
                  >
                    <Repeat size={16} />
                    Repetir
                    {loop && <Check size={16} className="ml-auto text-blue-400" />}
                  </button>
                  <button
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
