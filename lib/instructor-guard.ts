import type { Session } from "next-auth";
import { prisma } from "@/lib/db";

function canManage(session: Session) {
  return session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN";
}

function isCourseAuthor(course: { instructorId: string; collaborators: { id: string }[] }, session: Session) {
  return (
    course.instructorId === session.user.id ||
    course.collaborators.some((c) => c.id === session.user.id) ||
    session.user.role === "ADMIN"
  );
}

export async function getOwnedCourse(courseId: string, session: Session) {
  if (!canManage(session)) return null;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { collaborators: { select: { id: true } } },
  });
  if (!course) return null;
  if (!isCourseAuthor(course, session)) return null;
  return course;
}

export async function getOwnedModule(moduleId: string, session: Session) {
  if (!canManage(session)) return null;
  const courseModule = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { include: { collaborators: { select: { id: true } } } } },
  });
  if (!courseModule) return null;
  if (!isCourseAuthor(courseModule.course, session)) return null;
  return courseModule;
}

export async function getOwnedLesson(lessonId: string, session: Session) {
  if (!canManage(session)) return null;
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { include: { collaborators: { select: { id: true } } } } } } },
  });
  if (!lesson) return null;
  if (!isCourseAuthor(lesson.module.course, session)) return null;
  return lesson;
}
