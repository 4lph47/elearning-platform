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
  username: string;
  image: string | null;
}

const MENTIONABLE_LIMIT = 8;

// Quem pode ser @mencionado numa aula: instrutor, colaboradores e alunos
// inscritos no curso — o mesmo universo de quem já pode ver/comentar ali,
// nunca a base de utilizadores toda (evita notificar/expor gente de fora).
// Quem ainda não escolheu username (registo por completar) fica de fora —
// não há tag nenhuma para inserir. Filtra e limita já na query — nunca
// carrega a lista de inscritos toda para depois cortar em memória.
export async function getMentionableUsers(
  lessonId: string,
  query: string,
  excludeUserId: string
): Promise<MentionableUser[]> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { course: { select: { id: true, instructorId: true } } } } },
  });
  if (!lesson) return [];

  const { id: courseId, instructorId } = lesson.module.course;

  const users = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      username: { not: null },
      OR: [{ id: instructorId }, { collaboratingCourses: { some: { id: courseId } } }, { enrollments: { some: { courseId } } }],
      ...(query
        ? { AND: [{ OR: [{ name: { contains: query, mode: "insensitive" } }, { username: { contains: query, mode: "insensitive" } }] }] }
        : {}),
    },
    select: { id: true, name: true, username: true, image: true },
    orderBy: { name: "asc" },
    take: MENTIONABLE_LIMIT,
  });

  return users as MentionableUser[];
}

// Valida ids de @menção já escritos num comentário (não a busca do
// dropdown) — sem limite nem texto de query, só filtra quem de facto pode
// ser mencionado nesta aula, para nunca notificar um id fabricado à mão.
export async function filterMentionableUserIds(lessonId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { course: { select: { id: true, instructorId: true } } } } },
  });
  if (!lesson) return [];

  const { id: courseId, instructorId } = lesson.module.course;
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      OR: [{ id: instructorId }, { collaboratingCourses: { some: { id: courseId } } }, { enrollments: { some: { courseId } } }],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
