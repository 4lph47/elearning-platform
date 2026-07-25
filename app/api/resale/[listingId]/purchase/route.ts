import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { splitResalePrice } from "@/lib/resale";

export async function POST(_request: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { listingId } = await params;
  const listing = await prisma.resaleListing.findUnique({
    where: { id: listingId },
    include: { course: { select: { id: true, published: true, resaleMinCommission: true } } },
  });
  if (!listing || !listing.active) return NextResponse.json({ error: "Listagem não encontrada" }, { status: 404 });
  if (!listing.course.published) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
  if (listing.sellerId === session.user.id) {
    return NextResponse.json({ error: "Não podes comprar a tua própria listagem" }, { status: 403 });
  }
  // Instrutor pode desligar a revenda a qualquer momento (Course.resaleMinCommission
  // = null) — vendas já feitas não são desfeitas, mas nenhuma venda NOVA
  // acontece enquanto estiver desligada. A listagem em si não é apagada nem
  // escondida à força: o vendedor é que escolhe mostrar/esconder no seu
  // perfil e no marketplace (ver ManageResaleSection "desativar").
  if (listing.course.resaleMinCommission === null) {
    return NextResponse.json({ error: "O instrutor desativou a revenda deste curso" }, { status: 403 });
  }

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: listing.course.id } },
  });
  if (existingEnrollment) {
    return NextResponse.json({ error: "Já estás inscrito neste curso" }, { status: 409 });
  }

  const { instructorCut, sellerCut } = splitResalePrice(listing.price, listing.course.resaleMinCommission ?? 0);

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.resaleSale.create({
      data: { price: listing.price, instructorCut, sellerCut, listingId: listing.id, buyerId: session.user.id },
    });
    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: session.user.id, courseId: listing.course.id } },
      update: {},
      create: { userId: session.user.id, courseId: listing.course.id },
    });
    return created;
  });

  return NextResponse.json(sale, { status: 201 });
}
