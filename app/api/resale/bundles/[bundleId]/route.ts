import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resaleBundleUpdateSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { bundleId } = await params;
  const body = await request.json();
  const parsed = resaleBundleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const bundle = await prisma.resaleBundle.findUnique({ where: { id: bundleId } });
  if (!bundle || bundle.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Bundle não encontrado" }, { status: 404 });
  }

  const { name, listingIds } = parsed.data;

  if (listingIds) {
    const listings = await prisma.resaleListing.findMany({
      where: {
        id: { in: listingIds },
        sellerId: session.user.id,
        active: true,
        OR: [{ resaleBundleId: null }, { resaleBundleId: bundleId }],
      },
    });
    if (listings.length !== listingIds.length) {
      return NextResponse.json(
        { error: "Alguma listagem não existe, não te pertence, está desativada ou já está noutro bundle" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.resaleListing.updateMany({
        where: { resaleBundleId: bundleId, id: { notIn: listingIds } },
        data: { resaleBundleId: null },
      }),
      prisma.resaleListing.updateMany({
        where: { id: { in: listingIds } },
        data: { resaleBundleId: bundleId },
      }),
      ...(name !== undefined ? [prisma.resaleBundle.update({ where: { id: bundleId }, data: { name } })] : []),
    ]);
  } else if (name !== undefined) {
    await prisma.resaleBundle.update({ where: { id: bundleId }, data: { name } });
  }

  const updated = await prisma.resaleBundle.findUnique({
    where: { id: bundleId },
    include: { listings: { include: { course: { select: { slug: true, title: true } } } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { bundleId } = await params;
  const bundle = await prisma.resaleBundle.findUnique({ where: { id: bundleId } });
  if (!bundle || bundle.sellerId !== session.user.id) {
    return NextResponse.json({ error: "Bundle não encontrado" }, { status: 404 });
  }

  // Listagens sobrevivem soltas — resaleBundleId é SetNull no schema, mas
  // fazemos explícito aqui dentro da mesma transação do delete por clareza.
  await prisma.$transaction([
    prisma.resaleListing.updateMany({ where: { resaleBundleId: bundleId }, data: { resaleBundleId: null } }),
    prisma.resaleBundle.delete({ where: { id: bundleId } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
