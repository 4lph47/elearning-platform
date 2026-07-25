import { prisma } from "@/lib/db";

export interface ResaleEligibility {
  canResell: boolean;
  reason?: string;
  minCommission: number | null;
  courseTitle: string;
}

// Quem pode listar um curso para revenda: está inscrito nele (comprou ou
// foi inscrito por outra via), não é o próprio instrutor desse curso (não
// faz sentido "revender" o que já se publica a 100% pra si), e o instrutor
// ligou a revenda (resaleMinCommission não-nulo) para esse curso.
export async function getResaleEligibility(courseId: string, userId: string): Promise<ResaleEligibility | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      instructorId: true,
      resaleMinCommission: true,
      collaborators: { select: { id: true } },
    },
  });
  if (!course) return null;

  const isInstructorOrCollaborator =
    course.instructorId === userId || course.collaborators.some((c) => c.id === userId);
  if (isInstructorOrCollaborator) {
    return { canResell: false, reason: "Não podes revender um curso que dás", minCommission: null, courseTitle: course.title };
  }
  if (course.resaleMinCommission === null) {
    return { canResell: false, reason: "O instrutor não ativou a revenda deste curso", minCommission: null, courseTitle: course.title };
  }
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment) {
    return { canResell: false, reason: "Precisas de estar inscrito para revender", minCommission: course.resaleMinCommission, courseTitle: course.title };
  }
  if (!enrollment.completedAt) {
    return { canResell: false, reason: "Precisas de terminar o curso para revender", minCommission: course.resaleMinCommission, courseTitle: course.title };
  }
  return { canResell: true, minCommission: course.resaleMinCommission, courseTitle: course.title };
}

// Divide o preço da venda entre instrutor (o mínimo que pediu, nunca mais
// que o preço de venda — protege contra o instrutor subir o mínimo depois
// da listagem já existir) e o revendedor (o resto).
export function splitResalePrice(price: number, instructorMinCommission: number) {
  const instructorCut = Math.min(instructorMinCommission, price);
  const sellerCut = price - instructorCut;
  return { instructorCut, sellerCut };
}
