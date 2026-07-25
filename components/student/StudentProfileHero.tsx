"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  MessageSquare,
  Award,
  Globe,
  Link2,
  Briefcase,
  Pencil,
  Plus,
  X,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Film,
} from "lucide-react";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";
import { InstructorHeroGradient } from "@/components/instructor/InstructorHeroGradient";
import { SOCIAL_PLATFORMS, matchesPlatformDomain, type SocialPlatformKey } from "@/lib/socialPlatforms";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { saveDraft, loadDraft, clearDraft } from "@/lib/formDraft";
import { CornerCard, CornerCardStack, CornerCardButtonNeutral, CornerCardButtonPrimary } from "@/components/ui/CornerCard";

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

interface CertificationInput {
  name: string;
  url: string;
}

type BannerType = "IMAGE" | "VIDEO";

interface Stats {
  courseCount: number;
  totalHours: number;
  reviewCount: number;
  certificationCount: number;
}

interface ProfileDraft {
  name: string;
  image: string | null;
  bannerUrl: string | null;
  bannerType: BannerType | null;
  bio: string;
  interestArea: string;
  yearsLearning: string;
  values: Record<SocialPlatformKey, string>;
  activeKeys: SocialPlatformKey[];
  certifications: CertificationInput[];
}

// Mesma estrutura do InstructorProfileHero (edição inline, rascunho local,
// mesmos campos base do User) — só muda o rótulo "Aluno", os stats (sem
// rating, porque aluno não tem cursos avaliados por outros) e o significado
// dos campos "área de especialização"/"anos de experiência", reaproveitados
// aqui como "área de interesse"/"anos a estudar".
export function StudentProfileHero({
  isOwner,
  profileId,
  initialName,
  initialImage,
  initialBannerUrl,
  initialBannerType,
  initialBio,
  initialInterestArea,
  initialYearsLearning,
  initialValues,
  initialCertifications,
  stats,
  belowContent,
}: {
  isOwner: boolean;
  profileId: string;
  initialName: string;
  initialImage: string | null;
  initialBannerUrl: string | null;
  initialBannerType: BannerType | null;
  initialBio: string;
  initialInterestArea: string;
  initialYearsLearning: number | null;
  initialValues: Record<SocialPlatformKey, string>;
  initialCertifications: CertificationInput[];
  stats: Stats;
  belowContent?: ReactNode;
}) {
  const router = useRouter();
  const draftKey = `student-profile-draft:${profileId}`;
  const [draft] = useState(() => (isOwner ? loadDraft<ProfileDraft>(draftKey) : null));
  const [draftBannerVisible, setDraftBannerVisible] = useState(() => Boolean(draft));

  const [editing, setEditing] = useState(() => Boolean(draft));
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(draft?.value.name ?? initialName);
  const [image, setImage] = useState(draft?.value.image ?? initialImage);
  const [bannerUrl, setBannerUrl] = useState(draft?.value.bannerUrl ?? initialBannerUrl);
  const [bannerType, setBannerType] = useState<BannerType | null>(draft?.value.bannerType ?? initialBannerType);
  const [bio, setBio] = useState(draft?.value.bio ?? initialBio);
  const [interestArea, setInterestArea] = useState(draft?.value.interestArea ?? initialInterestArea);
  const [yearsLearning, setYearsLearning] = useState(
    draft?.value.yearsLearning ?? (initialYearsLearning !== null ? String(initialYearsLearning) : "")
  );
  const [values, setValues] = useState(draft?.value.values ?? initialValues);
  const [activeKeys, setActiveKeys] = useState<SocialPlatformKey[]>(
    draft?.value.activeKeys ?? SOCIAL_PLATFORMS.map((p) => p.key).filter((k) => (initialValues[k] ?? "").trim() !== "")
  );
  const [certifications, setCertifications] = useState<CertificationInput[]>(
    draft?.value.certifications ?? initialCertifications
  );

  const [dirty, setDirty] = useState(false);
  const skipDirtyRef = useRef(true);
  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    if (!editing) return;
    setDirty(true);
    saveDraft<ProfileDraft>(draftKey, {
      name,
      image,
      bannerUrl,
      bannerType,
      bio,
      interestArea,
      yearsLearning,
      values,
      activeKeys,
      certifications,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, image, bannerUrl, bannerType, bio, interestArea, yearsLearning, values, activeKeys, certifications]);
  useUnsavedChangesGuard(dirty);

  function discardDraft() {
    clearDraft(draftKey);
    window.location.reload();
  }

  function startEditing() {
    setError(null);
    setPreviewMode(false);
    setEditing(true);
  }

  function cancelEditing() {
    setName(initialName);
    setImage(initialImage);
    setBannerUrl(initialBannerUrl);
    setBannerType(initialBannerType);
    setBio(initialBio);
    setInterestArea(initialInterestArea);
    setYearsLearning(initialYearsLearning !== null ? String(initialYearsLearning) : "");
    setValues(initialValues);
    setActiveKeys(SOCIAL_PLATFORMS.map((p) => p.key).filter((k) => (initialValues[k] ?? "").trim() !== ""));
    setCertifications(initialCertifications);
    setError(null);
    setPreviewMode(false);
    setEditing(false);
    setDirty(false);
    clearDraft(draftKey);
  }

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

  async function save() {
    if (name.trim().length < 2) {
      setError("Nome deve ter pelo menos 2 caracteres");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        image,
        bannerUrl,
        bannerType,
        bio,
        expertise: interestArea,
        yearsExperience: yearsLearning.trim() === "" ? null : Number(yearsLearning),
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

    setEditing(false);
    setPreviewMode(false);
    setDirty(false);
    clearDraft(draftKey);
    router.refresh();
  }

  const showInputs = editing && !previewMode;
  const inactivePlatforms = SOCIAL_PLATFORMS.filter((p) => !activeKeys.includes(p.key));
  const socialLinks = SOCIAL_PLATFORMS.map((p) => ({
    url: values[p.key],
    label: p.label,
    icon: p.key === "websiteUrl" ? Globe : Link2,
  })).filter((s): s is { url: string; label: string; icon: typeof Globe } => Boolean(s.url?.trim()));

  const pillClass =
    "flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white";
  const fieldClass =
    "rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/50 focus:border-white/50 focus:outline-none";

  const content = (
    <div className="relative">
      {isOwner && draft && (
        <CornerCardStack>
          {draftBannerVisible && (
            <CornerCard>
              <p className="text-slate-700 dark:text-slate-200">
                Restaurámos um rascunho não guardado de {new Date(draft.savedAt).toLocaleString("pt-PT")}.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <CornerCardButtonNeutral onClick={discardDraft}>Descartar</CornerCardButtonNeutral>
                <CornerCardButtonPrimary onClick={() => setDraftBannerVisible(false)}>
                  Continuar com este rascunho
                </CornerCardButtonPrimary>
              </div>
            </CornerCard>
          )}
        </CornerCardStack>
      )}

      {isOwner && !editing && (
        <button
          type="button"
          onClick={startEditing}
          className="absolute right-0 top-0 flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
        >
          <Pencil size={13} /> Editar
        </button>
      )}

      {isOwner && editing && (
        <div className="absolute -top-12 right-0 flex flex-wrap items-center justify-end gap-2 sm:top-0">
          {error && <span className="text-xs font-medium text-red-200">{error}</span>}
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            {previewMode ? <EyeOff size={13} /> : <Eye size={13} />} {previewMode ? "Voltar a editar" : "Pré-visualizar"}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            <X size={13} /> Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Guardar
          </button>
        </div>
      )}

      {showInputs && (
        <div className="mb-4 max-w-md rounded-lg border border-white/25 bg-white/10 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">Banner do perfil</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="mb-1 flex items-center gap-1.5 text-xs text-white/70">
                <ImageIcon size={12} /> Imagem
              </p>
              <FileUploadInput
                kind="IMAGE"
                compactMobile
                currentUrl={bannerType === "IMAGE" ? bannerUrl : null}
                onUploaded={(result) => {
                  setBannerUrl(result.url);
                  setBannerType("IMAGE");
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 flex items-center gap-1.5 text-xs text-white/70">
                <Film size={12} /> Vídeo
              </p>
              <FileUploadInput
                kind="TRAILER"
                compactMobile
                currentUrl={bannerType === "VIDEO" ? bannerUrl : null}
                onUploaded={(result) => {
                  setBannerUrl(result.url);
                  setBannerType("VIDEO");
                }}
              />
            </div>
          </div>
          {bannerUrl && (
            <button
              type="button"
              onClick={() => {
                setBannerUrl(null);
                setBannerType(null);
              }}
              className="mt-2 text-xs font-medium text-white/80 hover:text-white"
            >
              Remover banner
            </button>
          )}
        </div>
      )}

      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="h-24 w-24 rounded-full object-cover shadow-lg shadow-black/30 ring-4 ring-white/30"
        />
      ) : (
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-3xl font-bold text-white shadow-lg shadow-black/30 ring-4 ring-white/30 backdrop-blur">
          {initials(name)}
        </span>
      )}

      {showInputs && (
        <div className="mt-2 max-w-xs">
          <FileUploadInput kind="IMAGE" currentUrl={image} onUploaded={(result) => setImage(result.url)} />
        </div>
      )}

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-white/70">Aluno</p>

      {showInputs ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="mt-1 w-full max-w-lg rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-3xl font-bold text-white placeholder-white/50 focus:border-white/50 focus:outline-none sm:text-5xl"
        />
      ) : (
        <h1 className="mt-1 text-3xl font-bold text-white sm:text-5xl">{name}</h1>
      )}

      {showInputs ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5">
            <Briefcase size={13} className="text-white/70" />
            <input
              value={interestArea}
              onChange={(e) => setInterestArea(e.target.value)}
              maxLength={120}
              placeholder="Área de interesse"
              className={`${fieldClass} w-56`}
            />
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-white/70" />
            <input
              type="number"
              min={0}
              max={80}
              value={yearsLearning}
              onChange={(e) => setYearsLearning(e.target.value)}
              placeholder="Anos a estudar"
              className={`${fieldClass} w-20`}
            />
          </span>
        </div>
      ) : (
        (interestArea || yearsLearning !== "") && (
          <div className="mt-3 flex flex-wrap gap-2">
            {interestArea && (
              <span className={pillClass}>
                <Briefcase size={13} /> {interestArea}
              </span>
            )}
            {yearsLearning !== "" && (
              <span className={pillClass}>
                <Clock size={13} /> {yearsLearning} ano{yearsLearning !== "1" ? "s" : ""} a estudar online
              </span>
            )}
          </div>
        )
      )}

      {showInputs ? (
        <div className="mt-3 max-w-2xl">
          <textarea
            rows={4}
            maxLength={600}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Conta um pouco sobre ti e o que estás a aprender..."
            className={`${fieldClass} w-full`}
          />
          <p className="mt-1 text-xs text-white/60">{bio.length}/600</p>
        </div>
      ) : (
        bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-white/85">{bio}</p>
      )}

      {showInputs ? (
        <div className="mt-4 max-w-2xl space-y-2">
          {SOCIAL_PLATFORMS.filter((p) => activeKeys.includes(p.key)).map((p) => {
            const value = values[p.key];
            const domainError = value.trim() && !matchesPlatformDomain(p, value.trim());
            return (
              <div key={p.key} className="flex items-center gap-2">
                <input
                  value={value}
                  onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  placeholder={p.placeholder}
                  className={`${fieldClass} min-w-0 flex-1`}
                />
                <span className="shrink-0 text-xs text-white/60">{p.label}</span>
                <button
                  type="button"
                  onClick={() => removePlatform(p.key)}
                  aria-label={`Remover ${p.label}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X size={13} />
                </button>
                {domainError && <p className="text-xs text-amber-200">Não parece um link do {p.label}</p>}
              </div>
            );
          })}
          {inactivePlatforms.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {inactivePlatforms.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => addPlatform(p.key)}
                  className="rounded-full border border-white/25 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        socialLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {socialLinks.map(({ url, label, icon: Icon }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className={`${pillClass} hover:bg-white/20`}>
                <Icon size={13} /> {label}
              </a>
            ))}
          </div>
        )
      )}

      {showInputs ? (
        <div className="mt-3 max-w-2xl space-y-2">
          {certifications.map((cert, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={cert.name}
                onChange={(e) => updateCertification(i, "name", e.target.value)}
                placeholder="Ex.: CompTIA Security+"
                className={`${fieldClass} min-w-0 flex-1`}
              />
              <input
                value={cert.url}
                onChange={(e) => updateCertification(i, "url", e.target.value)}
                placeholder="Link de verificação"
                className={`${fieldClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => removeCertification(i)}
                aria-label="Remover certificação"
                className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full text-white/60 hover:bg-white/10 hover:text-white sm:self-center"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCertification}
            className="flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white"
          >
            <Plus size={13} /> Adicionar certificação
          </button>
        </div>
      ) : (
        certifications.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {certifications.map((cert, i) => (
              <a key={i} href={cert.url} target="_blank" rel="noopener noreferrer" className={`${pillClass} hover:bg-white/20`}>
                <Award size={13} /> {cert.name}
              </a>
            ))}
          </div>
        )
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
        <span className="flex items-center gap-1.5">
          <BookOpen size={15} /> {stats.courseCount} curso{stats.courseCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={15} /> {stats.totalHours} hora{stats.totalHours !== 1 ? "s" : ""} assistida{stats.totalHours !== 1 ? "s" : ""}
        </span>
        {stats.reviewCount > 0 && (
          <span className="flex items-center gap-1.5">
            <MessageSquare size={15} /> {stats.reviewCount} avaliaç{stats.reviewCount !== 1 ? "ões" : "ão"}
          </span>
        )}
        {stats.certificationCount > 0 && (
          <span className="flex items-center gap-1.5">
            <Award size={15} /> {stats.certificationCount} certificado{stats.certificationCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );

  const heroBox = bannerUrl ? (
    <div className="relative -mt-16 overflow-hidden pb-6 pt-[7.5rem] sm:pt-36">
      {bannerType === "VIDEO" ? (
        <video
          key={bannerUrl}
          src={bannerUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-8">{content}</div>
    </div>
  ) : (
    <InstructorHeroGradient>
      <div className="mx-auto max-w-5xl px-4 sm:px-8">{content}</div>
    </InstructorHeroGradient>
  );

  return (
    <>
      {heroBox}
      {!showInputs && belowContent}
    </>
  );
}
