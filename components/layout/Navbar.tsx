"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Search, GraduationCap, ChevronDown, LayoutGrid, LayoutDashboard, LogOut, Sun, Moon, ShoppingCart, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";

const HERO_PATH = /^\/$|^\/courses\/[^/]+$|^\/instructors\/[^/]+$/;

export function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasHero = HERO_PATH.test(pathname);
  const transparent = hasHero && !scrolled;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (status !== "authenticated") {
      setCartCount(0);
      return;
    }
    fetch("/api/cart")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCartCount(data.count))
      .catch(() => {});
  }, [status, pathname]);

  useEffect(() => {
    if (!hasHero) {
      setScrolled(false);
      return;
    }
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasHero]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
    setMenuOpen(false);
  }

  const initials = session?.user.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") ?? "?";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        transparent
          ? "bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-black/70 dark:via-black/30 dark:to-transparent"
          : "border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-black/90"
      }`}
    >
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <GraduationCap className="h-4.5 w-4.5" size={18} />
          </span>
          E-Learn
        </Link>

        <form onSubmit={handleSearch} className="mx-auto hidden w-full max-w-md sm:block">
          <div className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar cursos..."
              className={`w-full rounded-full border py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-1 ${
                transparent
                  ? "border-white/20 bg-white/10 text-white placeholder-slate-300 focus:border-white/40 focus:ring-white/30"
                  : "border-slate-300 bg-slate-50 text-slate-900 focus:border-slate-500 focus:bg-white focus:ring-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-white/10"
              }`}
            />
            <button
              type="submit"
              className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full ${
                transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
              }`}
              aria-label="Procurar"
            >
              <Search size={16} />
            </button>
          </div>
        </form>

        <nav className="flex items-center justify-end gap-3 text-sm">
          {status === "authenticated" && (
            <Link
              href="/dashboard"
              aria-label="A minha aprendizagem"
              className={`hidden h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium sm:flex ${
                transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <BookOpen size={15} /> A minha aprendizagem
            </Link>
          )}
          {status === "authenticated" && (
            <Link
              href="/cart"
              aria-label="Carrinho"
              className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <ShoppingCart size={16} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Alternar tema claro/escuro"
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}

          {status === "authenticated" ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2 ${transparent ? "hover:bg-slate-900/10 dark:hover:bg-white/10" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {initials}
                </span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${menuOpen ? "rotate-180" : ""} ${transparent ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400"}`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-slate-950">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-white/10">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{session.user.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
                  </div>

                  <Link
                    href="/courses"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <LayoutGrid size={14} /> Catálogo
                  </Link>

                  {session.user.role !== "STUDENT" && (
                    <Link
                      href="/instructor"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      <GraduationCap size={14} /> Área de Instrutor
                    </Link>
                  )}

                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <LayoutDashboard size={14} /> A minha aprendizagem
                  </Link>

                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              )}
            </div>
          ) : status === "unauthenticated" ? (
            <div className="flex items-center gap-2">
              <Link
                href="/courses"
                className={`hidden font-medium transition-colors sm:inline ${
                  transparent
                    ? "text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                Catálogo
              </Link>
              <Link href="/login">
                <Button variant={transparent ? "outline-dark" : "ghost"}>Entrar</Button>
              </Link>
              <Link href="/register">
                <Button variant="accent">Registar</Button>
              </Link>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
