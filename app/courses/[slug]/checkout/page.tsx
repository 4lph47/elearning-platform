import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "@/components/course/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bundle?: string }>;
}) {
  const { slug } = await params;
  const { bundle } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/courses/${slug}/checkout${bundle ? `?bundle=${bundle}` : ""}`)}`);
  }

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { name: true } },
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, select: { id: true } } },
      },
    },
  });
  if (!course || !course.published) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  const firstLesson = course.modules.flatMap((m) => m.lessons)[0];
  const firstLessonHref = firstLesson ? `/courses/${slug}/lessons/${firstLesson.id}` : `/courses/${slug}`;

  const bundleIds = bundle ? bundle.split(",").filter(Boolean) : [];
  const extraCourses = bundleIds.length
    ? await prisma.course.findMany({
        where: { id: { in: bundleIds, not: course.id }, published: true },
        include: { instructor: { select: { name: true } } },
      })
    : [];
  const extraEnrollments = extraCourses.length
    ? await prisma.enrollment.findMany({
        where: { userId: session.user.id, courseId: { in: extraCourses.map((c) => c.id) } },
        select: { courseId: true },
      })
    : [];
  const extraEnrolledIds = new Set(extraEnrollments.map((e) => e.courseId));

  const items = [
    ...(enrollment ? [] : [{ id: course.id, title: course.title, instructorName: course.instructor.name, price: course.price, thumbnailUrl: course.thumbnailUrl }]),
    ...extraCourses
      .filter((c) => !extraEnrolledIds.has(c.id))
      .map((c) => ({ id: c.id, title: c.title, instructorName: c.instructor.name, price: c.price, thumbnailUrl: c.thumbnailUrl })),
  ];

  if (items.length === 0) redirect(firstLessonHref);
  if (items.length === 1 && items[0].price === 0 && items[0].id === course.id) redirect(`/courses/${slug}`);

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link
          href={`/courses/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Voltar ao curso
        </Link>

        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
            >
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailUrl} alt={item.title} className="h-14 w-20 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-14 w-20 shrink-0 rounded-md bg-slate-200 dark:bg-slate-800" />
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.instructorName}</p>
              </div>
              <p className="ml-auto shrink-0 text-lg font-bold text-slate-900 dark:text-white">
                {item.price === 0 ? "Grátis" : `${item.price.toFixed(2)}€`}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <CheckoutForm items={items} firstLessonHref={firstLessonHref} />
        </div>
      </div>
    </div>
  );
}
