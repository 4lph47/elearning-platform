import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { becomeInstructorSchema } from "@/lib/validations";
import { SOCIAL_PLATFORMS, type SocialPlatformKey } from "@/lib/socialPlatforms";

// Completa o registo de quem entrou com Google em /register/complete e
// escolheu "quero ensinar" — a conta já existe (STUDENT, criada pelo
// PrismaAdapter no login OAuth), aqui só preenche o perfil e sobe o role.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN") {
    return NextResponse.json({ error: "Já és instrutor" }, { status: 409 });
  }

  const parsed = becomeInstructorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { bio, expertise, yearsExperience, certifications } = parsed.data;
  const socialData = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p.key, (parsed.data as unknown as Record<SocialPlatformKey, string | null | undefined>)[p.key]?.trim() || null])
  );

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      role: "INSTRUCTOR",
      termsAcceptedAt: new Date(),
      bio: bio.trim(),
      expertise: expertise.trim(),
      yearsExperience,
      ...socialData,
      certifications: {
        create: certifications.map((c, i) => ({ name: c.name.trim(), url: c.url.trim(), order: i })),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
