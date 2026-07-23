import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GDPR direito de portabilidade — dump de tudo o que a conta autenticada
// gerou, só dela (sem where extra: cada tabela é filtrada por userId).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const userId = session.user.id;

  const [profile, enrollments, lessonProgress, quizAttempts, reviews, comments, coursesTaught, certifications] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          bio: true,
          role: true,
          createdAt: true,
          websiteUrl: true,
          twitterUrl: true,
          linkedinUrl: true,
          youtubeUrl: true,
          instagramUrl: true,
          facebookUrl: true,
          tiktokUrl: true,
          githubUrl: true,
          discordUrl: true,
          mediumUrl: true,
          twitchUrl: true,
        },
      }),
      prisma.enrollment.findMany({
        where: { userId },
        select: { courseId: true, enrolledAt: true, course: { select: { title: true } } },
      }),
      prisma.lessonProgress.findMany({
        where: { userId },
        select: { lessonId: true, completed: true, watchedSeconds: true, updatedAt: true },
      }),
      prisma.quizAttempt.findMany({
        where: { userId },
        select: { quizId: true, scorePercent: true, createdAt: true },
      }),
      prisma.review.findMany({
        where: { userId },
        select: { courseId: true, rating: true, comment: true, createdAt: true },
      }),
      prisma.lessonComment.findMany({
        where: { userId },
        select: { lessonId: true, content: true, createdAt: true },
      }),
      prisma.course.findMany({
        where: { instructorId: userId },
        select: { id: true, title: true, published: true, createdAt: true },
      }),
      prisma.certification.findMany({
        where: { userId },
        select: { name: true, url: true },
      }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    enrollments,
    lessonProgress,
    quizAttempts,
    reviews,
    comments,
    coursesTaught,
    certifications,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="e-learn-dados-${userId}.json"`,
    },
  });
}
