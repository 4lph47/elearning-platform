import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const settingsSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100).optional(),
  phone: z.string().trim().max(30, "Número inválido").optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  locale: z.enum(["pt"]).optional(),
  adsPersonalization: z.boolean().optional(),
  profileVisibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  searchByEmail: z.boolean().optional(),
  searchByPhone: z.boolean().optional(),
  showCommunitiesOnProfile: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  autoplayNextLesson: z.boolean().optional(),
  defaultResaleMinCommission: z.number().min(0).max(100).optional().nullable(),
  accentColor: z.enum(["blue", "violet", "emerald", "rose", "amber", "slate"]).optional(),
  fontSize: z.enum(["sm", "md", "lg"]).optional(),
  reduceMotion: z.boolean().optional(),
});

const SELECT = {
  name: true,
  email: true,
  phone: true,
  birthDate: true,
  locale: true,
  adsPersonalization: true,
  profileVisibility: true,
  searchByEmail: true,
  searchByPhone: true,
  showCommunitiesOnProfile: true,
  notifyEmail: true,
  notifyPush: true,
  notifySms: true,
  autoplayNextLesson: true,
  defaultResaleMinCommission: true,
  accentColor: true,
  fontSize: true,
  reduceMotion: true,
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ...SELECT, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.birthDate !== undefined ? { birthDate: data.birthDate ? new Date(data.birthDate) : null } : {}),
      ...(data.locale !== undefined ? { locale: data.locale } : {}),
      ...(data.adsPersonalization !== undefined ? { adsPersonalization: data.adsPersonalization } : {}),
      ...(data.profileVisibility !== undefined ? { profileVisibility: data.profileVisibility } : {}),
      ...(data.searchByEmail !== undefined ? { searchByEmail: data.searchByEmail } : {}),
      ...(data.searchByPhone !== undefined ? { searchByPhone: data.searchByPhone } : {}),
      ...(data.showCommunitiesOnProfile !== undefined ? { showCommunitiesOnProfile: data.showCommunitiesOnProfile } : {}),
      ...(data.notifyEmail !== undefined ? { notifyEmail: data.notifyEmail } : {}),
      ...(data.notifyPush !== undefined ? { notifyPush: data.notifyPush } : {}),
      ...(data.notifySms !== undefined ? { notifySms: data.notifySms } : {}),
      ...(data.autoplayNextLesson !== undefined ? { autoplayNextLesson: data.autoplayNextLesson } : {}),
      ...(data.defaultResaleMinCommission !== undefined
        ? { defaultResaleMinCommission: data.defaultResaleMinCommission }
        : {}),
      ...(data.accentColor !== undefined ? { accentColor: data.accentColor } : {}),
      ...(data.fontSize !== undefined ? { fontSize: data.fontSize } : {}),
      ...(data.reduceMotion !== undefined ? { reduceMotion: data.reduceMotion } : {}),
    },
    select: SELECT,
  });

  return NextResponse.json(updated);
}
