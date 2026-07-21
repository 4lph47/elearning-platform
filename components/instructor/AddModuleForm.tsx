"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function AddModuleForm({ courseId, nextOrder }: { courseId: string; nextOrder: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/instructor/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, order: nextOrder }),
    });
    setLoading(false);
    if (res.ok) {
      setTitle("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + Adicionar módulo
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
      <Input
        placeholder="Título do módulo"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />
      <Button type="submit" disabled={loading}>
        Adicionar
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}
