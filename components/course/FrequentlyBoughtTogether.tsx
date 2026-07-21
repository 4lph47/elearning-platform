"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";

interface BundleItem {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  instructorName: string;
}

export function FrequentlyBoughtTogether({
  name,
  primary,
  extras,
  isAuthenticated,
}: {
  name: string;
  primary: BundleItem;
  extras: BundleItem[];
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(extras.map((e) => e.id)));
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (extras.length === 0) return null;

  const checkedExtras = extras.filter((e) => selected.has(e.id));
  const total = primary.price + checkedExtras.reduce((sum, e) => sum + e.price, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addAll() {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/cart")}`);
      return;
    }
    if (added) {
      router.push("/cart");
      return;
    }
    setAdding(true);
    setError(null);
    const courseIds = [primary.id, ...checkedExtras.map((e) => e.id)];
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds }),
    });
    setAdding(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao adicionar ao carrinho");
      return;
    }

    setAdded(true);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</p>

      <ul className="space-y-3">
        {[primary, ...extras].map((item) => (
          <li key={item.id} className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={item.id === primary.id || selected.has(item.id)}
              disabled={item.id === primary.id}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 shrink-0 rounded accent-blue-600"
            />
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnailUrl} alt={item.title} className="h-10 w-14 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-10 w-14 shrink-0 rounded bg-slate-200 dark:bg-slate-800" />
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/courses/${item.slug}`}
                className="line-clamp-1 text-xs font-medium text-slate-800 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
              >
                {item.title}
              </Link>
              <p className="text-[11px] text-slate-500">{item.instructorName}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-900 dark:text-white">
              {item.price === 0 ? "Grátis" : `${item.price.toFixed(2)}€`}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-white/10">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Preço para {1 + checkedExtras.length} curso{checkedExtras.length !== 0 ? "s" : ""}
        </p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{total.toFixed(2)}€</p>
      </div>
      <button
        onClick={addAll}
        disabled={adding}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
      >
        {added ? (
          <>
            <Check size={15} /> No carrinho — ver carrinho
          </>
        ) : (
          <>
            <ShoppingCart size={15} /> {adding ? "A adicionar..." : "Adicionar tudo ao carrinho"}
          </>
        )}
      </button>
      {error && <p className="mt-1.5 text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
