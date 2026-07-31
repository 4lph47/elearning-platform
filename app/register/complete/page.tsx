"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AtSign, Briefcase, Globe, Link2, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SOCIAL_PLATFORMS, matchesPlatformDomain, type SocialPlatformKey } from "@/lib/socialPlatforms";

interface CertificationInput {
  name: string;
  url: string;
}

const EMPTY_SOCIALS = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, ""])) as Record<SocialPlatformKey, string>;

export default function RegisterCompletePage() {
  return (
    <Suspense>
      <CompleteForm />
    </Suspense>
  );
}

function CompleteForm() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const wantsToTeach = roleParam === "instrutor";
  // Sem role na query = veio do /login (Google/link mágico sem passar por
  // /register) — só aí faz sentido completar sozinho. Vindo do /register
  // com role=aluno explícito, a pessoa quer preencher o formulário (pelo
  // menos o username), tal como o instrutor já fazia.
  const isSilentAutoRegister = roleParam === null;
  const resyncedRef = useRef(false);
  const usernamePrefilledRef = useRef(false);
  const autoCompletedRef = useRef(false);
  const [autoCompleteFailed, setAutoCompleteFailed] = useState(false);

  // O JWT só é reavaliado contra a BD no login ou quando update() é chamado
  // — se `registered` mudou entretanto por fora (ex.: backfill direto na
  // BD), a sessão já aberta continuava presa aqui com o valor antigo até
  // se voltar a fazer login. Uma sincronização única ao abrir esta página
  // evita ficar preso sem precisar de sair e entrar de novo.
  useEffect(() => {
    if (status === "authenticated" && !session.user.registered && !resyncedRef.current) {
      resyncedRef.current = true;
      update();
    }
  }, [status, session, update]);

  useEffect(() => {
    if (status === "authenticated" && session.user.username && !usernamePrefilledRef.current) {
      usernamePrefilledRef.current = true;
      setUsername(session.user.username);
    }
  }, [status, session]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/register");
      return;
    }
    if (status !== "authenticated") return;
    if (session.user.registered) {
      router.replace(session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN" ? "/instructor" : "/");
      return;
    }
    if (session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN") {
      router.replace("/instructor");
    }
  }, [status, session, router]);

  // Google/link mágico vindo direto do /login (sem role na query): o botão
  // já tem o aviso de termos por baixo (ver /login) e o username veio
  // automático do events.createUser — pedir pra confirmar os dois outra vez
  // só duplicava um clique que a pessoa já deu. Vindo do /register (role
  // sempre presente), a pessoa escolheu ativamente preencher o formulário,
  // por isso nunca entra aqui — aluno confirma username, instrutor continua
  // a preencher bio/especialização como já fazia.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (session.user.registered || session.user.hasPassword || !isSilentAutoRegister) return;
    if (!session.user.username || autoCompletedRef.current) return;
    autoCompletedRef.current = true;
    (async () => {
      const res = await fetch("/api/account/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: session.user.username, acceptedTerms: true }),
      });
      if (!res.ok) {
        // Não devia acontecer com um username gerado automaticamente, mas
        // se colidir por algum motivo cai no formulário normal em vez de
        // deixar a pessoa presa num ecrã em branco.
        setAutoCompleteFailed(true);
        return;
      }
      await update();
      // router.replace()+router.refresh() disparados de dentro de um efeito
      // (sem o "tick" que um clique dá) competiam entre si -- a navegação
      // ficava a meio, header (layout partilhado) atualizado mas o corpo da
      // página preso na versão anterior até um F5 manual. Navegação a sério
      // evita a categoria toda de corrida do router, sempre re-renderiza
      // certo à primeira.
      window.location.href = "/";
    })();
  }, [status, session, wantsToTeach, update]);

  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [socialValues, setSocialValues] = useState<Record<SocialPlatformKey, string>>(EMPTY_SOCIALS);
  const [activeSocialKeys, setActiveSocialKeys] = useState<SocialPlatformKey[]>([]);
  const [certifications, setCertifications] = useState<CertificationInput[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addSocialPlatform(key: SocialPlatformKey) {
    setActiveSocialKeys((prev) => [...prev, key]);
  }

  function removeSocialPlatform(key: SocialPlatformKey) {
    setActiveSocialKeys((prev) => prev.filter((k) => k !== key));
    setSocialValues((prev) => ({ ...prev, [key]: "" }));
  }

  function addCertification() {
    setCertifications((prev) => [...prev, { name: "", url: "" }]);
  }

  function updateCertification(index: number, field: keyof CertificationInput, value: string) {
    setCertifications((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function removeCertification(index: number) {
    setCertifications((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStudentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account/complete-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, acceptedTerms }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao concluir registo");
      setLoading(false);
      return;
    }

    await update();
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Código inválido");
      setLoading(false);
      return;
    }

    await update();
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  async function handleResendCode() {
    setError(null);
    setResending(true);
    const res = await fetch("/api/account/resend-verification-email", { method: "POST" });
    setResending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao reenviar código");
      return;
    }
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  }

  async function handleInstructorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account/become-instructor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        acceptedTerms,
        bio,
        expertise,
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        ...socialValues,
        certifications: certifications
          .map((c) => ({ name: c.name.trim(), url: c.url.trim() }))
          .filter((c) => c.name || c.url),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao completar registo");
      setLoading(false);
      return;
    }

    await update();
    setLoading(false);
    router.push("/instructor");
    router.refresh();
  }

  if (status !== "authenticated" || session.user.registered) {
    return null;
  }

  // Google/link mágico direto do /login fica só um instante aqui — o
  // efeito acima já submeteu o registo em silêncio, nunca chega a
  // renderizar o formulário de username/termos.
  if (!session.user.hasPassword && isSilentAutoRegister && !autoCompleteFailed) {
    return null;
  }

  // Conta por password (independentemente de ser aluno ou instrutor — o
  // role já ficou definido no /register) só falta confirmar o código
  // enviado por email; Google/link mágico já prova dono do email sozinho,
  // por isso nunca cai aqui.
  if (session.user.hasPassword) {
    return (
      <AuthLayout title="Confirma o teu email" subtitle="Enviámos um código de 6 dígitos para o teu email">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enviámos um código para <strong>{session.user.email}</strong>.
          </p>
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Código de verificação
              </label>
              <input
                id="code"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-lg font-semibold tracking-[0.3em] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
              />
            </div>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            {resent && <p className="text-sm text-emerald-600 dark:text-emerald-400">Novo código enviado.</p>}
            <Button type="submit" variant="accent" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? "A confirmar..." : "Confirmar"}
            </Button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resending}
              className="flex w-full items-center justify-center gap-1.5 text-center text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
            >
              {resending && <Loader2 size={13} className="animate-spin" />} Reenviar código
            </button>
          </form>
        </div>
      </AuthLayout>
    );
  }

  if (!wantsToTeach) {
    return (
      <AuthLayout title="Quase lá" subtitle="Confirma a tua conta para continuar">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Conta ligada a <strong>{session.user.email}</strong>.
          </p>
          <form onSubmit={handleStudentSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Username
              </label>
              <div className="relative">
                <AtSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="username"
                  required
                  pattern="[a-z][a-z0-9_]{2,19}"
                  title="3-20 caracteres: letras minúsculas, números e _, a começar por letra"
                  placeholder="ex: joao_silva"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Concordo com os Termos e Serviços e a Política de Privacidade</span>
            </label>
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            <Button type="submit" variant="accent" className="w-full" disabled={loading}>
              {loading ? "A concluir..." : "Concluir registo"}
            </Button>
          </form>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide title="Completa o teu perfil de instrutor" subtitle="Falta só isto para começares a criar cursos">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Conta ligada a <strong>{session.user.email}</strong>.
        </p>
        <form onSubmit={handleInstructorSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Username
            </label>
            <div className="relative max-w-xs">
              <AtSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                id="username"
                required
                pattern="[a-z][a-z0-9_]{2,19}"
                title="3-20 caracteres: letras minúsculas, números e _, a começar por letra"
                placeholder="ex: joao_silva"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
              />
            </div>
          </div>
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conta-nos um pouco sobre ti — isto ajuda os alunos a confiarem nos teus cursos.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  A tua experiência
                </label>
                <Textarea
                  id="bio"
                  required
                  minLength={50}
                  rows={5}
                  placeholder="Ex: Sou engenheiro de software há 8 anos, especializado em..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="expertise" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Área de especialização
                  </label>
                  <div className="relative">
                    <Briefcase size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="expertise"
                      required
                      placeholder="Ex: Desenvolvimento Web"
                      value={expertise}
                      onChange={(e) => setExpertise(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="yearsExperience" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Anos de experiência
                  </label>
                  <input
                    id="yearsExperience"
                    type="number"
                    required
                    min={0}
                    max={80}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
            <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Redes sociais e site <span className="font-normal text-slate-400">(opcional)</span>
                </p>
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.filter((p) => activeSocialKeys.includes(p.key)).map((p) => {
                    const value = socialValues[p.key];
                    const domainError = value.trim() && !matchesPlatformDomain(p, value.trim());
                    return (
                      <div key={p.key}>
                        <div className="flex items-center gap-2">
                          <div className="relative min-w-0 flex-1">
                            {p.key === "websiteUrl" ? (
                              <Globe size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            ) : (
                              <Link2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            )}
                            <input
                              value={value}
                              onChange={(e) => setSocialValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                              placeholder={p.placeholder}
                              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                            />
                          </div>
                          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{p.label}</span>
                          <button
                            type="button"
                            onClick={() => removeSocialPlatform(p.key)}
                            aria-label={`Remover ${p.label}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        {domainError && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Não parece um link do {p.label}</p>}
                      </div>
                    );
                  })}
                  {SOCIAL_PLATFORMS.filter((p) => !activeSocialKeys.includes(p.key)).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SOCIAL_PLATFORMS.filter((p) => !activeSocialKeys.includes(p.key)).map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => addSocialPlatform(p.key)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          + {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Certificações <span className="font-normal text-slate-400">(opcional)</span>
                </p>
                <div className="space-y-2">
                  {certifications.map((cert, i) => (
                    <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={cert.name}
                        onChange={(e) => updateCertification(i, "name", e.target.value)}
                        placeholder="Ex.: CompTIA Security+"
                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                      />
                      <input
                        value={cert.url}
                        onChange={(e) => updateCertification(i, "url", e.target.value)}
                        placeholder="Link de verificação"
                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeCertification(i)}
                        aria-label="Remover certificação"
                        className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200 sm:self-center"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCertification}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    <Plus size={13} /> Adicionar certificação
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Concordo com os Termos e Serviços e a Política de Privacidade</span>
          </label>

          <Button type="submit" variant="accent" className="w-full" disabled={loading}>
            {loading ? "A concluir..." : "Concluir registo"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
