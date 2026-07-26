import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { communitySchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const parsed = communitySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { requirements, ...data } = parsed.data;
  const community = await prisma.community.create({
    data: {
      ...data,
      createdById: session.user.id,
      members: { create: { userId: session.user.id, role: "OWNER" } },
      ...(requirements && requirements.length > 0 ? { requirements: { create: requirements } } : {}),
    },
  });

  return NextResponse.json(community, { status: 201 });
}
