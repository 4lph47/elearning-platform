import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resaleListingUpdateSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { listingId } = await params;
  const body = await request.json();
  const parsed = resaleListingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const listing = await prisma.resaleListing.findUnique({
    where: { id: listingId },
    include: { course: { select: { resaleMinCommission: true } } },
  });
  if (!listing || listing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Listagem não encontrada" }, { status: 404 });
  }

  const { price, active } = parsed.data;
  const minCommission = listing.course.resaleMinCommission;
  if (price !== undefined && minCommission !== null && price < minCommission) {
    return NextResponse.json(
      { error: `O preço tem de ser pelo menos ${minCommission}€ (comissão mínima do instrutor)` },
      { status: 400 }
    );
  }

  const updated = await prisma.resaleListing.update({
    where: { id: listingId },
    data: { ...(price !== undefined ? { price } : {}), ...(active !== undefined ? { active } : {}) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { listingId } = await params;
  const listing = await prisma.resaleListing.findUnique({
    where: { id: listingId },
    include: { _count: { select: { sales: true } } },
  });
  if (!listing || listing.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Listagem não encontrada" }, { status: 404 });
  }

  // Preserva o histórico de vendas (ResaleSale) para a contabilidade de
  // comissões do instrutor — só apaga mesmo se nunca vendeu.
  if (listing._count.sales === 0) {
    await prisma.resaleListing.delete({ where: { id: listingId } });
    return new NextResponse(null, { status: 204 });
  }
  const updated = await prisma.resaleListing.update({ where: { id: listingId }, data: { active: false } });
  return NextResponse.json(updated);
}
