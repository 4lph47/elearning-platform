"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card, Badge } from "@/components/ui/Card";
import { QuizEditor, type QuizData } from "@/components/instructor/QuizEditor";

interface CourseData {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  published: boolean;
  slug: string;
  price: number;
  rating: number;
  ratingCount: number;
  quiz?: QuizData | null;
}

export function CourseDetailsForm({ course }: { course: CourseData }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [category, setCategory] = useState(course.category);
  const [level, setLevel] = useState(course.level);
  const [price, setPrice] = useState(String(course.price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(overrides: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/instructor/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, level, price: Number(price) || 0, ...overrides }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Eliminar este curso e todo o seu conteúdo? Esta ação é irreversível.")) return;
    const res = await fetch(`/api/instructor/courses/${course.id}`, { method: "DELETE" });
    if (res.ok) router.push("/instructor");
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Editar curso</h1>
          <Badge tone={course.published ? "success" : "warning"}>
            {course.published ? "Publicado" : "Rascunho"}
          </Badge>
          {course.ratingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Star size={12} className="fill-slate-800 text-slate-800" />
              {course.rating.toFixed(1)} ({course.ratingCount} avaliações)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => save({ published: !course.published })}
            disabled={saving}
          >
            {course.published ? "Despublicar" : "Publicar"}
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="category">Categoria</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="level">Nível</Label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="beginner">Iniciante</option>
              <option value="intermediate">Intermédio</option>
              <option value="advanced">Avançado</option>
            </select>
          </div>
          <div>
            <Label htmlFor="price">Preço (€, 0 = grátis)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "A guardar..." : "Guardar alterações"}
        </Button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <QuizEditor scope="COURSE" parentId={course.id} label="Quiz final do curso" existingQuiz={course.quiz} />
      </div>
    </Card>
  );
}
