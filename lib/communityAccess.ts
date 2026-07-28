import { prisma } from "@/lib/db";

// Hierarquia: OWNER (criador, único, nunca removível/despromovível) > ADMIN
// (promovido pelo OWNER, remove/silencia MEMBER comuns, nunca mexe noutro
// ADMIN) > MEMBER. Usado por todas as rotas de gestão da comunidade para não
// repetir a mesma lógica de autorização em cada uma.
export async function getMembership(communityId: string, userId: string) {
  return prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
}

export function canModerate(role: "OWNER" | "ADMIN" | "MEMBER" | undefined | null): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export interface MentionableUser {
  id: string;
  name: string;
  username: string;
  image: string | null;
}

export async function getMentionableUsers(communityId: string): Promise<MentionableUser[]> {
  const members = await prisma.communityMember.findMany({
    where: { communityId },
    select: { user: { select: { id: true, name: true, username: true, image: true } } },
  });
  return members
    .map((m) => m.user)
    .filter((u): u is MentionableUser => Boolean(u.username))
    .map((u) => ({ id: u.id, name: u.name, username: u.username as string, image: u.image }));
}

export interface RequirementCheck {
  id: string;
  type: string;
  label: string;
  met: boolean;
}

// Verifica CADA requisito que o criador definiu para esta comunidade — usado
// tanto no ecrã de aceitação (mostra o que falta) como de novo dentro do
// próprio POST /join (nunca confia só no que já foi mostrado ao cliente).
export async function checkRequirements(communityId: string, userId: string): Promise<RequirementCheck[]> {
  const requirements = await prisma.communityRequirement.findMany({
    where: { communityId },
    include: { course: { select: { title: true } } },
  });
  if (requirements.length === 0) return [];

  return Promise.all(
    requirements.map(async (req): Promise<RequirementCheck> => {
      switch (req.type) {
        case "PURCHASED_COURSE": {
          const enrolled = req.courseId
            ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: req.courseId } } })
            : null;
          return { id: req.id, type: req.type, label: `Estar inscrito em "${req.course?.title}"`, met: Boolean(enrolled) };
        }
        case "COMPLETED_COURSE": {
          const enrolled = req.courseId
            ? await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: req.courseId } } })
            : null;
          return {
            id: req.id,
            type: req.type,
            label: `Ter terminado "${req.course?.title}"`,
            met: Boolean(enrolled?.completedAt),
          };
        }
        case "MIN_ENROLLMENTS": {
          const count = await prisma.enrollment.count({ where: { userId } });
          return {
            id: req.id,
            type: req.type,
            label: `Estar inscrito em pelo menos ${req.minValue} curso${req.minValue !== 1 ? "s" : ""}`,
            met: count >= (req.minValue ?? 0),
          };
        }
        case "MIN_COMPLETED_COURSES": {
          const count = await prisma.enrollment.count({ where: { userId, completedAt: { not: null } } });
          return {
            id: req.id,
            type: req.type,
            label: `Ter terminado pelo menos ${req.minValue} curso${req.minValue !== 1 ? "s" : ""}`,
            met: count >= (req.minValue ?? 0),
          };
        }
        case "MIN_REVIEWS": {
          const count = await prisma.review.count({ where: { userId } });
          return {
            id: req.id,
            type: req.type,
            label: `Ter escrito pelo menos ${req.minValue} avaliaç${req.minValue !== 1 ? "ões" : "ão"}`,
            met: count >= (req.minValue ?? 0),
          };
        }
        case "INSTRUCTOR_ONLY": {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
          return { id: req.id, type: req.type, label: "Ser instrutor", met: user?.role === "INSTRUCTOR" || user?.role === "ADMIN" };
        }
        case "STUDENT_ONLY": {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
          return { id: req.id, type: req.type, label: "Ser aluno", met: user?.role === "STUDENT" };
        }
        default:
          return { id: req.id, type: req.type, label: "Requisito desconhecido", met: false };
      }
    })
  );
}
