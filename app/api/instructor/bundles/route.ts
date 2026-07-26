import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { bundleSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const body = await request.json();
  const parsed = bundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, category, courseIds } = parsed.data;

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds }, instructorId: session.user.id, bundleId: null },
  });
  if (courses.length !== courseIds.length) {
    return NextResponse.json(
      { error: "Algum curso não existe, não te pertence ou já está noutro bundle" },
      { status: 400 }
    );
  }

  const bundle = await prisma.$transaction(async (tx) => {
    const created = await tx.bundle.create({ data: { name, category, instructorId: session.user.id } });
    await tx.course.updateMany({ where: { id: { in: courseIds } }, data: { bundleId: created.id } });
    return created;
  });
  return NextResponse.json(bundle, { status: 201 });
}
