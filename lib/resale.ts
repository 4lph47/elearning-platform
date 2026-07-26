import type { Prisma } from "@prisma/client";
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

// Impede dois bundles do mesmo vendedor com o conjunto de listagens
// exatamente igual — bundles parcialmente sobrepostos (ex.: {1,2,3} e
// {1,2,4}) são permitidos, só o conjunto idêntico é que não faz sentido
// (seria o mesmo bundle duplicado).
export async function hasDuplicateBundleListingSet(
  sellerId: string,
  listingIds: string[],
  excludeBundleId?: string
): Promise<boolean> {
  const sortedTarget = [...listingIds].sort().join(",");
  const bundles = await prisma.resaleBundle.findMany({
    where: { sellerId, ...(excludeBundleId ? { id: { not: excludeBundleId } } : {}) },
    include: { listings: { select: { listingId: true } } },
  });
  return bundles.some((b) => b.listings.map((l) => l.listingId).sort().join(",") === sortedTarget);
}

// Chamado quando o instrutor SOBE a comissão mínima de um curso (nunca em
// descidas — aí o revendedor só fica a ganhar, não há nada a proteger).
// Para cada listagem já existente: se a nova comissão ainda não alcançou o
// preço da listagem, só a parte do revendedor encolhe (preço fica igual, já
// é >= comissão). Mas se a nova comissão alcançar ou passar o preço, sobe o
// preço da listagem o suficiente para preservar a mesma parte em euros que o
// revendedor já tinha — nunca deixa a comissão "comer" o que já era dele.
// ResaleBundle não precisa de tratamento à parte: o preço dele é sempre a
// soma ao vivo das suas listagens (ver app/resale/bundles/[bundleId]/page.tsx).
export async function cascadeCommissionIncrease(
  tx: Prisma.TransactionClient,
  params: { courseId: string; courseTitle: string; instructorId: string; oldCommission: number; newCommission: number }
) {
  const { courseId, courseTitle, instructorId, oldCommission, newCommission } = params;
  if (newCommission <= oldCommission) return;

  const listings = await tx.resaleListing.findMany({
    where: { courseId },
    select: { id: true, price: true, sellerId: true },
  });
  if (listings.length === 0) return;

  const notifications: Prisma.NotificationCreateManyInput[] = [];
  for (const listing of listings) {
    const sellerCut = listing.price - Math.min(oldCommission, listing.price);
    const bump = newCommission >= listing.price;
    const newPrice = bump ? newCommission + sellerCut : null;

    if (bump && newPrice !== null) {
      await tx.resaleListing.update({ where: { id: listing.id }, data: { price: newPrice } });
    }

    notifications.push({
      type: "RESALE_COMMISSION_CHANGE",
      recipientId: listing.sellerId,
      actorId: instructorId,
      resaleCourseTitle: courseTitle,
      resaleOldCommission: oldCommission,
      resaleNewCommission: newCommission,
      resaleOldPrice: bump ? listing.price : null,
      resaleNewPrice: newPrice,
    });
  }

  await tx.notification.createMany({ data: notifications });
}
