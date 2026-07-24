"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou password inválidos");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("email", { email, callbackUrl, redirect: false });

    setLoading(false);

    if (result?.error) {
      setError("Não foi possível enviar o link. Tenta novamente.");
      return;
    }

    setMagicLinkSent(true);
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entra na tua conta para continuar a aprender"
      footer={
        <>
          Ainda não tens conta?{" "}
          <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
            Regista-te
          </Link>
        </>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <GoogleIcon /> Continuar com Google
          </button>
          <button
            type="button"
            onClick={() => signIn("github", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <GitHubIcon /> Continuar com GitHub
          </button>
          <button
            type="button"
            onClick={() => signIn("azure-ad", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <MicrosoftIcon /> Continuar com Microsoft
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="text-xs text-slate-400 dark:text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        {magicLinkMode ? (
          magicLinkSent ? (
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Enviámos um link de acesso para <strong>{email}</strong>. Verifica a tua caixa de entrada.
            </p>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
              <div>
                <label htmlFor="magic-email" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="magic-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
              <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                {loading ? "A enviar..." : "Enviar link de acesso"}
              </Button>
              <button
                type="button"
                onClick={() => { setMagicLinkMode(false); setError(null); }}
                className="w-full text-center text-sm text-slate-500 hover:underline dark:text-slate-400"
              >
                Voltar ao login com password
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
              <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                {loading ? "A entrar..." : (
                  <>
                    Entrar <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => { setMagicLinkMode(true); setError(null); }}
              className="mt-3 w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Entrar sem password (link mágico)
            </button>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
        Demo: instrutor@example.com / aluno@example.com — password: password123
      </p>
    </AuthLayout>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.29v3.1C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 010-4.58v-3.1H1.29a12 12 0 000 10.78z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l4 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.53.12-3.19 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.89.12 3.19.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}
