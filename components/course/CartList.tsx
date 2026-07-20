"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ShoppingCart } from "lucide-react";

interface CartCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  instructorName: string;
}

export function CartList({ items: initialItems }: { items: CartCourse[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(courseId: string) {
    setRemovingId(courseId);
    const res = await fetch(`/api/cart/${courseId}`, { method: "DELETE" });
    setRemovingId(null);
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== courseId));
      router.refresh();
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-950 p-8 text-center">
        <ShoppingCart size={28} className="mx-auto text-slate-600" />
        <p className="mt-3 text-slate-400">O teu carrinho está vazio.</p>
        <Link href="/courses" className="mt-4 inline-block text-sm font-medium text-blue-400 hover:underline">
          Explorar cursos
        </Link>
      </div>
    );
  }

  const total = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-4">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnailUrl} alt={item.title} className="h-14 w-20 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="h-14 w-20 shrink-0 rounded-md bg-slate-800" />
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/courses/${item.slug}`} className="line-clamp-1 font-medium text-slate-100 hover:text-blue-400">
                {item.title}
              </Link>
              <p className="text-xs text-slate-500">{item.instructorName}</p>
            </div>
            <span className="shrink-0 font-semibold text-white">
              {item.price === 0 ? "Grátis" : `${item.price.toFixed(2)}€`}
            </span>
            <button
              onClick={() => remove(item.id)}
              disabled={removingId === item.id}
              aria-label="Remover do carrinho"
              className="shrink-0 text-slate-500 hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-sm text-slate-300">Total ({items.length} curso{items.length !== 1 ? "s" : ""})</span>
        <span className="text-lg font-bold text-white">{total.toFixed(2)}€</span>
      </div>

      <Link
        href="/checkout"
        className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-500"
      >
        Finalizar compra
      </Link>
    </div>
  );
}
