"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Briefcase, Globe, Link2, Plus, X } from "lucide-react";
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
  const wantsToTeach = searchParams.get("role") === "instrutor";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/register");
      return;
    }
    if (status === "authenticated" && (session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN")) {
      router.replace("/instructor");
    }
  }, [status, session, router]);

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
    router.push("/");
    router.refresh();
  }

  async function handleInstructorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account/become-instructor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

  if (status !== "authenticated" || session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN") {
    return null;
  }

  if (!wantsToTeach) {
    return (
      <AuthLayout title="Quase lá" subtitle="Confirma a tua conta para continuar">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Conta ligada a <strong>{session.user.email}</strong>.
          </p>
          <form onSubmit={handleStudentSubmit} className="mt-4 space-y-4">
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
            <Button type="submit" variant="accent" className="w-full">
              Concluir registo
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
