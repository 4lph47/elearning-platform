import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronDown, CheckCircle2, Lock, Video, ListChecks, Paperclip, Infinity as InfinityIcon, HelpCircle } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card } from "@/components/ui/Card";
import { EnrollButton } from "@/components/course/EnrollButton";
import { StarRating } from "@/components/ui/StarRating";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { name: true } },
      quiz: { select: { id: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          quiz: { select: { id: true } },
          lessons: { orderBy: { order: "asc" }, include: { _count: { select: { resources: true } } } },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course || (!course.published && course.instructorId !== session?.user.id)) {
    notFound();
  }

  const enrollment = session
    ? await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
      })
    : null;

  const isEnrolled = Boolean(enrollment);
  const isOwner = session?.user.id === course.instructorId;
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const firstLesson = allLessons[0];
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
  const totalResources = allLessons.reduce((sum, l) => sum + l._count.resources, 0);

  return (
    <div>
      <div className="border-b border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2">
              <Badge>{course.category}</Badge>
              {!course.published && <Badge tone="warning">Rascunho</Badge>}
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{course.title}</h1>
            <p className="mt-3 text-slate-300">{course.description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {course.ratingCount > 0 && <StarRating rating={course.rating} count={course.ratingCount} />}
              <span className="text-slate-400">
                {course._count.enrollments} aluno{course._count.enrollments !== 1 ? "s" : ""} matriculado
                {course._count.enrollments !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Criado por <span className="font-medium text-slate-200">{course.instructor.name}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">Conteúdo do curso</h2>
            <p className="-mt-2 text-sm text-slate-500">
              {course.modules.length} módulos · {allLessons.length} aulas · {formatDuration(totalDuration)} de vídeo
            </p>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
              {course.modules.map((module, mi) => {
                const moduleDuration = module.lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
                const quizAccessible = isEnrolled || isOwner;
                return (
                  <div key={module.id}>
                    <details open={mi === 0} className="group bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 px-4 py-3 hover:bg-slate-100">
                        <span className="font-medium text-slate-800">
                          Módulo {mi + 1} · {module.title}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {module.lessons.length} aulas · {formatDuration(moduleDuration)}
                          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <ul className="divide-y divide-slate-100">
                        {module.lessons.map((lesson) => {
                          const accessible = isEnrolled || isOwner || lesson.isFreePreview;
                          const content = (
                            <div className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 size={16} className="shrink-0 text-slate-300" />
                                <span className={accessible ? "text-slate-800" : "text-slate-400"}>
                                  {lesson.title}
                                </span>
                                {lesson.isFreePreview && <Badge tone="success">Preview grátis</Badge>}
                              </span>
                              <span className="flex items-center gap-2 text-xs text-slate-400">
                                {lesson.durationSeconds ? formatDuration(lesson.durationSeconds) : ""}
                                {!accessible && <Lock size={14} />}
                              </span>
                            </div>
                          );

                          return (
                            <li key={lesson.id}>
                              {accessible ? (
                                <Link href={`/courses/${course.slug}/lessons/${lesson.id}`}>{content}</Link>
                              ) : (
                                content
                              )}
                            </li>
                          );
                        })}

                        {module.quiz && (
                          <li>
                            {quizAccessible ? (
                              <Link href={`/courses/${course.slug}/quiz/${module.quiz.id}`}>
                                <div className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50">
                                  <span className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="shrink-0 text-slate-300" />
                                    <span className="text-slate-800">Quiz · {module.title}</span>
                                  </span>
                                </div>
                              </Link>
                            ) : (
                              <div className="flex items-center justify-between px-4 py-3 text-sm">
                                <span className="flex items-center gap-2">
                                  <CheckCircle2 size={16} className="shrink-0 text-slate-300" />
                                  <span className="text-slate-400">Quiz · {module.title}</span>
                                </span>
                                <Lock size={14} className="text-slate-400" />
                              </div>
                            )}
                          </li>
                        )}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Card className="sticky top-20 overflow-hidden p-0 shadow-md">
              {course.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnailUrl} alt={course.title} className="h-40 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="mb-3 text-2xl font-bold text-slate-900">
                  {course.price === 0 ? "Grátis" : `${course.price.toFixed(2)}€`}
                </p>

                {isOwner ? (
                  <Link href={`/instructor/courses/${course.id}`}>
                    <p className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100">
                      Editar este curso
                    </p>
                  </Link>
                ) : isEnrolled ? (
                  <Link href={firstLesson ? `/courses/${course.slug}/lessons/${firstLesson.id}` : "#"}>
                    <p className="rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700">
                      Continuar curso
                    </p>
                  </Link>
                ) : (
                  <EnrollButton
                    courseId={course.id}
                    isAuthenticated={Boolean(session)}
                    firstLessonHref={firstLesson ? `/courses/${course.slug}/lessons/${firstLesson.id}` : "#"}
                  />
                )}

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Este curso inclui
                </p>
                <dl className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Video size={16} className="text-slate-400" />
                    <span>{formatDuration(totalDuration)} de vídeo sob demanda</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ListChecks size={16} className="text-slate-400" />
                    <span>{allLessons.length} aulas</span>
                  </div>
                  {totalResources > 0 && (
                    <div className="flex items-center gap-2">
                      <Paperclip size={16} className="text-slate-400" />
                      <span>{totalResources} materiais de apoio para download</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <InfinityIcon size={16} className="text-slate-400" />
                    <span>Acesso vitalício</span>
                  </div>
                </dl>

                {course.quiz && (
                  <>
                    {isEnrolled || isOwner ? (
                      <Link
                        href={`/courses/${course.slug}/quiz/${course.quiz.id}`}
                        className="mt-4 flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <HelpCircle size={16} />
                        Fazer teste final do curso
                      </Link>
                    ) : (
                      <p className="mt-4 flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-center text-sm text-slate-400">
                        <Lock size={14} />
                        Teste final do curso (matricula-te para aceder)
                      </p>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
