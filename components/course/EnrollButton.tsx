"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useFadeNav } from "@/components/course/FadeNavContext";

export function EnrollButton({
  courseId,
  courseSlug,
  price,
  isAuthenticated,
  firstLessonHref,
}: {
  courseId: string;
  courseSlug: string;
  price: number;
  isAuthenticated: boolean;
  firstLessonHref: string;
}) {
  const router = useRouter();
  const { fadeNavigate } = useFadeNav();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll() {
    if (!isAuthenticated) {
      const target = price > 0 ? `/courses/${courseSlug}/checkout` : window.location.pathname;
      router.push(`/login?callbackUrl=${encodeURIComponent(target)}`);
      return;
    }

    if (price > 0) {
      router.push(`/courses/${courseSlug}/checkout`);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao matricular");
      return;
    }

    fadeNavigate(firstLessonHref);
    router.refresh();
  }

  return (
    <div>
      <Button onClick={handleEnroll} disabled={loading} variant="accent" className="w-full">
        {loading ? "A matricular..." : price > 0 ? "Inscrever-me" : "Inscrever-me gratuitamente"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
