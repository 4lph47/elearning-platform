"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ReviewForm({
  courseId,
  initialRating,
  initialComment,
}: {
  courseId: string;
  initialRating?: number;
  initialComment?: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Escolhe uma classificação");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, rating, comment }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao enviar avaliação");
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p className="rounded-md border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm text-blue-300">
        Obrigado pela tua avaliação!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/60">
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {initialRating ? "Editar a tua avaliação" : "Deixa a tua avaliação"}
      </p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} estrelas`}
          >
            <Star
              size={22}
              className={(hoverRating || rating) >= n ? "fill-blue-400 text-blue-400" : "text-slate-300 dark:text-slate-600"}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conta a tua experiência com este curso..."
        rows={3}
        className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
      />
      {error && <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>}
      <Button type="submit" variant="accent" disabled={loading} className="mt-3">
        {loading ? "A enviar..." : "Enviar avaliação"}
      </Button>
    </form>
  );
}
