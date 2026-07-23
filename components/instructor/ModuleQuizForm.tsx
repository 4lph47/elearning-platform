"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { QuizQuestionsEditor, newQuestion, type QuestionData } from "@/components/instructor/QuizQuestionsEditor";
import { useFadeNav } from "@/components/course/FadeNavContext";

export interface ModuleQuizFormData {
  id: string;
  title: string;
  timeLimitMinutes: number | null;
  questions: QuestionData[];
}

// Quiz de módulo tem tela própria (não um painel a abrir/fechar como o de
// aula/curso) — pode haver vários por módulo, cada um na sua posição entre
// as aulas (arrastável em ModuleSection.tsx), por isso não faz sentido como
// "o" quiz de alguma coisa com um botão único.
export function ModuleQuizForm({
  courseId,
  moduleId,
  quiz,
}: {
  courseId: string;
  moduleId: string;
  quiz?: ModuleQuizFormData | null;
}) {
  const router = useRouter();
  const { fadeNavigate } = useFadeNav();
  const isEditing = Boolean(quiz);
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    quiz?.timeLimitMinutes != null ? String(quiz.timeLimitMinutes) : ""
  );
  const [questions, setQuestions] = useState<QuestionData[]>(quiz?.questions ?? [newQuestion(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backHref = `/instructor/courses/${courseId}`;

  async function handleSave() {
    setError(null);
    setSaving(true);

    const payload = {
      title,
      timeLimitMinutes: timeLimitMinutes.trim() ? Number(timeLimitMinutes) : null,
      questions: questions.map((q, qi) => ({
        text: q.text,
        order: qi,
        options: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.isCorrect, order: oi })),
      })),
    };

    const url = isEditing ? `/api/instructor/quizzes/${quiz!.id}` : `/api/instructor/modules/${moduleId}/quizzes`;
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar quiz");
      return;
    }

    fadeNavigate(backHref);
    router.refresh();
  }

  async function handleDelete() {
    if (!quiz) return;
    if (!confirm(`Eliminar o quiz "${quiz.title}"?`)) return;
    const res = await fetch(`/api/instructor/quizzes/${quiz.id}`, { method: "DELETE" });
    if (res.ok) {
      fadeNavigate(backHref);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-1 py-10 sm:px-2">
      <Button variant="ghost" onClick={() => fadeNavigate(backHref)}>
        ← Voltar ao curso
      </Button>

      <Card className="space-y-4 p-6">
        <h1 className="text-xl font-bold">{isEditing ? "Editar quiz" : "Novo quiz"}</h1>

        <div>
          <Label htmlFor="quiz-title">Título do quiz</Label>
          <Input id="quiz-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Quiz do módulo" />
        </div>

        <div>
          <Label htmlFor="quiz-time">Tempo limite em minutos (vazio = sem limite)</Label>
          <Input
            id="quiz-time"
            type="number"
            min={1}
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(e.target.value)}
            placeholder="Sem limite"
          />
        </div>

        <QuizQuestionsEditor questions={questions} onChange={setQuestions} />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "A guardar..." : "Guardar quiz"}
          </Button>
          {isEditing && (
            <Button type="button" variant="danger" onClick={handleDelete}>
              Eliminar quiz
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
