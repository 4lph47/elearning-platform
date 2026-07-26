"use client";

import { useEffect, useState } from "react";

interface Preview {
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

// Cache em memória partilhada entre todas as instâncias — evita repetir o
// pedido de pré-visualização sempre que o mesmo link aparece (reenvios,
// scroll para cima a recarregar mensagens antigas, etc.).
const cache = new Map<string, Preview | null>();

// Preview estilo WhatsApp para links partilhados no chat (qualquer link, não
// só de cursos) — busca og:title/description/image via /api/link-preview
// (scraping leve e limitado do <head>, com proteções SSRF do lado do servidor).
export function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<Preview | null | undefined>(cache.get(url));

  useEffect(() => {
    if (cache.has(url)) {
      setPreview(cache.get(url) ?? null);
      return;
    }
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Preview | null) => {
        if (cancelled) return;
        cache.set(url, data);
        setPreview(data);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(url, null);
        setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (preview === undefined) {
    return <div className="mt-1.5 h-14 w-60 max-w-full animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />;
  }
  if (!preview || (!preview.title && !preview.image)) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex max-w-60 overflow-hidden rounded-lg border border-black/10 bg-white/70 text-left hover:bg-white dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30"
    >
      {preview.image && (
        <div className="h-14 w-14 shrink-0 bg-slate-200 dark:bg-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1 p-2">
        {preview.title && <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{preview.title}</p>}
        {preview.description && <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{preview.description}</p>}
        <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">{preview.domain}</p>
      </div>
    </a>
  );
}
