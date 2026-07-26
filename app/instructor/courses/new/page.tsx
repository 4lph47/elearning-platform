"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { CategoryPicker } from "@/components/instructor/CategoryPicker";
import { CornerCard, CornerCardStack, CornerCardIssueList, focusField, type CornerCardIssue } from "@/components/ui/CornerCard";

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [saveIssues, setSaveIssues] = useState<CornerCardIssue[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaveIssues(null);

    const res = await fetch("/api/instructor/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, level, published: false }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setSaveIssues(data.issues ?? [{ message: data.error ?? "Erro ao criar curso" }]);
      return;
    }

    router.push(`/instructor/courses/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card className="p-6">
        <h1 className="mb-6 text-xl font-bold">Criar novo curso</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="category">Categoria</Label>
            <CategoryPicker id="category" value={category} onChange={setCategory} />
          </div>
          <div>
            <Label htmlFor="level">Nível</Label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="beginner">Iniciante</option>
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="intermediate">Intermédio</option>
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="advanced">Avançado</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "A criar..." : "Criar curso e continuar"}
          </Button>
        </form>
      </Card>

      <CornerCardStack>
        {saveIssues && (
          <CornerCard>
            <p className="font-medium text-slate-900 dark:text-white">Falta preencher</p>
            <CornerCardIssueList issues={saveIssues} onIssueClick={focusField} />
          </CornerCard>
        )}
      </CornerCardStack>
    </div>
  );
}
