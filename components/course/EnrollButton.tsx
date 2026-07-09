"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function EnrollButton({
  courseId,
  isAuthenticated,
  firstLessonHref,
}: {
  courseId: string;
  isAuthenticated: boolean;
  firstLessonHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll() {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
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

    router.push(firstLessonHref);
    router.refresh();
  }

  return (
    <div>
      <Button onClick={handleEnroll} disabled={loading} className="w-full">
        {loading ? "A matricular..." : "Matricular-me gratuitamente"}
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
