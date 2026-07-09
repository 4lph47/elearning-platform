import type { Session } from "next-auth";
import { prisma } from "@/lib/db";

function canManage(session: Session) {
  return session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN";
}

export async function getOwnedCourse(courseId: string, session: Session) {
  if (!canManage(session)) return null;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return null;
  if (course.instructorId !== session.user.id && session.user.role !== "ADMIN") return null;
  return course;
}

export async function getOwnedModule(moduleId: string, session: Session) {
  if (!canManage(session)) return null;
  const courseModule = await prisma.module.findUnique({ where: { id: moduleId }, include: { course: true } });
  if (!courseModule) return null;
  if (courseModule.course.instructorId !== session.user.id && session.user.role !== "ADMIN") return null;
  return courseModule;
}

export async function getOwnedLesson(lessonId: string, session: Session) {
  if (!canManage(session)) return null;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) return null;
  if (lesson.module.course.instructorId !== session.user.id && session.user.role !== "ADMIN") return null;
  return lesson;
}
