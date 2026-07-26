import { prisma } from "../lib/db";

async function main() {
  const student = await prisma.user.findFirst({
    where: { name: { contains: "Bruno", mode: "insensitive" }, role: "STUDENT" },
    include: {
      enrollments: {
        include: { course: { select: { id: true, title: true, resaleMinCommission: true } } },
      },
    },
  });

  if (!student) {
    console.error("Bruno (aluno) não encontrado.");
    process.exit(1);
  }

  console.log(`Aluno: ${student.name} (${student.id}), ${student.enrollments.length} inscrição(ões).`);

  const pending = student.enrollments.filter((e) => !e.completedAt);
  if (pending.length === 0) {
    console.log("Já não há inscrições por completar.");
    return;
  }

  const toComplete = pending.slice(0, 3);

  for (const e of toComplete) {
    if (e.course.resaleMinCommission === null) {
      await prisma.course.update({
        where: { id: e.course.id },
        data: { resaleMinCommission: 20 },
      });
      console.log(`Curso "${e.course.title}": revenda ativada (comissão mínima 20%).`);
    }
    await prisma.enrollment.update({
      where: { id: e.id },
      data: { completedAt: new Date() },
    });
    console.log(`Curso "${e.course.title}": marcado como concluído.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
