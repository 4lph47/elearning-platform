import { z } from "zod";

// javascript:/data: URLs stored here get rendered unescaped as <a href>/<img src>/
// <video src>/<iframe src> for every student that opens the course — must be http(s).
const httpUrlField = z
  .string()
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Link deve começar com http:// ou https://")
  .optional()
  .nullable();

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A password deve ter pelo menos 6 caracteres"),
  wantsToTeach: z.boolean().optional().default(false),
});
export type RegisterInput = z.infer<typeof registerSchema>;

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
  thumbnailUrl: httpUrlField,
  trailerUrl: httpUrlField,
  published: z.boolean().optional().default(false),
  price: z.number().min(0, "Preço não pode ser negativo").optional().default(0),
  originalPrice: z.number().min(0, "Preço original não pode ser negativo").optional().nullable(),
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
  contentUrl: httpUrlField,
  thumbnailUrl: httpUrlField,
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

export const progressSchema = z.object({
  lessonId: z.string().min(1),
  watchedSeconds: z.number().int().min(0).optional(),
  completed: z.boolean().optional(),
});
export type ProgressInput = z.infer<typeof progressSchema>;

const ALLOWED_MIME_BY_TYPE: Record<string, string[]> = {
  VIDEO: ["video/mp4", "video/webm"],
  DOCUMENT: ["application/pdf"],
  IMAGE: ["image/png", "image/jpeg", "image/webp"],
};

const MAX_SIZE_BY_TYPE: Record<string, number> = {
  VIDEO: 500 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
  IMAGE: 20 * 1024 * 1024,
};

export function validateUpload(kind: "VIDEO" | "DOCUMENT" | "IMAGE", mimeType: string, sizeBytes: number) {
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
