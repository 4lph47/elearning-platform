import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { splitResalePrice } from "@/lib/resale";

export async function POST(_request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { bundleId } = await params;
  const bundle = await prisma.resaleBundle.findUnique({
    where: { id: bundleId },
    include: {
      listings: {
        where: { active: true },
        include: { course: { select: { id: true, published: true, resaleMinCommission: true } } },
      },
    },
  });
  if (!bundle || bundle.listings.length === 0) {
    return NextResponse.json({ error: "Bundle não encontrado" }, { status: 404 });
  }
  if (bundle.sellerId === session.user.id) {
    return NextResponse.json({ error: "Não podes comprar o teu próprio bundle" }, { status: 403 });
  }
  if (bundle.listings.some((l) => !l.course.published)) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
  }
  // Mesma regra do purchase de listing avulso — instrutor pode desligar a
  // revenda a qualquer momento; bloqueia o bundle inteiro (tudo ou nada) se
  // algum dos cursos já não permitir revenda.
  if (bundle.listings.some((l) => l.course.resaleMinCommission === null)) {
    return NextResponse.json({ error: "Um dos cursos deste bundle já não permite revenda" }, { status: 403 });
  }

  const courseIds = bundle.listings.map((l) => l.course.id);
  const existingEnrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id, courseId: { in: courseIds } },
    select: { courseId: true },
  });
  if (existingEnrollments.length > 0) {
    return NextResponse.json({ error: "Já estás inscrito num dos cursos deste bundle" }, { status: 409 });
  }

  const sales = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const listing of bundle.listings) {
      const { instructorCut, sellerCut } = splitResalePrice(listing.price, listing.course.resaleMinCommission ?? 0);
      created.push(
        await tx.resaleSale.create({
          data: {
            price: listing.price,
            instructorCut,
            sellerCut,
            listingId: listing.id,
            buyerId: session.user.id,
            resaleBundleId: bundle.id,
          },
        })
      );
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: session.user.id, courseId: listing.course.id } },
        update: {},
        create: { userId: session.user.id, courseId: listing.course.id },
      });
    }
    return created;
  });

  return NextResponse.json(sales, { status: 201 });
}
