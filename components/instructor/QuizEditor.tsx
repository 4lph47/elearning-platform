"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { QuizQuestionsEditor, newQuestion, type QuestionData } from "@/components/instructor/QuizQuestionsEditor";
import type { QuizScope } from "@/lib/quiz";

export interface QuizData {
  id: string;
  title: string;
  maxAttempts?: number | null;
  timeLimitMinutes?: number | null;
  questions: QuestionData[];
}

// Só LESSON/COURSE — quiz de módulo tem tela própria (ModuleQuizForm.tsx),
// não este painel a abrir/fechar (module pode ter vários, não faz sentido
// como "o" quiz do módulo).
function endpointFor(scope: "LESSON" | "COURSE", parentId: string) {
  return scope === "LESSON" ? `/api/instructor/lessons/${parentId}/quiz` : `/api/instructor/courses/${parentId}/quiz`;
}

export function QuizEditor({
  scope,
  parentId,
  label,
  existingQuiz,
}: {
  scope: Extract<QuizScope, "LESSON" | "COURSE">;
  parentId: string;
  label: string;
  existingQuiz?: QuizData | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existingQuiz?.title ?? label);
  const [maxAttempts, setMaxAttempts] = useState(
    existingQuiz?.maxAttempts != null ? String(existingQuiz.maxAttempts) : ""
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(
    existingQuiz?.timeLimitMinutes != null ? String(existingQuiz.timeLimitMinutes) : ""
  );
  const [questions, setQuestions] = useState<QuestionData[]>(existingQuiz?.questions ?? [newQuestion(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);

    const payload = {
      title,
      maxAttempts: maxAttempts.trim() ? Number(maxAttempts) : null,
      timeLimitMinutes: timeLimitMinutes.trim() ? Number(timeLimitMinutes) : null,
      questions: questions.map((q, qi) => ({
        text: q.text,
        order: qi,
        options: q.options.map((o, oi) => ({ text: o.text, isCorrect: o.isCorrect, order: oi })),
      })),
    };

    const res = await fetch(endpointFor(scope, parentId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar quiz");
      return;
    }

    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Eliminar este quiz?")) return;
    const res = await fetch(endpointFor(scope, parentId), { method: "DELETE" });
    if (res.ok) {
      setQuestions([newQuestion(0)]);
      setOpen(false);
      router.refresh();
    }
  }

  // Mesmo visual da row de quiz de módulo (QuizRow.tsx) — só sem o handle de
  // arrastar, já que este quiz (aula/curso) não vive numa lista reordenável.
  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-y-1.5 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <HelpCircle size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="truncate">{existingQuiz ? existingQuiz.title : label}</span>
          {existingQuiz && (
            <Badge>
              {existingQuiz.questions.length} pergunta{existingQuiz.questions.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <button type="button" onClick={() => setOpen(true)} className="text-slate-700 hover:underline dark:text-slate-300">
            {existingQuiz ? "Editar" : "Adicionar"}
          </button>
          {existingQuiz && (
            <button type="button" onClick={handleDelete} className="text-red-600 hover:underline dark:text-red-400">
              Eliminar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div>
        <Label htmlFor={`quiz-title-${parentId}`}>Título do quiz</Label>
        <Input id={`quiz-title-${parentId}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className={scope === "COURSE" ? "grid gap-3 sm:grid-cols-2" : ""}>
        {scope === "COURSE" && (
          <div>
            <Label htmlFor={`quiz-attempts-${parentId}`}>Limite de tentativas (vazio = ilimitado)</Label>
            <Input
              id={`quiz-attempts-${parentId}`}
              type="number"
              min={1}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              placeholder="Ilimitado"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Só o teste final do curso pode limitar tentativas.</p>
          </div>
        )}
        <div>
          <Label htmlFor={`quiz-time-${parentId}`}>Tempo limite em minutos (vazio = sem limite)</Label>
          <Input
            id={`quiz-time-${parentId}`}
            type="number"
            min={1}
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(e.target.value)}
            placeholder="Sem limite"
          />
        </div>
      </div>

      <QuizQuestionsEditor questions={questions} onChange={setQuestions} />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-white/10">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "A guardar..." : "Guardar quiz"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fechar
        </Button>
        {existingQuiz && (
          <Button type="button" variant="danger" onClick={handleDelete}>
            Eliminar quiz
          </Button>
        )}
      </div>
    </div>
  );
}
