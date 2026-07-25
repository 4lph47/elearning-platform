"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { User, Mail, Lock, Briefcase, Link2, ArrowRight, GraduationCap, ArrowLeft, Globe, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { AuthLayout } from "@/components/auth/AuthLayout";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
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
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
              Entra
            </Link>
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
            onClick={() => setRole("instrutor")}
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
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
            Entra
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={() => setRole(null)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} /> Voltar
      </button>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={wantsToTeach ? "grid grid-cols-1 gap-4 sm:grid-cols-3" : "space-y-4"}>
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
          </div>

          {wantsToTeach && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Conta-nos um pouco sobre ti — isto ajuda os alunos a confiarem nos teus cursos.
              </p>

              <div className="mt-4 grid gap-x-6 gap-y-4 lg:grid-cols-2">
                <div className="space-y-4">
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

                <div className="space-y-4">
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
            </div>
          )}

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

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={loading}>
            {loading ? "A criar conta..." : (
              <>
                Criar conta <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
