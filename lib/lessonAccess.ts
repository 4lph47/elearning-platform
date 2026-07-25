import { prisma } from "@/lib/db";

// Partilhado pelas rotas de comentários e de menções — mesma regra em todo
// o lado: dono/colaborador do curso, aula de free preview, ou inscrito.
export async function canAccessLesson(lessonId: string, userId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { include: { collaborators: { select: { id: true } } } } } } },
  });
  if (!lesson) return null;

  const course = lesson.module.course;
  const isOwner = course.instructorId === userId || course.collaborators.some((c) => c.id === userId);
  if (isOwner || lesson.isFreePreview) return lesson;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
  });
  return enrollment ? lesson : null;
}

export interface MentionableUser {
  id: string;
  name: string;
  image: string | null;
}

// Quem pode ser @mencionado numa aula: instrutor, colaboradores e alunos
// inscritos no curso — o mesmo universo de quem já pode ver/comentar ali,
// nunca a base de utilizadores toda (evita notificar/expor gente de fora).
export async function getMentionableUsers(lessonId: string): Promise<MentionableUser[]> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      module: {
        select: {
          course: {
            select: {
              instructor: { select: { id: true, name: true, image: true } },
              collaborators: { select: { id: true, name: true, image: true } },
              enrollments: { select: { user: { select: { id: true, name: true, image: true } } } },
            },
          },
        },
      },
    },
  });
  if (!lesson) return [];

  const course = lesson.module.course;
  const byId = new Map<string, MentionableUser>();
  for (const u of [course.instructor, ...course.collaborators, ...course.enrollments.map((e) => e.user)]) {
    byId.set(u.id, u);
  }
  return Array.from(byId.values());
}
