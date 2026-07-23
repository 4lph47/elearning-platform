"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Home,
  LayoutGrid,
  BookOpen,
  ShoppingCart,
  GraduationCap,
  LayoutDashboard,
  BarChart3,
  UserCircle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useFadeNav } from "@/components/course/FadeNavContext";

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
  const [openGroup, setOpenGroup] = useState<string | null>("instructor");
  // Hover expande visualmente a barra minimizada (só sobrepõe o conteúdo,
  // fixed já garante isso) sem tocar no state persistido — sair do rato
  // devolve-a ao tamanho mini, sem afetar a margem do conteúdo principal.
  const [peeking, setPeeking] = useState(false);

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (pathname === href) return;
    e.preventDefault();
    fadeNavigate(href);
  }

  const isInstructor = status === "authenticated" && session.user.role !== "STUDENT";

  const items: NavItem[] = [
    { href: "/", label: "Início", icon: Home },
    { href: "/courses", label: "Catálogo", icon: LayoutGrid },
    ...(status === "authenticated"
      ? [{ href: "/dashboard", label: "A minha aprendizagem", icon: BookOpen } as LeafItem]
      : []),
    ...(status === "authenticated"
      ? [{ href: "/cart", label: "Carrinho", icon: ShoppingCart } as LeafItem]
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
              {
                href: "/instructor/profile",
                label: "Perfil público",
                icon: UserCircle,
                extraMatch: session?.user.id ? [`/instructors/${session.user.id}`] : [],
              },
            ],
          } as GroupItem,
        ]
      : []),
  ];

  const isMini = state === "mini" && !peeking;
  const widthClass = state === "closed" ? "w-0" : isMini ? "w-16" : "w-60";
  const edgeLeftClass = state === "closed" ? "left-0" : isMini ? "left-16" : "left-60";
  const isActive = (item: LeafItem) => {
    if (item.extraMatch?.includes(pathname)) return true;
    if (item.href === "/" || item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <>
      {state === "full" && (
        <div
          className="fixed inset-0 top-16 z-20 bg-black/20 md:hidden"
          onClick={close}
          aria-hidden
        />
      )}
      {/* Navbar fica transparente nas páginas com hero (revela a imagem por
          baixo, de propósito) — sem isto, essa faixa transparente passava
          por cima da coluna da sidebar também, mostrando a hero em vez de
          branco/preto sólido nos primeiros 64px, acima do <aside> (que só
          começa em top-16). Tapa só a largura da sidebar, por baixo da navbar. */}
      {state !== "closed" && (
        <div
          className={`pointer-events-none fixed left-0 top-0 z-30 h-16 bg-white transition-[width] duration-200 dark:bg-black ${widthClass}`}
        />
      )}
      <aside
        onMouseEnter={() => state === "mini" && setPeeking(true)}
        onMouseLeave={() => setPeeking(false)}
        className={`fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden bg-white transition-[width] duration-200 dark:bg-black ${widthClass} ${
          peeking ? "shadow-xl" : ""
        }`}
      >
        {state !== "closed" && (
          <div
            className={`pointer-events-none fixed inset-y-0 z-30 w-6 bg-gradient-to-r from-white to-transparent transition-[left] duration-200 dark:from-black ${edgeLeftClass}`}
          />
        )}
        <nav className={`flex flex-col gap-1 p-2 transition-[width] duration-200 ${isMini ? "w-16" : "w-60"}`}>
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
            const expanded = !isMini && openGroup === item.id;
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
                    onClick={() => setOpenGroup((g) => (g === item.id ? null : item.id))}
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
        </nav>
      </aside>
    </>
  );
}
