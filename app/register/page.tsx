"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wantsToTeach, setWantsToTeach] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, wantsToTeach }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao criar conta");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center bg-slate-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
            E
          </span>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Cria a tua conta</h1>
          <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">Começa a aprender ou a ensinar hoje mesmo</p>
        </div>
        <Card className="p-6 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300">
              <input
                type="checkbox"
                checked={wantsToTeach}
                onChange={(e) => setWantsToTeach(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              Quero criar e vender cursos (conta de instrutor)
            </label>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "A criar conta..." : "Criar conta"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Já tens conta?{" "}
            <Link href="/login" className="font-medium text-slate-900 hover:underline dark:text-white">
              Entra
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
