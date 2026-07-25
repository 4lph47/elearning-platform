import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SOCIAL_PLATFORMS, matchesPlatformDomain, type SocialPlatformKey } from "@/lib/socialPlatforms";

const baseUrlField = z
  .string()
  .max(300, "Link deve ter no máximo 300 caracteres")
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Link deve começar com http:// ou https://")
  .optional()
  .nullable();

const certificationSchema = z.object({
  name: z.string().min(1, "Nome da certificação é obrigatório").max(120, "Nome deve ter no máximo 120 caracteres"),
  url: z
    .string()
    .min(1, "Link da certificação é obrigatório")
    .max(300, "Link deve ter no máximo 300 caracteres")
    .refine((v) => /^https?:\/\//i.test(v), "Link deve começar com http:// ou https://"),
});

const profileSchema = z
  .object({
    name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres").optional(),
    image: z.string().max(500, "Link da imagem deve ter no máximo 500 caracteres").optional().nullable(),
    bannerUrl: z.string().max(500, "Link do banner deve ter no máximo 500 caracteres").optional().nullable(),
    bannerType: z.enum(["IMAGE", "VIDEO"]).optional().nullable(),
    bio: z.string().max(600, "Bio deve ter no máximo 600 caracteres").optional().nullable(),
    expertise: z.string().max(120, "Área de especialização deve ter no máximo 120 caracteres").optional().nullable(),
    yearsExperience: z.number().int().min(0, "Não pode ser negativo").max(80, "Valor inválido").optional().nullable(),
    certifications: z.array(certificationSchema).max(30, "Máximo de 30 certificações").optional().default([]),
    ...Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, baseUrlField])),
  })
  .superRefine((data, ctx) => {
    // Domínio tem de bater com a plataforma escolhida — um link de Instagram
    // metido no campo do LinkedIn (por engano ou de propósito) é rejeitado.
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

// Partilhado por perfil público de instrutor e de aluno — os dois editam os
// mesmos campos do User (bio, banner, redes sociais, certificações), só a
// UI é que muda por papel. Único requisito é sessão válida a editar o
// próprio perfil (session.user.id), não há restrição de role aqui.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // z.infer não propaga chaves construídas via Object.fromEntries — cast
  // explícito para o shape real (bio + certificações + um URL opcional por plataforma).
  const data = parsed.data as {
    name?: string;
    image?: string | null;
    bannerUrl?: string | null;
    bannerType?: "IMAGE" | "VIDEO" | null;
    bio?: string | null;
    expertise?: string | null;
    yearsExperience?: number | null;
    certifications: { name: string; url: string }[];
  } & Record<SocialPlatformKey, string | null | undefined>;
  const urlData = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, data[p.key]?.trim() || null]));

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.image !== undefined ? { image: data.image?.trim() || null } : {}),
      // Sem banner, não há tipo — os dois andam sempre a par, nunca um sem o outro.
      bannerUrl: data.bannerUrl?.trim() || null,
      bannerType: data.bannerUrl?.trim() ? data.bannerType ?? null : null,
      bio: data.bio?.trim() || null,
      expertise: data.expertise?.trim() || null,
      yearsExperience: data.yearsExperience ?? null,
      ...urlData,
      // Substitui a lista toda de uma vez (mesmo padrão das perguntas de um
      // quiz) — mais simples que sincronizar criações/edições/remoções item
      // a item, e o botão "Guardar" é único para o formulário inteiro.
      certifications: {
        deleteMany: {},
        create: data.certifications.map((c, i) => ({ name: c.name.trim(), url: c.url.trim(), order: i })),
      },
    },
    include: { certifications: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({
    name: updated.name,
    image: updated.image,
    bannerUrl: updated.bannerUrl,
    bannerType: updated.bannerType,
    bio: updated.bio,
    expertise: updated.expertise,
    yearsExperience: updated.yearsExperience,
    certifications: updated.certifications,
    ...Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, updated[p.key as keyof typeof updated]])),
  });
}
