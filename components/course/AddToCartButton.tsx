"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";

export function AddToCartButton({ courseId, isAuthenticated }: { courseId: string; isAuthenticated: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
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
    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
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
    <div>
      <button
        onClick={handleClick}
        disabled={adding}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5 disabled:opacity-60"
      >
        {added ? (
          <>
            <Check size={15} className="text-blue-400" /> No carrinho — ver carrinho
          </>
        ) : (
          <>
            <ShoppingCart size={15} /> {adding ? "A adicionar..." : "Adicionar ao carrinho"}
          </>
        )}
      </button>
      {error && <p className="mt-1.5 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
