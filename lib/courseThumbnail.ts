import { prisma } from "@/lib/db";

// Card do curso (principal, catálogo, etc.) usa sempre course.thumbnailUrl —
// mas quem o instrutor escolhe de facto é o thumbnail de cada aula de vídeo.
// Esta função mantém os dois sincronizados: o thumbnail da primeira aula do
// primeiro módulo (por order) "sobe" para o curso sempre que aulas/módulos
// mudam (criar, editar, eliminar, reordenar).
export async function syncCourseThumbnail(courseId: string) {
  const firstModule = await prisma.module.findFirst({
    where: { courseId },
    orderBy: { order: "asc" },
    select: {
      lessons: { orderBy: { order: "asc" }, take: 1, select: { thumbnailUrl: true } },
    },
  });

  const thumbnailUrl = firstModule?.lessons[0]?.thumbnailUrl ?? null;
  await prisma.course.update({ where: { id: courseId }, data: { thumbnailUrl } });
}
