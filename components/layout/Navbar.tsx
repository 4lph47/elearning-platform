"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Search, GraduationCap, ChevronDown, LayoutGrid, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <GraduationCap className="h-4.5 w-4.5" size={18} />
          </span>
          E-Learn
        </Link>

        <form onSubmit={handleSearch} className="hidden max-w-md flex-1 sm:block">
          <div className="relative">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar cursos..."
              className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pl-4 pr-10 text-sm focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
              aria-label="Procurar"
            >
              <Search size={16} />
            </button>
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-5 text-sm">
          {status === "authenticated" ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {initials}
                </span>
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-900">{session.user.name}</p>
                    <p className="truncate text-xs text-slate-500">{session.user.email}</p>
                  </div>

                  <Link
                    href="/courses"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <LayoutGrid size={14} /> Catálogo
                  </Link>

                  {session.user.role !== "STUDENT" && (
                    <Link
                      href="/instructor"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <GraduationCap size={14} /> Área de Instrutor
                    </Link>
                  )}

                  {session.user.role === "STUDENT" && (
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <LayoutDashboard size={14} /> Meu Dashboard
                    </Link>
                  )}

                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              )}
            </div>
          ) : status === "unauthenticated" ? (
            <div className="flex items-center gap-2">
              <Link href="/courses" className="font-medium text-slate-600 transition-colors hover:text-slate-900">
                Catálogo
              </Link>
              <Link href="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link href="/register">
                <Button variant="primary">Registar</Button>
              </Link>
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
