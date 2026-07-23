"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

// <video> simples que sabe tocar HLS (master.m3u8) em qualquer browser —
// para pré-visualizações leves (ex.: editor de aula) que não precisam do
// resto do LessonPlayer (progresso, gestos, seletor de qualidade). Vídeo
// normal (não .m3u8) continua a funcionar igual, sem hls.js a meio.
export function HlsVideo({
  src,
  className,
  controls = true,
}: {
  src: string;
  className?: string;
  controls?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!src.endsWith(".m3u8")) {
      video.src = src;
      return;
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }
    if (!Hls.isSupported()) return;

    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [src]);

  return <video ref={videoRef} controls={controls} className={className} />;
}
