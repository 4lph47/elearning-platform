import { z } from "zod";
import { SOCIAL_PLATFORMS, matchesPlatformDomain, type SocialPlatformKey } from "@/lib/socialPlatforms";

// javascript:/data: URLs stored here get rendered unescaped as <a href>/<img src>/
// <video src>/<iframe src> for every student that opens the course — must be http(s).
const HTTP_URL_REGEX = /^https?:\/\//i;

// Único campo deste tipo que a pessoa mesmo digita como link (perfil de
// instrutor) — os outros abaixo (trailer, thumbnail, vídeo, legendas) só
// recebem o URL devolvido pelo upload de ficheiro (FileUploadInput), nunca
// texto escrito à mão, por isso têm a sua própria mensagem de erro.
const httpUrlField = z
  .string()
  .refine((v) => v === "" || HTTP_URL_REGEX.test(v), "Link deve começar com http:// ou https://")
  .optional()
  .nullable();

// Mesma validação de formato do httpUrlField (proteção contra javascript:/data:
// acima), mas com mensagem própria — só devia falhar por corrupção/bug no
// upload, nunca porque a pessoa "esqueceu-se do link", já que o campo nem
// aceita texto escrito à mão.
const uploadedFileUrlField = z
  .string()
  .refine((v) => v === "" || HTTP_URL_REGEX.test(v), "Ficheiro inválido — tenta enviar novamente")
  .optional()
  .nullable();

// @tag único usado nas @menções e no perfil público — minúsculas por
// convenção (guardado já em lowercase), letras/números/underscore, tem de
// começar por letra para nunca ser confundido com um id/número puro.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username deve ter pelo menos 3 caracteres")
  .max(20, "Username deve ter no máximo 20 caracteres")
  .regex(/^[a-z][a-z0-9_]*$/, "Username só pode ter letras minúsculas, números e _, e começar por uma letra");

export const verifyEmailCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "O código tem de ter 6 dígitos"),
});

const registerCertificationSchema = z.object({
  name: z.string().min(1, "Nome da certificação é obrigatório").max(120, "Nome deve ter no máximo 120 caracteres"),
  url: z
    .string()
    .min(1, "Link da certificação é obrigatório")
    .max(300, "Link deve ter no máximo 300 caracteres")
    .refine((v) => HTTP_URL_REGEX.test(v), "Link deve começar com http:// ou https://"),
});

export const registerSchema = z
  .object({
    // Só obrigatório para instrutor (verificado abaixo no superRefine) — um
    // aluno só precisa de username/email/password/termos para criar conta,
    // o resto (incluindo o nome) é opcional.
    name: z.string().max(100, "Nome deve ter no máximo 100 caracteres").optional().default(""),
    username: usernameSchema,
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "A password deve ter pelo menos 6 caracteres"),
    wantsToTeach: z.boolean().optional().default(false),
    acceptedTerms: z.literal(true, { message: "Tens de aceitar os Termos e Serviços" }),
    bio: z.string().max(600, "Bio deve ter no máximo 600 caracteres").optional().nullable(),
    expertise: z.string().max(120, "Área de especialização deve ter no máximo 120 caracteres").optional().nullable(),
    yearsExperience: z.number().int().min(0, "Não pode ser negativo").max(80, "Valor inválido").optional().nullable(),
    certifications: z.array(registerCertificationSchema).max(30, "Máximo de 30 certificações").optional().default([]),
    ...Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, httpUrlField])),
  })
  .superRefine((data, ctx) => {
    if (!data.wantsToTeach) return;
    if (!data.name || data.name.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Nome deve ter pelo menos 2 caracteres",
      });
    }
    if (!data.bio || data.bio.trim().length < 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bio"],
        message: "Conta-nos a tua experiência com pelo menos 50 caracteres",
      });
    }
    if (!data.expertise || data.expertise.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expertise"],
        message: "Indica a tua área de especialização",
      });
    }
    if (data.yearsExperience === null || data.yearsExperience === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["yearsExperience"],
        message: "Indica os teus anos de experiência",
      });
    }
    for (const platform of SOCIAL_PLATFORMS) {
      const value = (data as unknown as Record<SocialPlatformKey, string | null | undefined>)[platform.key];
      if (value && value.trim() && !matchesPlatformDomain(platform, value.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [platform.key],
          message: `Este link não parece ser do ${platform.label} (${platform.hostnames?.join(" ou ")})`,
        });
      }
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

// Completar perfil de instrutor depois de entrar com Google em
// /register/complete — sem nome/email/password (já vêm da conta Google).
export const becomeInstructorSchema = z
  .object({
    username: usernameSchema,
    acceptedTerms: z.literal(true, { message: "Tens de aceitar os Termos e Serviços" }),
    bio: z.string().min(50, "Conta-nos a tua experiência com pelo menos 50 caracteres").max(600, "Bio deve ter no máximo 600 caracteres"),
    expertise: z.string().min(2, "Indica a tua área de especialização").max(120, "Área de especialização deve ter no máximo 120 caracteres"),
    yearsExperience: z.number().int().min(0, "Não pode ser negativo").max(80, "Valor inválido"),
    certifications: z.array(registerCertificationSchema).max(30, "Máximo de 30 certificações").optional().default([]),
    ...Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, httpUrlField])),
  })
  .superRefine((data, ctx) => {
    for (const platform of SOCIAL_PLATFORMS) {
      const value = (data as unknown as Record<SocialPlatformKey, string | null | undefined>)[platform.key];
      if (value && value.trim() && !matchesPlatformDomain(platform, value.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [platform.key],
          message: `Este link não parece ser do ${platform.label} (${platform.hostnames?.join(" ou ")})`,
        });
      }
    }
  });
export type BecomeInstructorInput = z.infer<typeof becomeInstructorSchema>;

// Completar registo de aluno vindo de Google/link mágico em /register/complete
// — só falta o username (nome/email já vêm da conta, termos aceites aqui).
export const completeStudentSchema = z.object({
  username: usernameSchema,
  acceptedTerms: z.literal(true, { message: "Tens de aceitar os Termos e Serviços" }),
});
export type CompleteStudentInput = z.infer<typeof completeStudentSchema>;

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Password é obrigatória"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const courseSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  category: z.string().min(2, "Categoria é obrigatória"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  thumbnailUrl: uploadedFileUrlField,
  trailerUrl: uploadedFileUrlField,
  published: z.boolean().optional().default(false),
  price: z.number().min(0, "Preço não pode ser negativo").optional().default(0),
  originalPrice: z.number().min(0, "Preço original não pode ser negativo").optional().nullable(),
  resaleMinCommission: z.number().min(0, "Não pode ser negativo").optional().nullable(),
  learningOutcomes: z.array(z.string().min(1)).optional().default([]),
  requirements: z.array(z.string().min(1)).optional().default([]),
  targetAudience: z.array(z.string().min(1)).optional().default([]),
  topics: z.array(z.string().min(1)).optional().default([]),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const moduleSchema = z.object({
  title: z.string().min(2, "Título é obrigatório"),
  order: z.number().int().min(0),
});
export type ModuleInput = z.infer<typeof moduleSchema>;

export const lessonSchema = z.object({
  title: z.string().min(2, "Título é obrigatório"),
  order: z.number().int().min(0),
  isFreePreview: z.boolean().optional().default(false),
  type: z.enum(["VIDEO", "TEXT"]).optional().default("VIDEO"),
  contentUrl: uploadedFileUrlField,
  thumbnailUrl: uploadedFileUrlField,
  captionsUrl: uploadedFileUrlField,
  textContent: z.string().optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export function validateLessonContent(data: Partial<LessonInput>): string | null {
  if (data.type === "TEXT") {
    if (!data.textContent || data.textContent.trim().length === 0) {
      return "É obrigatório escrever o conteúdo da aula de texto";
    }
  } else if (!data.contentUrl || data.contentUrl.trim().length === 0) {
    return "É obrigatório enviar um vídeo para a aula";
  }
  return null;
}

export const quizSchema = z.object({
  title: z.string().min(2, "Título do quiz é obrigatório"),
  maxAttempts: z.number().int().min(1, "Tem de ser pelo menos 1").optional().nullable(),
  timeLimitMinutes: z.number().int().min(1, "Tem de ser pelo menos 1 minuto").optional().nullable(),
  retryAfterHours: z.number().int().min(1, "Tem de ser pelo menos 1 hora").optional().nullable(),
  showCountdown: z.boolean().optional(),
  questions: z
    .array(
      z.object({
        text: z.string().min(2, "Texto da pergunta é obrigatório"),
        order: z.number().int().min(0),
        options: z
          .array(
            z.object({
              text: z.string().min(1, "Texto da opção é obrigatório"),
              isCorrect: z.boolean().optional().default(false),
              order: z.number().int().min(0),
            })
          )
          .min(2, "Cada pergunta precisa de pelo menos 2 opções"),
      })
    )
    .min(1, "O quiz precisa de pelo menos 1 pergunta"),
});
export type QuizInput = z.infer<typeof quizSchema>;

export const resaleListingSchema = z.object({
  courseId: z.string().min(1),
  price: z.number().min(0.01, "Preço tem de ser maior que zero"),
});
export type ResaleListingInput = z.infer<typeof resaleListingSchema>;

export const resaleListingUpdateSchema = z.object({
  price: z.number().min(0.01, "Preço tem de ser maior que zero").optional(),
  active: z.boolean().optional(),
});
export type ResaleListingUpdateInput = z.infer<typeof resaleListingUpdateSchema>;

export const resaleBundleSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().max(2000).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  listingIds: z.array(z.string().min(1)).min(1, "Escolhe pelo menos uma listagem"),
});
export type ResaleBundleInput = z.infer<typeof resaleBundleSchema>;

export const resaleBundleUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  description: z.string().max(2000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  listingIds: z.array(z.string().min(1)).min(1, "Escolhe pelo menos uma listagem").optional(),
});
export type ResaleBundleUpdateInput = z.infer<typeof resaleBundleUpdateSchema>;

export const communityRequirementSchema = z.object({
  type: z.enum([
    "PURCHASED_COURSE",
    "COMPLETED_COURSE",
    "MIN_ENROLLMENTS",
    "MIN_COMPLETED_COURSES",
    "MIN_REVIEWS",
    "INSTRUCTOR_ONLY",
    "STUDENT_ONLY",
  ]),
  courseId: z.string().min(1).optional(),
  minValue: z.number().int().min(1).optional(),
});
export type CommunityRequirementInput = z.infer<typeof communityRequirementSchema>;

export const communitySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  category: z.string().min(1, "Escolhe uma categoria"),
  description: z.string().max(2000).optional().nullable(),
  rules: z.string().max(4000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  requirements: z.array(communityRequirementSchema).max(20).optional(),
});
export type CommunityInput = z.infer<typeof communitySchema>;

export const communityUpdateSchema = communitySchema.omit({ requirements: true }).partial();
export type CommunityUpdateInput = z.infer<typeof communityUpdateSchema>;

export const communityMessageSchema = z
  .object({
    content: z.string().trim().max(2000).optional(),
    attachmentUrl: z.string().url().optional(),
    attachmentType: z.string().max(50).optional(),
    attachmentName: z.string().max(255).optional(),
    replyToId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.content?.trim()) || Boolean(data.attachmentUrl), {
    message: "Escreve uma mensagem ou anexa um ficheiro",
  });
export type CommunityMessageInput = z.infer<typeof communityMessageSchema>;

export const progressSchema = z.object({
  lessonId: z.string().min(1),
  watchedSeconds: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});
export type ProgressInput = z.infer<typeof progressSchema>;

const ALLOWED_MIME_BY_TYPE: Record<string, string[]> = {
  VIDEO: ["video/mp4", "video/webm"],
  TRAILER: ["video/mp4", "video/webm"],
  DOCUMENT: ["application/pdf"],
  IMAGE: ["image/png", "image/jpeg", "image/webp"],
  // Anexos de mensagens de comunidade — qualquer membro (aluno ou
  // instrutor) pode enviar, ao contrário do resto desta tabela (só
  // instrutor, ver app/api/upload/sign/route.ts). Conjunto mais largo de
  // propósito (vídeo/áudio/imagem/documento/genérico, "tipo WhatsApp").
  COMMUNITY_ATTACHMENT: [
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/zip",
    "text/plain",
  ],
};

const MAX_SIZE_BY_TYPE: Record<string, number> = {
  // Vídeo de aula vai direto pro worker (Railway), sem o teto de 50MB do
  // Supabase Storage (só as renditions HLS já comprimidas chegam lá) — 4K
  // de verdade pode passar longe disto.
  VIDEO: 5 * 1024 * 1024 * 1024,
  // Trailer continua a ir direto pro Supabase Storage (raw, sem HLS — o
  // hover-preview em CourseTile.tsx usa <video> simples, não hls.js), por
  // isso fica sujeito ao teto real de 50MB por objeto do bucket (margem
  // abaixo disso).
  TRAILER: 45 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
  // Imagens continuam a passar pelo corpo de um pedido ao Vercel (para o
  // sharp comprimir server-side) — esse limite é 4.5MB, por isso o teto
  // fica com margem abaixo disso, não nos 20MB de antes (vídeo/documento já
  // não têm este problema, vão diretos para o Storage).
  IMAGE: 4 * 1024 * 1024,
  // Anexos de comunidade vão diretos pro Supabase Storage (raw, sem worker
  // nenhum a comprimir) — sujeitos ao mesmo teto real de 50MB por objeto do
  // bucket que o TRAILER já respeita.
  COMMUNITY_ATTACHMENT: 45 * 1024 * 1024,
};

// Todas as mensagens de erro de um ZodError, não só a primeira — usado pelo
// popup "falta preencher" no ecrã de curso/aula (ver components/ui/CornerCard.tsx),
// que lista tudo o que falta corrigir de uma vez, não campo a campo.
export function zodIssueMessages(error: z.ZodError): string[] {
  return error.issues.map((i) => i.message);
}

// Mesma coisa, mas com o campo (1º segmento do path) associado a cada
// mensagem — é o que permite o popup "falta preencher" clicar num item e
// saltar direto pro campo em causa (ver focusField em components/ui/CornerCard.tsx).
export function zodIssueDetails(error: z.ZodError): { message: string; field?: string }[] {
  return error.issues.map((i) => ({ message: i.message, field: i.path.length > 0 ? String(i.path[0]) : undefined }));
}

export function validateUpload(
  kind: "VIDEO" | "TRAILER" | "DOCUMENT" | "IMAGE" | "COMMUNITY_ATTACHMENT",
  mimeType: string,
  sizeBytes: number
) {
  const allowedMimes = ALLOWED_MIME_BY_TYPE[kind];
  if (!allowedMimes.includes(mimeType)) {
    return { ok: false as const, error: `Tipo de ficheiro não permitido para ${kind}: ${mimeType}` };
  }
  const maxSize = MAX_SIZE_BY_TYPE[kind];
  if (sizeBytes > maxSize) {
    return { ok: false as const, error: `Ficheiro excede o tamanho máximo de ${maxSize / (1024 * 1024)}MB` };
  }
  return { ok: true as const };
}
