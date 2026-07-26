"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// A página de comunidade é ecrã inteiro (chat estilo WhatsApp/Telegram, ou o
// ecrã de info) — o rodapé normal do site não faz sentido aí. Não afeta
// /communities (a listagem) nem /communities/new (o form de criação).
// Também ocultamos o footer nas páginas de aula para maximizar o espaço do player.
function hidesFooter(pathname: string | null) {
  if (!pathname) return false;
  if (/^\/communities\/(?!new(\/|$))[^/]+/.test(pathname)) return true;
  if (/^\/courses\/[^/]+\/lessons\/[^/]+/.test(pathname)) return true;
  return pathname === "/login" || pathname === "/register" || pathname.startsWith("/register/");
}

export function ConditionalFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (hidesFooter(pathname)) return null;
  return <>{children}</>;
}
