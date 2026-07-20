import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CartList } from "@/components/course/CartList";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent("/cart")}`);

  const enrolledIds = new Set(
    (await prisma.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } })).map(
      (e) => e.courseId
    )
  );

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      course: {
        include: { instructor: { select: { name: true } } },
      },
    },
  });

  const staleIds = cartItems.filter((i) => !i.course.published || enrolledIds.has(i.courseId)).map((i) => i.courseId);
  if (staleIds.length > 0) {
    await prisma.cartItem.deleteMany({ where: { userId: session.user.id, courseId: { in: staleIds } } });
  }

  const items = cartItems
    .filter((i) => i.course.published && !enrolledIds.has(i.courseId))
    .map((i) => ({
      id: i.course.id,
      slug: i.course.slug,
      title: i.course.title,
      thumbnailUrl: i.course.thumbnailUrl,
      price: i.course.price,
      instructorName: i.course.instructor.name,
    }));

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/courses"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Continuar a explorar cursos
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">O meu carrinho</h1>

        <div className="mt-6">
          <CartList items={items} />
        </div>
      </div>
    </div>
  );
}
