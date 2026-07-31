"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Home,
  LayoutGrid,
  BookOpen,
  ShoppingCart,
  ShoppingBag,
  GraduationCap,
  LayoutDashboard,
  BarChart3,
  UserCircle,
  Bell,
  Users,
  Settings,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { SETTINGS_NAV_GROUPS } from "@/components/settings/settingsNavGroups";

interface LeafItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  extraMatch?: string[];
}

interface GroupItem {
  id: string;
  label: string;
  icon: LucideIcon;
  children: LeafItem[];
}

type NavItem = LeafItem | GroupItem;

function isGroup(item: NavItem): item is GroupItem {
  return "children" in item;
}

export function Sidebar() {
  const { state, close } = useSidebar();
  const { fadeNavigate } = useFadeNav();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  // undefined = utilizador ainda não tocou em nenhum grupo — usa o grupo do
  // seu próprio papel como aberto por omissão (só existe um dos dois por
  // sessão, nunca os dois ao mesmo tempo).
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);
  // Hover expande visualmente a barra minimizada (só sobrepõe o conteúdo,
  // fixed já garante isso) sem tocar no state persistido — sair do rato
  // devolve-a ao tamanho mini, sem afetar a margem do conteúdo principal.
  const [peeking, setPeeking] = useState(false);
  // Só interessa em mobile, dentro de /settings: qual dos dois painéis a
  // gaveta mostra (trocam por swipe). Fora daí a gaveta só tem um painel,
  // este estado fica sem efeito nenhum.
  const [mobilePanel, setMobilePanel] = useState<"main" | "settings">("settings");
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Horizontal tem de dominar claramente o vertical, senão um scroll da
    // lista (lateral tem overflow-y) troca de painel sem se querer.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setMobilePanel(dx > 0 ? "main" : "settings");
  }

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (pathname === href) return;
    e.preventDefault();
    fadeNavigate(href);
    // Mobile: a barra é um overlay a tapar o ecrã todo ("full") — sem isto
    // ficava aberta por cima da página nova até se tocar no fundo escuro ou
    // no hamburger outra vez. Desktop também usa "full" (expandida,
    // persistente) — aí não deve fechar sozinha, por isso só abaixo do
    // breakpoint mobile (mesmo valor do SidebarContext.tsx).
    if (window.innerWidth < 768) close();
  }

  // Google/link mágico deixa `status` "authenticated" já antes de aceitar
  // os termos (ver /register/complete) — sem este gate extra a sidebar dava
  // acesso a definições/carrinho/etc. a uma conta ainda por confirmar.
  const registered = status === "authenticated" && Boolean(session?.user.registered);
  const isInstructor = registered && session.user.role !== "STUDENT";

  const items: NavItem[] = [
    { href: "/", label: "Início", icon: Home },
    { href: "/courses", label: "Catálogo", icon: LayoutGrid },
    { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
    ...(registered && session.user.role === "STUDENT"
      ? [
          {
            id: "student",
            label: "Meu Aprendizado",
            icon: BookOpen,
            children: [
              { href: "/dashboard", label: "Painel", icon: LayoutDashboard, exact: true },
              { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
              { href: "/dashboard/resale", label: "Gerir revendas", icon: ShoppingBag },
              { href: `/students/${session.user.id}`, label: "Perfil público", icon: UserCircle },
            ],
          } as GroupItem,
        ]
      : []),
    ...(registered && session.user.role !== "STUDENT"
      ? [{ href: "/dashboard", label: "A minha aprendizagem", icon: BookOpen } as LeafItem]
      : []),
    ...(registered
      ? [{ href: "/communities", label: "Comunidades", icon: Users } as LeafItem]
      : []),
    ...(registered
      ? [{ href: "/notifications", label: "Notificações", icon: Bell } as LeafItem]
      : []),
    ...(registered
      ? [{ href: "/cart", label: "Carrinho", icon: ShoppingCart } as LeafItem]
      : []),
    ...(registered
      ? [{ href: "/settings", label: "Definições", icon: Settings } as LeafItem]
      : []),
    ...(isInstructor
      ? [
          {
            id: "instructor",
            label: "Área de Instrutor",
            icon: GraduationCap,
            children: [
              { href: "/instructor", label: "Painel", icon: LayoutDashboard, exact: true },
              { href: "/instructor/analytics", label: "Analytics", icon: BarChart3 },
              { href: "/instructor/resale", label: "Gerir revendas", icon: ShoppingBag },
              {
                href: `/instructors/${session?.user.id ?? ""}`,
                label: "Perfil público",
                icon: UserCircle,
              },
            ],
          } as GroupItem,
        ]
      : []),
  ];

  // Mobile só tem "closed"/"full" (nunca "mini") — em ecrãs pequenos as
  // Definições já ocupam o ecrã todo e a sua própria barra lateral fica
  // escondida (ver SettingsSidebar), por isso a gaveta principal troca de
  // conteúdo para as opções de Definições em vez de navegação geral. Só
  // md:hidden/hidden md:flex abaixo, não JS de viewport — desktop nunca
  // perde a navegação normal (a lateral própria das Definições já aparece
  // ao lado do conteúdo lá).
  const inSettings = pathname === "/settings" || pathname.startsWith("/settings/");

  // Cada vez que se entra de novo em /settings (vindo de fora), o painel
  // volta a arrancar nas opções de Definições — só o swipe dentro da secção
  // deve trocar para as opções gerais, não persistir depois de sair e voltar.
  useEffect(() => {
    if (inSettings) setMobilePanel("settings");
  }, [inSettings]);

  const isMini = state === "mini" && !peeking;
  const widthClass = state === "closed" ? "w-0" : isMini ? "w-16" : "w-60";
  const isActive = (item: LeafItem) => {
    if (item.extraMatch?.includes(pathname)) return true;
    if (item.href === "/" || item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <>
      {/* Sempre montado (não condicional) — só assim o fade consegue animar
          nos dois sentidos. Antes desaparecia/aparecia instantâneo (sem
          transição nenhuma) enquanto o <aside> ao lado levava 200ms a abrir
          a largura, lendo como o fade "chegar primeiro". Mesma duração dos
          dois agora, para acabarem juntos. */}
      <div
        className={`fixed inset-0 top-16 z-20 bg-black/20 transition-opacity duration-200 md:hidden ${
          state === "full" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={close}
        aria-hidden
      />
      {/* Navbar fica transparente nas páginas com hero (revela a imagem por
          baixo, de propósito) — sem isto, essa faixa transparente passava
          por cima da coluna da sidebar também, mostrando a hero em vez de
          branco/preto sólido nos primeiros 64px, acima do <aside> (que só
          começa em top-16). Tapa só a largura da sidebar, por baixo da navbar.
          Sempre montado (igual ao wrapper de baixo, nunca condicional em
          "closed") — condicional fazia isto aparecer/desaparecer de repente
          (sem transição, porque nasce/morre já no valor final) enquanto o
          wrapper de baixo, sempre montado, ia suavemente até w-0 — as duas
          partes da barra pareciam ter velocidades diferentes. widthClass já
          resolve pra w-0 sozinho quando "closed", nem precisa do condicional. */}
      <div
        className={`pointer-events-none fixed left-0 top-0 z-30 h-16 bg-white transition-[width] duration-200 dark:bg-black ${widthClass}`}
      >
        {/* Mesma fita de fade do <aside> lá em baixo, só que para os 64px
            tapados pelo header — sem isto, o fade da barra lateral só
            começava a meio do ecrã (top-16 pra baixo), com um troço sólido
            sem gradiente nenhum por cima dele. */}
        {state !== "closed" && (
          <div className="pointer-events-none absolute inset-y-0 left-full z-30 w-6 bg-gradient-to-r from-white to-transparent dark:from-black" />
        )}
      </div>
      {/* Wrapper sem overflow restrito nenhum — só ele controla posição/largura
          (fixed + widthClass). O <aside> lá dentro é que faz scroll
          (overflow-y-auto), com overflow-x explicitamente hidden (não
          "visible"): misturar overflow-y:auto com overflow-x:visible no MESMO
          elemento faz o browser converter esse "visible" sozinho para "auto"
          (regra do spec do CSS overflow) — cortava o fade na mesma, apesar da
          classe dizer "visible". Separar em dois elementos evita a regra. */}
      <div className={`fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] transition-[width] duration-200 ${widthClass}`}>
        <aside
          onMouseEnter={() => state === "mini" && setPeeking(true)}
          onMouseLeave={() => setPeeking(false)}
          onTouchStart={inSettings ? handleTouchStart : undefined}
          onTouchEnd={inSettings ? handleTouchEnd : undefined}
          className={`h-full w-full overflow-y-auto overflow-x-hidden bg-white dark:bg-black ${
            peeking ? "shadow-xl" : ""
          }`}
        >
          <nav className={`flex flex-col gap-1 p-2 transition-[width] duration-200 ${isMini ? "w-16" : "w-60"}`}>
          {inSettings && (
            <div className={`${mobilePanel === "settings" ? "flex" : "hidden"} flex-col gap-4 md:hidden`}>
              {SETTINGS_NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={(e) => handleNavClick(e, item.href)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                            active
                              ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                          }`}
                        >
                          <Icon size={18} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div
            className={
              inSettings
                ? `${mobilePanel === "main" ? "flex" : "hidden"} flex-col gap-1 md:flex`
                : "flex flex-col gap-1"
            }
          >
          {items.map((item) => {
            if (!isGroup(item)) {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isMini ? item.label : undefined}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive(item)
                      ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  } ${isMini ? "justify-center" : ""}`}
                >
                  <Icon size={18} />
                  {!isMini && <span className="truncate">{item.label}</span>}
                </Link>
              );
            }

            const GroupIcon = item.icon;
            // undefined = ainda por tocar — só existe um GroupItem por sessão
            // (instrutor OU aluno, nunca os dois), por isso abre-o por omissão.
            const expanded = !isMini && (openGroup === item.id || openGroup === undefined);
            const groupActive = item.children.some((c) => isActive(c));

            return (
              <div key={item.id}>
                {isMini ? (
                  <Link
                    href={item.children[0].href}
                    title={item.label}
                    onClick={(e) => handleNavClick(e, item.children[0].href)}
                    className={`flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium ${
                      groupActive
                        ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    <GroupIcon size={18} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenGroup((g) => (g === item.id || g === undefined ? null : item.id))}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      groupActive
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    <GroupIcon size={18} />
                    <span className="truncate">{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={`ml-auto shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                    />
                  </button>
                )}

                {expanded && (
                  <div className="ml-4 mt-0.5 flex flex-col gap-0.5 pl-3">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={(e) => handleNavClick(e, child.href)}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${
                            isActive(child)
                              ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                              : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                          }`}
                        >
                          <ChildIcon size={15} />
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
          </nav>
        </aside>
        {state !== "closed" && (
          <div className="pointer-events-none absolute inset-y-0 left-full z-30 w-6 bg-gradient-to-r from-white to-transparent dark:from-black" />
        )}
      </div>
    </>
  );
}
