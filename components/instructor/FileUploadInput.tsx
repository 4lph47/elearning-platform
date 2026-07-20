"use client";

import { useState } from "react";

type Kind = "VIDEO" | "DOCUMENT" | "IMAGE";

const ACCEPT: Record<Kind, string> = {
  VIDEO: "video/mp4,video/webm",
  DOCUMENT: "application/pdf",
  IMAGE: "image/png,image/jpeg,image/webp",
};

export function FileUploadInput({
  kind,
  onUploaded,
}: {
  kind: Kind;
  onUploaded: (result: { url: string; sizeBytes: number; name: string; mimeType: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar ficheiro");
      return;
    }

    setUploadedName(data.name);
    onUploaded(data);
  }

  return (
    <div>
      <input
        type="file"
        accept={ACCEPT[kind]}
        onChange={handleChange}
        disabled={uploading}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-white/10 dark:file:text-slate-200 dark:hover:file:bg-white/15"
      />
      {uploading && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A enviar...</p>}
      {uploadedName && !uploading && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Enviado: {uploadedName}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
