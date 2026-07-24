"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, Clock, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { textBoxFromElement } from "@/components/course/CardTransitionContext";
import { useTextFly } from "@/components/course/TextFlyContext";

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

function formatCooldown(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function QuizPlayer({
  quizId,
  title,
  questions,
  scope = "LESSON",
  maxAttempts,
  timeLimitMinutes,
  showCountdown = false,
  retryAfterHours,
  nextAvailableAt,
  attemptsUsed = 0,
}: {
  quizId: string;
  title: string;
  questions: QuizQuestion[];
  scope?: "LESSON" | "MODULE" | "COURSE";
  maxAttempts?: number | null;
  timeLimitMinutes?: number | null;
  showCountdown?: boolean;
  retryAfterHours?: number | null;
  nextAvailableAt?: string | null;
  attemptsUsed?: number;
}) {
  const isFinal = scope === "COURSE";
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ scorePercent: number; correctOptionByQuestion: Record<string, string> } | null>(
    null
  );
  const [attemptsSoFar, setAttemptsSoFar] = useState(attemptsUsed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(
    nextAvailableAt ? new Date(nextAvailableAt).getTime() : null
  );
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    timeLimitMinutes ? timeLimitMinutes * 60 : null
  );
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (cooldownUntil === null) {
      setCooldownSecondsLeft(null);
      return;
    }
    const tick = () => {
      const secs = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setCooldownSecondsLeft(secs > 0 ? secs : 0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownActive = Boolean(cooldownSecondsLeft && cooldownSecondsLeft > 0);
  const showClock = isFinal || showCountdown;

  // Recebe o título a voar de um link de quiz clicado (currículo/progresso) —
  // mesmo padrão de LessonTitleHeading.tsx.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { state: textFlyState, arrive: arriveTitleFly } = useTextFly();
  const titleFlyPending = textFlyState?.id === quizId && !textFlyState.arrived;
  const titleHidden = textFlyState?.id === quizId && !textFlyState.revealed;

  useEffect(() => {
    if (!titleFlyPending || !titleRef.current) return;
    arriveTitleFly(quizId, textBoxFromElement(titleRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleFlyPending, quizId]);

  const outOfAttempts = maxAttempts != null && attemptsSoFar >= maxAttempts;
  const allAnswered = questions.every((q) => answers[q.id]);
  const waitingForConsent = isFinal && !consented && !result;

  useEffect(() => {
    if (secondsLeft === null || result || outOfAttempts || waitingForConsent) return;
    if (secondsLeft <= 0) {
      submit(answersRef.current);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, outOfAttempts, waitingForConsent]);

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
      if (data.nextAvailableAt) setCooldownUntil(new Date(data.nextAvailableAt).getTime());
      return;
    }
    setResult(data);
    setAttemptsSoFar((n) => n + 1);
    if (retryAfterHours) setCooldownUntil(Date.now() + retryAfterHours * 60 * 60 * 1000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered) return;
    submit(answers);
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setConsented(false);
    setSecondsLeft(timeLimitMinutes ? timeLimitMinutes * 60 : null);
  }

  if (outOfAttempts && !result) {
    return (
      <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-neutral-900">
        <h2
          ref={titleRef}
          style={{ visibility: titleHidden ? "hidden" : "visible" }}
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          {title}
        </h2>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Já usaste todas as tentativas disponíveis para este quiz ({maxAttempts}).
        </p>
      </div>
    );
  }

  if (cooldownActive && !result) {
    return (
      <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Hourglass size={16} />
          <p>
            Tens de esperar mais <strong>{formatCooldown(cooldownSecondsLeft ?? 0)}</strong> antes de poderes repetir
            este quiz.
          </p>
        </div>
      </div>
    );
  }

  const canRetry = !result ? false : (maxAttempts == null || attemptsSoFar < maxAttempts) && !cooldownActive;

  if (waitingForConsent) {
    return (
      <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-neutral-900">
        <h2
          ref={titleRef}
          style={{ visibility: titleHidden ? "hidden" : "visible" }}
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          {title}
        </h2>
        <div className="mt-3 space-y-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-medium">Este é o teste final do curso.</p>
          <ul className="list-disc space-y-1 pl-4">
            {timeLimitMinutes != null && (
              <li>
                Tens um tempo limite de <strong>{timeLimitMinutes} minutos</strong> para o completar. Ao esgotar-se,
                as respostas atuais são submetidas automaticamente.
              </li>
            )}
            {retryAfterHours != null && (
              <li>
                Só poderás voltar a repetir o teste <strong>{retryAfterHours} horas</strong> depois de o submeteres.
              </li>
            )}
            {maxAttempts != null && (
              <li>
                Tens no máximo <strong>{maxAttempts}</strong> tentativa{maxAttempts !== 1 ? "s" : ""}.
              </li>
            )}
          </ul>
        </div>
        <Button type="button" variant="accent" className="mt-4" onClick={() => setConsented(true)}>
          Começar teste
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <h2
          ref={titleRef}
          style={{ visibility: titleHidden ? "hidden" : "visible" }}
          className="min-w-0 flex-1 break-words text-lg font-semibold text-slate-900 dark:text-white"
        >
          {title}
        </h2>
        {showClock && secondsLeft !== null && !result && (
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              secondsLeft <= 30
                ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <Clock size={12} />
            {formatClock(secondsLeft)}
          </span>
        )}
      </div>
      {maxAttempts != null && (
        <p className="mt-1 text-xs text-slate-500">
          Tentativa {attemptsSoFar + (result ? 0 : 1)} de {maxAttempts}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-md bg-slate-100 px-4 py-3 dark:bg-slate-800/60">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
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
              <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-100">
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
                      className={`flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm text-slate-700 dark:text-slate-200 ${
                        isCorrect
                          ? "border-blue-500 bg-blue-600/10"
                          : isWrongSelected
                            ? "border-red-500/50 bg-red-100 dark:bg-red-950/30"
                            : "border-slate-200 dark:border-white/10"
                      } ${!result ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`quiz-${quizId}-${q.id}`}
                        checked={isSelected}
                        disabled={Boolean(result)}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                        className="accent-blue-600"
                      />
                      <span className="min-w-0 flex-1 break-words">{o.text}</span>
                      {isCorrect && <Check size={16} className="text-blue-400" />}
                      {isWrongSelected && <X size={16} className="text-red-400" />}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {!result ? (
          <Button type="submit" variant="accent" disabled={!allAnswered || loading}>
            {loading ? "A submeter..." : "Submeter respostas"}
          </Button>
        ) : canRetry ? (
          <Button type="button" variant="outline-dark" onClick={retry}>
            Tentar novamente
          </Button>
        ) : cooldownActive ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Hourglass size={12} />
            Podes repetir daqui a {formatCooldown(cooldownSecondsLeft ?? 0)}.
          </p>
        ) : (
          maxAttempts != null && <p className="text-xs text-slate-500">Sem mais tentativas disponíveis.</p>
        )}
      </form>
    </div>
  );
}
