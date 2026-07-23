"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Search, GraduationCap, ChevronDown, LayoutGrid, LayoutDashboard, LogOut, Sun, Moon, ShoppingCart, BookOpen, Menu, X, ArrowLeft, Mic } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSidebar } from "@/components/layout/SidebarContext";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { FadeLink } from "@/components/course/FadeLink";
import { getRecentCourseSearches, addRecentCourseSearch, type RecentCourseSearch } from "@/lib/recentCourseSearches";

const HERO_PATH = /^\/$|^\/courses\/[^/]+$|^\/instructors\/[^/]+$/;
const SUGGEST_DEBOUNCE_MS = 250;

interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

function getSpeechRecognition(): (new () => MinimalSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => MinimalSpeechRecognition;
    webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { toggle: toggleSidebar } = useSidebar();
  const { curtainActive, fadeNavigate } = useFadeNav();
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [suggestions, setSuggestions] = useState<RecentCourseSearch[]>([]);
  const [recents, setRecents] = useState<RecentCourseSearch[]>([]);
  const [desktopFocused, setDesktopFocused] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasHero = HERO_PATH.test(pathname);
  const transparent = hasHero && !scrolled;
  // Mobile abre/fecha a barra inteira via mobileSearchOpen; no desktop a
  // barra já está sempre visível — o dropdown ali reage a foco, não a esse
  // estado (que no desktop nunca chega a mudar).
  const dropdownOpen = mobileSearchOpen || desktopFocused;

  useEffect(() => setMounted(true), []);

  useEffect(() => setMobileSearchOpen(false), [pathname]);

  useEffect(() => {
    if (dropdownOpen) setRecents(getRecentCourseSearches());
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const query = q.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q, dropdownOpen]);

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

  useEffect(() => {
    if (!mobileSearchOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setMobileSearchOpen(false);
        setQ("");
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileSearchOpen]);

  // O input nunca desmonta (colapsa via max-width, não display:none) — o
  // autoFocus do JSX só dispara uma vez na montagem, por isso não reage a
  // reabrir a pesquisa depois da primeira vez. Foco manual aqui trata disso.
  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fadeNavigate(q ? `/courses?q=${encodeURIComponent(q)}` : "/courses");
    setMenuOpen(false);
    setMobileSearchOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function closeMobileSearch() {
    setMobileSearchOpen(false);
    setQ("");
    setSuggestions([]);
  }

  function selectCourse(item: RecentCourseSearch) {
    addRecentCourseSearch(item);
    setMobileSearchOpen(false);
    setDesktopFocused(false);
    setQ("");
    fadeNavigate(`/courses/${item.slug}`);
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function startVoiceSearch() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    // Foco + seleção explícitos: sem isto o campo podia não estar mesmo
    // "ativo" quando o clique no botão do lado lhe tirava o foco, e o texto
    // ditado substitui o que já lá estava em vez de ficar escondido atrás.
    searchInputRef.current?.focus();
    searchInputRef.current?.select();

    const recognition = new Recognition();
    recognition.lang = "pt-PT";
    // interimResults: methods como o Chrome Android só disparam o resultado
    // final depois de uma pausa a falar — sem parciais, se a sessão acabar
    // antes disso (blur, timeout) nada chega a aparecer. Isto escreve à
    // medida que a pessoa fala, não só no fim.
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const transcript = last?.[0]?.transcript;
      if (transcript) setQ(transcript);
    };
    recognition.start();
  }

  const initials = session?.user.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") ?? "?";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 select-none transition-colors duration-300 ${
        curtainActive
          ? "bg-white dark:bg-black"
          : transparent
          ? "bg-gradient-to-b from-white/70 via-white/30 to-transparent dark:from-black/70 dark:via-black/30 dark:to-transparent"
          : "border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-black/90"
      }`}
    >
      <div className="grid h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-2 px-5 sm:gap-4">
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={closeMobileSearch}
            aria-label="Voltar"
            className={`flex h-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-[900ms] ease-in-out sm:hidden ${
              mobileSearchOpen ? "mr-1 w-8 opacity-100" : "mr-0 w-0 opacity-0"
            } ${
              transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            <ArrowLeft size={18} className="shrink-0" />
          </button>

          <div
            className={`flex items-center gap-7 overflow-hidden transition-all duration-[900ms] ease-in-out ${
              mobileSearchOpen ? "max-w-0 opacity-0 sm:max-w-none sm:opacity-100" : "max-w-[220px] opacity-100"
            }`}
          >
            <button
              onClick={toggleSidebar}
              aria-label="Alternar menu lateral"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <Menu size={18} />
            </button>
            <FadeLink
              href="/"
              className="flex shrink-0 items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <GraduationCap className="h-4.5 w-4.5" size={18} />
              </span>
              <span>E-Learn</span>
            </FadeLink>
          </div>
        </div>

        <div
          ref={searchRef}
          className={`relative mx-auto w-full overflow-visible transition-all duration-[900ms] ease-in-out sm:max-w-lg sm:opacity-100 ${
            mobileSearchOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setDesktopFocused(true)}
                onBlur={() => setDesktopFocused(false)}
                placeholder="Procurar cursos..."
                className={`w-full select-text rounded-full border py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-1 ${
                  transparent
                    ? "border-slate-900/20 bg-slate-900/10 text-slate-900 placeholder-slate-600 focus:border-slate-900/40 focus:ring-slate-900/30 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-slate-300 dark:focus:border-white/40 dark:focus:ring-white/30"
                    : "border-slate-300 bg-slate-50 text-slate-900 focus:border-slate-500 focus:bg-white focus:ring-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-white/10"
                }`}
              />
              <button
                type="button"
                onClick={q ? () => setQ("") : startVoiceSearch}
                aria-label={q ? "Limpar pesquisa" : "Pesquisar por voz"}
                className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full sm:hidden ${
                  transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
                }`}
              >
                {q ? <X size={16} /> : <Mic size={16} />}
              </button>
              <button
                type="submit"
                className={`absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full sm:flex ${
                  transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
                }`}
                aria-label="Procurar"
              >
                <Search size={16} />
              </button>
            </div>
          </form>

          {dropdownOpen && (q.trim() ? suggestions : recents).length > 0 && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg transition-opacity duration-300 dark:border-white/10 dark:bg-neutral-900">
              {(q.trim() ? suggestions : recents).map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectCourse(item)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
                    {item.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex items-center justify-end gap-3 text-sm">
          {status === "authenticated" && (
            <Link
              href="/dashboard"
              prefetch
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
              className={`relative hidden h-8 w-8 items-center justify-center rounded-full sm:flex ${
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

          {!mobileSearchOpen && (
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Procurar"
              className={`flex h-8 w-8 items-center justify-center rounded-full sm:hidden ${
                transparent ? "text-slate-700 hover:bg-slate-900/10 dark:text-slate-200 dark:hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <Search size={16} />
            </button>
          )}

          <div
            className={`flex shrink-0 items-center gap-3 transition-all duration-[900ms] ease-in-out ${
              mobileSearchOpen
                ? "max-w-0 overflow-hidden opacity-0 sm:max-w-none sm:overflow-visible sm:opacity-100"
                : "max-w-[220px] overflow-visible opacity-100"
            }`}
          >
          {mounted && status !== "authenticated" && (
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
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-white/10">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{session.user.name}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
                  </div>

                  <FadeLink
                    href="/courses"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <LayoutGrid size={14} /> Catálogo
                  </FadeLink>

                  {session.user.role !== "STUDENT" && (
                    <FadeLink
                      href="/instructor"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      <GraduationCap size={14} /> Área de Instrutor
                    </FadeLink>
                  )}

                  <FadeLink
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <LayoutDashboard size={14} /> A minha aprendizagem
                  </FadeLink>

                  <FadeLink
                    href="/cart"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white sm:hidden"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart size={14} /> Carrinho
                    </span>
                    {cartCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                        {cartCount}
                      </span>
                    )}
                  </FadeLink>

                  {mounted && (
                    <button
                      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                      {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                      {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
                    </button>
                  )}

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
                prefetch
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
              <Link href="/register" className="hidden sm:inline-flex">
                <Button variant="accent">Registar</Button>
              </Link>
            </div>
          ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
