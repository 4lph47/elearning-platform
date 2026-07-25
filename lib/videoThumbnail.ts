// Thumbnail automático da aula: captura o 1º frame do vídeo direto no
// browser (canvas), no momento do upload — processamento client-side, sem
// tocar no worker do Railway. Só é usado como fallback quando o instrutor
// não escolhe um thumbnail à mão (ver handleGenerateThumbnail em
// LessonEditScreen.tsx).

// Frame em t=0 é muitas vezes preto/transição — um instante à frente já
// costuma ter conteúdo real, sem arriscar passar do fim em vídeos curtos.
const CAPTURE_TIME_SECONDS = 0.3;

function loadVideoElement(file: File): Promise<{ video: HTMLVideoElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;
    video.onloadedmetadata = () => resolve({ video, objectUrl });
    video.onerror = () => reject(new Error("Não foi possível ler o vídeo"));
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("Não foi possível avançar o vídeo"));
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.1));
  });
}

export async function captureFirstFrame(file: File): Promise<Blob> {
  const { video, objectUrl } = await loadVideoElement(file);
  try {
    await seekTo(video, CAPTURE_TIME_SECONDS);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas não suportado");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Falha ao gerar imagem do frame");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadThumbnailBlob(blob: Blob): Promise<{ url: string; name: string }> {
  const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", "IMAGE");
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao enviar thumbnail");
  return { url: data.url, name: data.name };
}
