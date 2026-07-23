"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";

export interface OptionData {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface QuestionData {
  id: string;
  text: string;
  order: number;
  options: OptionData[];
}

export function newOption(order: number): OptionData {
  return { id: crypto.randomUUID(), text: "", isCorrect: order === 0, order };
}

export function newQuestion(order: number): QuestionData {
  return {
    id: crypto.randomUUID(),
    text: "",
    order,
    options: [newOption(0), newOption(1)],
  };
}

// Edição de perguntas/opções partilhada entre o QuizEditor (quiz de
// aula/curso, painel a abrir) e ModuleQuizForm (quiz de módulo, tela própria)
// — mesma lógica, dois lugares diferentes a chamá-la.
export function QuizQuestionsEditor({
  questions,
  onChange,
}: {
  questions: QuestionData[];
  onChange: Dispatch<SetStateAction<QuestionData[]>>;
}) {
  function updateQuestionText(qid: string, text: string) {
    onChange((prev) => prev.map((q) => (q.id === qid ? { ...q, text } : q)));
  }

  function updateOptionText(qid: string, oid: string, text: string) {
    onChange((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)) } : q
      )
    );
  }

  function setCorrectOption(qid: string, oid: string) {
    onChange((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.id === oid })) } : q
      )
    );
  }

  function addOption(qid: string) {
    onChange((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, options: [...q.options, newOption(q.options.length)] } : q))
    );
  }

  function removeOption(qid: string, oid: string) {
    onChange((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, options: q.options.filter((o) => o.id !== oid) } : q))
    );
  }

  function addQuestion() {
    onChange((prev) => [...prev, newQuestion(prev.length)]);
  }

  function removeQuestion(qid: string) {
    onChange((prev) => prev.filter((q) => q.id !== qid));
  }

  return (
    <>
      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div key={q.id} className="rounded-md border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">#{qi + 1}</span>
              <Input
                value={q.text}
                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                placeholder="Texto da pergunta"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(q.id, o.id)}
                    className="text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                    aria-label="Remover opção"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(q.id)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
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
        className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        <Plus size={14} /> Pergunta
      </button>
    </>
  );
}
