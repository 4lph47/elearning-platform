"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { QuizScope } from "@/lib/quiz";

interface OptionData {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuestionData {
  id: string;
  text: string;
  order: number;
  options: OptionData[];
}

export interface QuizData {
  id: string;
  title: string;
  maxAttempts?: number | null;
  timeLimitMinutes?: number | null;
  questions: QuestionData[];
}

function newOption(order: number): OptionData {
  return { id: crypto.randomUUID(), text: "", isCorrect: order === 0, order };
}

function newQuestion(order: number): QuestionData {
  return {
    id: crypto.randomUUID(),
    text: "",
    order,
    options: [newOption(0), newOption(1)],
  };
}

function endpointFor(scope: QuizScope, parentId: string) {
  if (scope === "LESSON") return `/api/instructor/lessons/${parentId}/quiz`;
  if (scope === "MODULE") return `/api/instructor/modules/${parentId}/quiz`;
  return `/api/instructor/courses/${parentId}/quiz`;
}

export function QuizEditor({
  scope,
  parentId,
  label,
  existingQuiz,
}: {
  scope: QuizScope;
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

  function updateQuestionText(qid: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, text } : q)));
  }

  function updateOptionText(qid: string, oid: string, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)) } : q
      )
    );
  }

  function setCorrectOption(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.id === oid })) } : q
      )
    );
  }

  function addOption(qid: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, options: [...q.options, newOption(q.options.length)] } : q))
    );
  }

  function removeOption(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, options: q.options.filter((o) => o.id !== oid) } : q))
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion(prev.length)]);
  }

  function removeQuestion(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
  }

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        <HelpCircle size={14} />
        {existingQuiz ? `${label} (${existingQuiz.questions.length} perguntas)` : `+ ${label}`}
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-300 bg-slate-50 p-3">
      <div>
        <Label htmlFor={`quiz-title-${parentId}`}>Título do quiz</Label>
        <Input id={`quiz-title-${parentId}`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className={scope === "COURSE" ? "grid grid-cols-2 gap-3" : ""}>
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
            <p className="mt-1 text-xs text-slate-400">Só o teste final do curso pode limitar tentativas.</p>
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

      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">#{qi + 1}</span>
              <Input
                value={q.text}
                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                placeholder="Texto da pergunta"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-red-600 hover:text-red-700"
                aria-label="Remover pergunta"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="space-y-1.5 pl-4">
              {q.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={o.isCorrect}
                    onChange={() => setCorrectOption(q.id, o.id)}
                    className="text-slate-900 focus:ring-slate-500"
                  />
                  <Input
                    value={o.text}
                    onChange={(e) => updateOptionText(q.id, o.id, e.target.value)}
                    placeholder="Opção"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(q.id, o.id)}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remover opção"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(q.id)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
              >
                <Plus size={12} /> Opção
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        <Plus size={14} /> Pergunta
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-t border-slate-200 pt-3">
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
