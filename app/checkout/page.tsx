import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "@/components/course/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CartCheckoutPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent("/checkout")}`);

  const enrolledIds = new Set(
    (await prisma.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } })).map(
      (e) => e.courseId
    )
  );

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: { course: { include: { instructor: { select: { name: true } } } } },
  });

  const items = cartItems
    .filter((i) => i.course.published && !enrolledIds.has(i.courseId))
    .map((i) => ({
      id: i.course.id,
      title: i.course.title,
      instructorName: i.course.instructor.name,
      price: i.course.price,
      thumbnailUrl: i.course.thumbnailUrl,
    }));

  if (items.length === 0) redirect("/cart");

  return (
    <div className="min-h-screen bg-black px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link href="/cart" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={14} /> Voltar ao carrinho
        </Link>

        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950 p-4">
              {item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailUrl} alt={item.title} className="h-14 w-20 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-14 w-20 shrink-0 rounded-md bg-slate-800" />
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{item.title}</p>
                <p className="text-sm text-slate-400">{item.instructorName}</p>
              </div>
              <p className="ml-auto shrink-0 text-lg font-bold text-white">
                {item.price === 0 ? "Grátis" : `${item.price.toFixed(2)}€`}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <CheckoutForm items={items} firstLessonHref="/dashboard" />
        </div>
      </div>
    </div>
  );
}
