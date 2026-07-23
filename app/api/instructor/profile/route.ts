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
    bio: z.string().max(600, "Bio deve ter no máximo 600 caracteres").optional().nullable(),
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

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // z.infer não propaga chaves construídas via Object.fromEntries — cast
  // explícito para o shape real (bio + certificações + um URL opcional por plataforma).
  const data = parsed.data as {
    bio?: string | null;
    certifications: { name: string; url: string }[];
  } & Record<SocialPlatformKey, string | null | undefined>;
  const urlData = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, data[p.key]?.trim() || null]));

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      bio: data.bio?.trim() || null,
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
    bio: updated.bio,
    certifications: updated.certifications,
    ...Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, updated[p.key as keyof typeof updated]])),
  });
}
