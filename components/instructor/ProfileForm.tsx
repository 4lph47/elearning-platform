"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, Input } from "@/components/ui/Input";
import { SOCIAL_PLATFORMS, matchesPlatformDomain, type SocialPlatformKey } from "@/lib/socialPlatforms";

interface CertificationInput {
  name: string;
  url: string;
}

export function ProfileForm({
  initialBio,
  initialValues,
  initialCertifications,
}: {
  initialBio: string;
  initialValues: Record<SocialPlatformKey, string | null | undefined>;
  initialCertifications: CertificationInput[];
}) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [values, setValues] = useState<Record<SocialPlatformKey, string>>(() =>
    Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, initialValues[p.key] ?? ""])) as Record<
      SocialPlatformKey,
      string
    >
  );
  // Só entram pré-selecionadas as plataformas que já têm link guardado — um
  // perfil novo começa sem nenhuma, o instrutor é que escolhe quais adicionar.
  const [activeKeys, setActiveKeys] = useState<SocialPlatformKey[]>(
    SOCIAL_PLATFORMS.map((p) => p.key).filter((k) => (initialValues[k] ?? "").trim() !== "")
  );
  // Certificações (CompTIA, Cisco, AWS, etc.) não têm um domínio fixo como as
  // redes sociais — lista livre (nome + link), o instrutor escreve qual quiser.
  const [certifications, setCertifications] = useState<CertificationInput[]>(
    initialCertifications.length > 0 ? initialCertifications : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addPlatform(key: SocialPlatformKey) {
    setActiveKeys((prev) => [...prev, key]);
  }

  function removePlatform(key: SocialPlatformKey) {
    setActiveKeys((prev) => prev.filter((k) => k !== key));
    setValues((prev) => ({ ...prev, [key]: "" }));
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/instructor/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio,
        ...values,
        certifications: certifications
          .map((c) => ({ name: c.name.trim(), url: c.url.trim() }))
          .filter((c) => c.name || c.url),
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  const inactivePlatforms = SOCIAL_PLATFORMS.filter((p) => !activeKeys.includes(p.key));

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <Label htmlFor="bio">Bio pública</Label>
        <Textarea
          id="bio"
          rows={4}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conta um pouco sobre a tua experiência e o que ensinas..."
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{bio.length}/600</p>
      </div>

      {SOCIAL_PLATFORMS.filter((p) => activeKeys.includes(p.key)).map((p) => {
        const value = values[p.key];
        // Aviso em tempo real (não bloqueia digitar) — o link só precisa de
        // bater com o domínio da própria plataforma para ser aceite ao guardar.
        const domainError = value.trim() && !matchesPlatformDomain(p, value.trim());
        return (
          <div key={p.key}>
            <div className="flex items-center justify-between">
              <Label htmlFor={p.key}>{p.label}</Label>
              <button
                type="button"
                onClick={() => removePlatform(p.key)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                remover
              </button>
            </div>
            <Input
              id={p.key}
              type="url"
              value={value}
              onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
              placeholder={p.placeholder}
            />
            {domainError && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Isto não parece um link do {p.label} ({p.hostnames?.join(" ou ")})
              </p>
            )}
          </div>
        );
      })}

      {inactivePlatforms.length > 0 && (
        <div>
          <Label>Adicionar plataforma</Label>
          <div className="flex flex-wrap gap-2">
            {inactivePlatforms.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => addPlatform(p.key)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 dark:border-white/10">
        <Label>Certificações (CompTIA, Cisco, AWS, etc.)</Label>
        <div className="space-y-2">
          {certifications.map((cert, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={cert.name}
                onChange={(e) => updateCertification(i, "name", e.target.value)}
                placeholder="Ex.: CompTIA Security+"
                className="min-w-0 flex-1"
              />
              <Input
                type="url"
                value={cert.url}
                onChange={(e) => updateCertification(i, "url", e.target.value)}
                placeholder="Link de verificação"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => removeCertification(i)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-white/10"
                aria-label="Remover certificação"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCertification}
          className="mt-2 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <Plus size={14} /> Adicionar certificação
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? "A guardar..." : "Guardar"}
        </Button>
        {saved && <span className="text-sm text-slate-500 dark:text-slate-400">Guardado.</span>}
      </div>
    </form>
  );
}
