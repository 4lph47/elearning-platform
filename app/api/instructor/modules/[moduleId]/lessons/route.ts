import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lessonSchema, validateLessonContent, zodIssueMessages } from "@/lib/validations";
import { getOwnedModule } from "@/lib/instructor-guard";
import { syncCourseThumbnail } from "@/lib/courseThumbnail";
import { needsTranscode, requeueTranscode, isProcessedHlsUrl } from "@/lib/videoTranscode";

export async function POST(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { moduleId } = await params;
  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = lessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message, issues: zodIssueMessages(parsed.error) },
      { status: 400 }
    );
  }
  const contentError = validateLessonContent(parsed.data);
  if (contentError) {
    return NextResponse.json({ error: contentError, issues: [contentError] }, { status: 400 });
  }

  const authorIds = new Set([courseModule.course.instructorId, ...courseModule.course.collaborators.map((c) => c.id)]);
  const contributorIds: string[] = Array.isArray(body.contributorIds)
    ? body.contributorIds.filter((id: unknown): id is string => typeof id === "string" && authorIds.has(id))
    : [];

  const lesson = await prisma.lesson.create({
    data: {
      ...parsed.data,
      hlsMasterUrl: isProcessedHlsUrl(parsed.data.contentUrl) ? parsed.data.contentUrl : null,
      moduleId,
      contributors: contributorIds.length > 0 ? { connect: contributorIds.map((id) => ({ id })) } : undefined,
    },
  });
  await syncCourseThumbnail(courseModule.course.id);
  if (needsTranscode(lesson.type, lesson.contentUrl)) {
    await requeueTranscode(lesson.id, lesson.contentUrl);
  }
  revalidateTag("courses");

  return NextResponse.json(lesson, { status: 201 });
}
