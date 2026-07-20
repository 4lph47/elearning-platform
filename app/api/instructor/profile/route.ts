import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const urlField = z
  .string()
  .max(300, "Link deve ter no máximo 300 caracteres")
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Link deve começar com http:// ou https://")
  .optional()
  .nullable();

const profileSchema = z.object({
  bio: z.string().max(600, "Bio deve ter no máximo 600 caracteres").optional().nullable(),
  websiteUrl: urlField,
  twitterUrl: urlField,
  linkedinUrl: urlField,
  youtubeUrl: urlField,
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

  const { bio, websiteUrl, twitterUrl, linkedinUrl, youtubeUrl } = parsed.data;
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      bio: bio?.trim() || null,
      websiteUrl: websiteUrl?.trim() || null,
      twitterUrl: twitterUrl?.trim() || null,
      linkedinUrl: linkedinUrl?.trim() || null,
      youtubeUrl: youtubeUrl?.trim() || null,
    },
  });

  return NextResponse.json({
    bio: updated.bio,
    websiteUrl: updated.websiteUrl,
    twitterUrl: updated.twitterUrl,
    linkedinUrl: updated.linkedinUrl,
    youtubeUrl: updated.youtubeUrl,
  });
}
