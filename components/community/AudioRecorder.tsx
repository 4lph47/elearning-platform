"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, X, Send, Circle } from "lucide-react";

export function AudioRecorder({
  onRecordingComplete,
  onCancel,
}: {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
          onRecordingComplete(blob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Atualizar contador de duração a cada segundo
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao aceder ao microfone:", err);
      setError("Não foi possível aceder ao microfone. Verifica as permissões.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleCancel() {
    stopRecording();
    // Descartar a gravação
    chunksRef.current = [];
    if (mediaRecorderRef.current) {
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach((track) => track.stop());
    }
    onCancel();
  }

  function handleSend() {
    stopRecording();
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={onCancel}
          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
      <div className="flex items-center gap-2">
        {isRecording && (
          <Circle size={12} className="animate-pulse fill-red-600 text-red-600 dark:fill-red-400 dark:text-red-400" />
        )}
        <Mic size={20} className="text-red-600 dark:text-red-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">A gravar áudio...</p>
        <p className="text-xs text-red-600 dark:text-red-400">{formatDuration(duration)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
          aria-label="Cancelar gravação"
        >
          <X size={18} />
        </button>
        <button
          onClick={handleSend}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          aria-label="Enviar áudio"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
