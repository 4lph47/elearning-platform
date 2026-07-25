"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { User, AtSign, Mail, Lock, Briefcase, Link2, ArrowRight, GraduationCap, ArrowLeft, Globe, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FadeLink } from "@/components/course/FadeLink";
import { SOCIAL_PLATFORMS, matchesPlatformDomain, type SocialPlatformKey } from "@/lib/socialPlatforms";

interface CertificationInput {
  name: string;
  url: string;
}

const EMPTY_SOCIALS = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, ""])) as Record<SocialPlatformKey, string>;

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();

  // Mesmo caso do /login: já autenticado (voltou atrás, ou link direto
  // com sessão antiga) ficava preso no formulário, só a navbar é que
  // mostrava o perfil.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  const [role, setRole] = useState<"aluno" | "instrutor" | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const wantsToTeach = role === "instrutor";
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [socialValues, setSocialValues] = useState<Record<SocialPlatformKey, string>>(EMPTY_SOCIALS);
  const [activeSocialKeys, setActiveSocialKeys] = useState<SocialPlatformKey[]>([]);
  const [certifications, setCertifications] = useState<CertificationInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Só o formulário de instrutor (bem mais longo) usa isto — passos
  // visíveis um de cada vez só a partir do lg; abaixo disso continua tudo
  // empilhado na mesma página, scroll normal.
  const STEP_LABELS = ["Conta", "Perfil", "Redes & Certificações"];
  const [step, setStep] = useState(0);

  function validateStep(idx: number): string | null {
    if (idx === 0) {
      if (name.trim().length < 2) return "Nome deve ter pelo menos 2 caracteres";
      if (!/^[a-z][a-z0-9_]{2,19}$/.test(username.trim().toLowerCase()))
        return "Username deve ter 3-20 caracteres (letras minúsculas, números e _), a começar por letra";
      if (!email.trim()) return "Indica o teu email";
      if (password.length < 6) return "A password deve ter pelo menos 6 caracteres";
      if (password !== confirmPassword) return "As passwords não coincidem";
      return null;
    }
    if (idx === 1) {
      if (bio.trim().length < 50) return "Conta-nos a tua experiência com pelo menos 50 caracteres";
      if (expertise.trim().length < 2) return "Indica a tua área de especialização";
      if (yearsExperience === "") return "Indica os teus anos de experiência";
      return null;
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goPrev() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  // Desktop: só a secção do passo atual fica visível (lg:hidden nas
  // outras). Mobile ignora step de todo — tudo continua sempre visível,
  // como já estava.
  function stepClass(idx: number) {
    if (!wantsToTeach) return "";
    return step === idx ? "" : "lg:hidden";
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As passwords não coincidem");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        username,
        email,
        password,
        wantsToTeach,
        acceptedTerms,
        ...(wantsToTeach
          ? {
              bio,
              expertise,
              yearsExperience: yearsExperience ? Number(yearsExperience) : null,
              ...socialValues,
              certifications: certifications
                .map((c) => ({ name: c.name.trim(), url: c.url.trim() }))
                .filter((c) => c.name || c.url),
            }
          : {}),
      }),
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

  if (status === "authenticated") return null;

  if (!role) {
    return (
      <AuthLayout
        title="Cria a tua conta"
        subtitle="Como queres usar a plataforma?"
        footer={
          <>
            Já tens conta?{" "}
            <FadeLink href="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
              Entra
            </FadeLink>
          </>
        }
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setRole("aluno")}
            className="flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-500 hover:shadow-md dark:border-white/10 dark:bg-neutral-900 dark:hover:border-blue-500"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <GraduationCap size={20} />
            </span>
            <span>
              <span className="block font-medium text-slate-900 dark:text-white">Quero aprender</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">Criar uma conta de aluno para me inscrever em cursos</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setRole("instrutor"); setStep(0); }}
            className="flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-500 hover:shadow-md dark:border-white/10 dark:bg-neutral-900 dark:hover:border-blue-500"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Briefcase size={20} />
            </span>
            <span>
              <span className="block font-medium text-slate-900 dark:text-white">Quero ensinar</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">Criar uma conta de instrutor para criar e vender cursos</span>
            </span>
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      wide={wantsToTeach}
      title={wantsToTeach ? "Cria a tua conta de instrutor" : "Cria a tua conta de aluno"}
      subtitle="Começa a aprender ou a ensinar hoje mesmo"
      footer={
        <>
          Já tens conta?{" "}
          <FadeLink href="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
            Entra
          </FadeLink>
        </>
      }
    >
      <button
        type="button"
        onClick={() => { setRole(null); setStep(0); }}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
        {wantsToTeach && (
          <ol className="mb-6 hidden items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 lg:flex">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                    step === i
                      ? "border-blue-600 bg-blue-600 text-white"
                      : step > i
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "border-slate-300 text-slate-400 dark:border-white/20 dark:text-slate-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={step === i ? "text-slate-900 dark:text-white" : ""}>{label}</span>
                {i < STEP_LABELS.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200 dark:bg-white/10" />}
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={stepClass(0)}>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: `/register/complete?role=${role}` })}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <GoogleIcon /> Continuar com Google
            </button>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <span className="text-xs text-slate-400 dark:text-slate-500">ou preenche os dados</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>
          </div>
          <div className={`${wantsToTeach ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" : "space-y-4"} ${stepClass(0)}`}>
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Nome
              </label>
              <div className="relative">
                <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                />
              </div>
            </div>
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Confirmar password
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">As passwords não coincidem</p>
              )}
            </div>
          </div>

          {wantsToTeach && (
            <div className={`rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5 ${stepClass(1)}`}>
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
          )}

          {wantsToTeach && (
            <div className={`rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5 ${stepClass(2)}`}>
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
          )}

          {wantsToTeach && (
            <div className="hidden items-center justify-between lg:flex">
              <button
                type="button"
                onClick={goPrev}
                disabled={step === 0}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <ArrowLeft size={14} /> Anterior
              </button>
              {step < STEP_LABELS.length - 1 && (
                <button
                  type="button"
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Seguinte <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <div className={stepClass(2)}>
          <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              Concordo com os{" "}
              <Link href="/termos" target="_blank" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                Termos e Serviços
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                Política de Privacidade
              </Link>
            </span>
          </label>

          <Button type="submit" variant="accent" className="w-full" disabled={loading}>
            {loading ? "A criar conta..." : (
              <>
                Criar conta <ArrowRight size={16} />
              </>
            )}
          </Button>
          </div>
        </form>
      </div>
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
