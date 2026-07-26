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
import { UsernameField } from "@/components/account/UsernameField";
import { InstructorHeroGradient } from "@/components/instructor/InstructorHeroGradient";
import { boxFromRect, textBoxFromElement, useCardTransition } from "@/components/course/CardTransitionContext";
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
  initialUsername,
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
  initialUsername: string | null;
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
  // Não faz parte do draft/edição normal do perfil — tem o próprio endpoint,
  // gate e cooldown de 14 dias (UsernameField) — só precisa de refletir aqui
  // o valor guardado mais recente, sem passar pelo ciclo de "Guardar" geral.
  const [username, setUsername] = useState(initialUsername);
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

  // PersonTile (resultados de pesquisa) faz o avatar/nome voarem até aqui —
  // mesmo mecanismo do CourseHero para o vídeo/título de um curso.
  const avatarBoxRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const { state: transitionState, arrive } = useCardTransition();
  const transitionPending = transitionState?.slug === profileId && !transitionState.arrived;
  useEffect(() => {
    if (!transitionPending) return;
    const rect = avatarBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    arrive(profileId, {
      video: boxFromRect(rect),
      title: nameRef.current ? textBoxFromElement(nameRef.current) : null,
      category: null,
      instructor: null,
      rating: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitionPending, profileId]);

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

  // Sem banner próprio, o gradiente (InstructorHeroGradient) desvanece até
  // transparente lá em baixo — no tema claro isso revela o fundo branco da
  // página por trás, e texto sempre branco fica ilegível nessa zona. Com
  // banner, a sobreposição é sempre escura (preto/80→preto/10), então texto
  // branco fixo continua correto — só o caso sem banner precisa de reagir ao
  // tema.
  const hasBanner = Boolean(bannerUrl);
  const textMain = hasBanner ? "text-white" : "text-slate-900 dark:text-white";
  const textSoft = hasBanner ? "text-white/70" : "text-slate-900 dark:text-white/70";
  const textSofter = hasBanner ? "text-white/60" : "text-slate-500 dark:text-white/60";
  const textBody = hasBanner ? "text-white/85" : "text-slate-700 dark:text-white/85";
  const text80 = hasBanner ? "text-white/80" : "text-slate-700 dark:text-white/80";
  const hoverTextMain = hasBanner ? "hover:text-white" : "hover:text-slate-900 dark:hover:text-white";
  const chipBorder = hasBanner ? "border-white/25" : "border-slate-300 dark:border-white/25";
  const chipBg = hasBanner ? "bg-white/10" : "bg-slate-900/5 dark:bg-white/10";
  const chipHoverBg = hasBanner ? "hover:bg-white/10" : "hover:bg-slate-900/10 dark:hover:bg-white/10";
  const pillHoverBg = hasBanner ? "hover:bg-white/20" : "hover:bg-slate-900/10 dark:hover:bg-white/20";
  const placeholderClass = hasBanner ? "placeholder-white/50" : "placeholder-slate-500 dark:placeholder-white/50";
  const focusBorderClass = hasBanner ? "focus:border-white/50" : "focus:border-slate-500 dark:focus:border-white/50";
  const amberClass = hasBanner ? "text-amber-200" : "text-amber-600 dark:text-amber-200";

  const pillClass = `flex items-center gap-1.5 rounded-full border ${chipBorder} ${chipBg} px-3 py-1 text-xs font-medium ${textMain}`;
  const fieldClass = `rounded-md border ${chipBorder} ${chipBg} px-3 py-1.5 text-sm ${textMain} ${placeholderClass} focus:outline-none ${focusBorderClass}`;

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
        <div className={`mb-4 max-w-md rounded-lg border ${chipBorder} ${chipBg} p-3`}>
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${textSoft}`}>Banner do perfil</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className={`mb-1 flex items-center gap-1.5 text-xs ${textSoft}`}>
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
              <p className={`mb-1 flex items-center gap-1.5 text-xs ${textSoft}`}>
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
              className={`mt-2 text-xs font-medium ${text80} ${hoverTextMain}`}
            >
              Remover banner
            </button>
          )}
        </div>
      )}

      <div ref={avatarBoxRef} className="h-24 w-24 shrink-0 rounded-full">
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
      </div>

      {showInputs && (
        <div className="mt-2 max-w-xs">
          <FileUploadInput kind="IMAGE" currentUrl={image} onUploaded={(result) => setImage(result.url)} />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className={`text-xs font-semibold uppercase tracking-wide ${textSoft}`}>Aluno</p>
        {isOwner && showInputs ? (
          <UsernameField className="" onSaved={setUsername} />
        ) : (
          username && <span className={`text-xs ${textSoft}`}>@{username}</span>
        )}
      </div>

      {showInputs ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className={`mt-1 w-full max-w-lg rounded-md border ${chipBorder} ${chipBg} px-3 py-1.5 text-3xl font-bold ${textMain} ${placeholderClass} focus:outline-none ${focusBorderClass} sm:text-5xl`}
        />
      ) : (
        <h1 ref={nameRef} className={`mt-1 text-3xl font-bold ${textMain} sm:text-5xl`}>{name}</h1>
      )}

      {showInputs ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5">
            <Briefcase size={13} className={textSoft} />
            <input
              value={interestArea}
              onChange={(e) => setInterestArea(e.target.value)}
              maxLength={120}
              placeholder="Área de interesse"
              className={`${fieldClass} w-56`}
            />
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} className={textSoft} />
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
          <p className={`mt-1 text-xs ${textSofter}`}>{bio.length}/600</p>
        </div>
      ) : (
        bio && <p className={`mt-3 max-w-2xl whitespace-pre-wrap ${textBody}`}>{bio}</p>
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
                <span className={`shrink-0 text-xs ${textSofter}`}>{p.label}</span>
                <button
                  type="button"
                  onClick={() => removePlatform(p.key)}
                  aria-label={`Remover ${p.label}`}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${textSofter} ${chipHoverBg} ${hoverTextMain}`}
                >
                  <X size={13} />
                </button>
                {domainError && <p className={`text-xs ${amberClass}`}>Não parece um link do {p.label}</p>}
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
                  className={`rounded-full border ${chipBorder} px-3 py-1 text-xs ${text80} ${chipHoverBg}`}
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
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className={`${pillClass} ${pillHoverBg}`}>
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
                className={`flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-full ${textSofter} ${chipHoverBg} ${hoverTextMain} sm:self-center`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCertification}
            className={`flex items-center gap-1 text-xs font-medium ${text80} ${hoverTextMain}`}
          >
            <Plus size={13} /> Adicionar certificação
          </button>
        </div>
      ) : (
        certifications.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {certifications.map((cert, i) => (
              <a key={i} href={cert.url} target="_blank" rel="noopener noreferrer" className={`${pillClass} ${pillHoverBg}`}>
                <Award size={13} /> {cert.name}
              </a>
            ))}
          </div>
        )
      )}

      <div className={`mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm ${textBody}`}>
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
