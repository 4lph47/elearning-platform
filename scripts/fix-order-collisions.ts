// One-off fix for order collisions caused by the old count-based `order`
// assignment (lessons/quizzes/modules created after a sibling was deleted
// could reuse an `order` already in use). Renumbers every module's lessons,
// every module's quizzes, and every course's modules to a clean 0..n-1
// sequence, preserving current relative order (ties broken by createdAt).
// Run once: npx tsx scripts/fix-order-collisions.ts
// Add --dry-run to only report what would change.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function renumberModuleLessonsAndQuizzes() {
  const modules = await prisma.module.findMany({
    select: {
      id: true,
      title: true,
      lessons: { select: { id: true, title: true, order: true, createdAt: true } },
      quizzes: { select: { id: true, title: true, order: true, createdAt: true } },
    },
  });

  let fixedModules = 0;
  for (const m of modules) {
    const merged = [
      ...m.lessons.map((l) => ({ kind: "lesson" as const, ...l })),
      ...m.quizzes.map((q) => ({ kind: "quiz" as const, ...q })),
    ].sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime());

    const orders = merged.map((e) => e.order);
    const hasCollision = new Set(orders).size !== orders.length;
    const isSequential = merged.every((e, i) => e.order === i);
    if (!hasCollision && isSequential) continue;

    fixedModules++;
    console.log(`Módulo "${m.title}" (${m.id}): reordenando ${merged.length} itens`);
    merged.forEach((e, i) => {
      if (e.order === i) return;
      console.log(`  ${e.kind} "${e.title}" (${e.id}): order ${e.order} -> ${i}`);
    });

    if (dryRun) continue;

    const updates = merged.flatMap((e, i) => {
      if (e.order === i) return [];
      return [
        e.kind === "lesson"
          ? prisma.lesson.update({ where: { id: e.id }, data: { order: i } })
          : prisma.quiz.update({ where: { id: e.id }, data: { order: i } }),
      ];
    });
    await prisma.$transaction(updates);
  }
  console.log(`Módulos corrigidos: ${fixedModules}/${modules.length}`);
}

async function renumberCourseModules() {
  const courses = await prisma.course.findMany({
    select: {
      id: true,
      title: true,
      modules: { select: { id: true, title: true, order: true } },
    },
  });

  let fixedCourses = 0;
  for (const c of courses) {
    // Module não tem createdAt — em empate usa a ordem de retorno do Prisma
    // (id/inserção), estável o suficiente para desempate.
    const sorted = [...c.modules].sort((a, b) => a.order - b.order);
    const orders = sorted.map((mo) => mo.order);
    const hasCollision = new Set(orders).size !== orders.length;
    const isSequential = sorted.every((mo, i) => mo.order === i);
    if (!hasCollision && isSequential) continue;

    fixedCourses++;
    console.log(`Curso "${c.title}" (${c.id}): reordenando ${sorted.length} módulos`);
    sorted.forEach((mo, i) => {
      if (mo.order === i) return;
      console.log(`  módulo "${mo.title}" (${mo.id}): order ${mo.order} -> ${i}`);
    });

    if (dryRun) continue;

    const updates = sorted.flatMap((mo, i) =>
      mo.order === i ? [] : [prisma.module.update({ where: { id: mo.id }, data: { order: i } })]
    );
    await prisma.$transaction(updates);
  }
  console.log(`Cursos corrigidos: ${fixedCourses}/${courses.length}`);
}

async function main() {
  if (dryRun) console.log("--- DRY RUN: nenhuma alteração será gravada ---");
  await renumberModuleLessonsAndQuizzes();
  await renumberCourseModules();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
