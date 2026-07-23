import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { courseSchema, zodIssueMessages } from "@/lib/validations";
import { slugify } from "@/lib/slug";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message, issues: zodIssueMessages(parsed.error) },
      { status: 400 }
    );
  }

  const baseSlug = slugify(parsed.data.title) || "curso";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const course = await prisma.course.create({
    data: {
      ...parsed.data,
      slug,
      instructorId: session.user.id,
    },
  });

  revalidateTag("courses");
  return NextResponse.json(course, { status: 201 });
}
