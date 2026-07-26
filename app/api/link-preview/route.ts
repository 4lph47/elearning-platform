import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 4000;
const MAX_BYTES = 200_000;
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

// Bloqueia alvos internos/privados — isto busca uma URL escolhida por quem
// está a escrever a mensagem, sem isto dava para usar o servidor para sondar
// a rede interna (SSRF): localhost, IPs privados/link-local, etc.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^127\./.test(h) || h === "0.0.0.0" || h === "::1") return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return match[1];
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });
  if (isRateLimited(`link-preview:${session.user.id}`, MAX_REQUESTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Demasiados pedidos, tenta novamente daqui a pouco" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "URL em falta" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "URL inválido" }, { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "URL inválido" }, { status: 400 });
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "URL não suportado" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MozAcademyLinkPreview/1.0)" },
    });
    clearTimeout(timeout);

    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "Não foi possível obter pré-visualização" }, { status: 502 });
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "Sem pré-visualização disponível" }, { status: 415 });
    }

    // Só lê os primeiros MAX_BYTES — o <head> com as meta tags vem sempre
    // no início do HTML, nunca vale a pena descarregar a página toda.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
      }
    }
    reader.cancel().catch(() => {});
    const html = Buffer.concat(chunks).toString("utf-8");

    const title = extractMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
    const description = extractMeta(html, "og:description") ?? extractMeta(html, "description");
    let image = extractMeta(html, "og:image");
    if (image && !/^https?:\/\//i.test(image)) {
      image = new URL(image, target.toString()).toString();
    }

    return NextResponse.json({
      url: target.toString(),
      domain: target.hostname.replace(/^www\./, ""),
      title: title ? decodeEntities(title.trim()).slice(0, 200) : null,
      description: description ? decodeEntities(description.trim()).slice(0, 300) : null,
      image,
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível obter pré-visualização" }, { status: 502 });
  }
}
