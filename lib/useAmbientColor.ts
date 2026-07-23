"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// Amostra a cor média do frame atual de um <video> nativo pra um glow
// ambiente (mesma técnica usada no modo cinema da aula e no preview de
// trailer dos cards). Só funciona com <video> — iframe (YouTube) não expõe
// pixels por CORS, "active" deve vir false nesse caso.
export function useAmbientColor(videoRef: RefObject<HTMLVideoElement | null>, active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState("rgb(0,0,0)");

  useEffect(() => {
    if (!active) return;

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
        setColor(`rgb(${Math.round(r / pixelCount)}, ${Math.round(g / pixelCount)}, ${Math.round(b / pixelCount)})`);
      } catch {
        // fonte cross-origin sem CORS habilitado — canvas fica "tainted", ignora
      }
    }, 200);

    return () => clearInterval(id);
  }, [active, videoRef]);

  return color;
}
