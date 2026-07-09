"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function QuizPlayer({
  quizId,
  title,
  questions,
  maxAttempts,
  timeLimitMinutes,
  attemptsUsed = 0,
}: {
  quizId: string;
  title: string;
  questions: QuizQuestion[];
  maxAttempts?: number | null;
  timeLimitMinutes?: number | null;
  attemptsUsed?: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ scorePercent: number; correctOptionByQuestion: Record<string, string> } | null>(
    null
  );
  const [attemptsSoFar, setAttemptsSoFar] = useState(attemptsUsed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    timeLimitMinutes ? timeLimitMinutes * 60 : null
  );
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const outOfAttempts = maxAttempts != null && attemptsSoFar >= maxAttempts;
  const allAnswered = questions.every((q) => answers[q.id]);

  useEffect(() => {
    if (secondsLeft === null || result || outOfAttempts) return;
    if (secondsLeft <= 0) {
      submit(answersRef.current);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, outOfAttempts]);

  async function submit(finalAnswers: Record<string, string>) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/quiz/${quizId}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: finalAnswers }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao submeter quiz");
      return;
    }
    setResult(data);
    setAttemptsSoFar((n) => n + 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered) return;
    submit(answers);
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setSecondsLeft(timeLimitMinutes ? timeLimitMinutes * 60 : null);
  }

  if (outOfAttempts && !result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-500">
          Já usaste todas as tentativas disponíveis para este quiz ({maxAttempts}).
        </p>
      </div>
    );
  }

  const canRetry = !result ? false : maxAttempts == null || attemptsSoFar < maxAttempts;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {secondsLeft !== null && !result && (
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              secondsLeft <= 30 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            <Clock size={12} />
            {formatClock(secondsLeft)}
          </span>
        )}
      </div>
      {maxAttempts != null && (
        <p className="mt-1 text-xs text-slate-400">
          Tentativa {attemptsSoFar + (result ? 0 : 1)} de {maxAttempts}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-md bg-slate-100 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">
            Nota: {result.scorePercent}% ({Math.round((result.scorePercent / 100) * questions.length)}/
            {questions.length} corretas)
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {questions.map((q, qi) => {
          const correctOptionId = result?.correctOptionByQuestion[q.id];
          return (
            <div key={q.id}>
              <p className="mb-2 text-sm font-medium text-slate-800">
                {qi + 1}. {q.text}
              </p>
              <div className="space-y-1.5">
                {q.options.map((o) => {
                  const isSelected = answers[q.id] === o.id;
                  const isCorrect = result && o.id === correctOptionId;
                  const isWrongSelected = result && isSelected && o.id !== correctOptionId;
                  return (
                    <label
                      key={o.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        isCorrect
                          ? "border-slate-800 bg-slate-50"
                          : isWrongSelected
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200"
                      } ${!result ? "cursor-pointer hover:bg-slate-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`quiz-${quizId}-${q.id}`}
                        checked={isSelected}
                        disabled={Boolean(result)}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                        className="text-slate-900 focus:ring-slate-500"
                      />
                      <span className="flex-1">{o.text}</span>
                      {isCorrect && <Check size={16} className="text-slate-700" />}
                      {isWrongSelected && <X size={16} className="text-red-600" />}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!result ? (
          <Button type="submit" disabled={!allAnswered || loading}>
            {loading ? "A submeter..." : "Submeter respostas"}
          </Button>
        ) : canRetry ? (
          <Button type="button" variant="outline" onClick={retry}>
            Tentar novamente
          </Button>
        ) : (
          maxAttempts != null && <p className="text-xs text-slate-400">Sem mais tentativas disponíveis.</p>
        )}
      </form>
    </div>
  );
}
