import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resaleBundleUpdateSchema } from "@/lib/validations";
import { hasDuplicateBundleListingSet } from "@/lib/resale";

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

  const { name, description, coverImageUrl, listingIds } = parsed.data;
  const bundleFields = {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
  };
  const hasBundleFields = Object.keys(bundleFields).length > 0;

  if (listingIds) {
    const listings = await prisma.resaleListing.findMany({
      where: { id: { in: listingIds }, sellerId: session.user.id, active: true },
    });
    if (listings.length !== listingIds.length) {
      return NextResponse.json(
        { error: "Alguma listagem não existe, não te pertence ou está desativada" },
        { status: 400 }
      );
    }
    if (await hasDuplicateBundleListingSet(session.user.id, listingIds, bundleId)) {
      return NextResponse.json({ error: "Já tens um bundle com exatamente estes cursos" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.resaleBundleListing.deleteMany({ where: { resaleBundleId: bundleId, listingId: { notIn: listingIds } } }),
      ...listingIds.map((listingId) =>
        prisma.resaleBundleListing.upsert({
          where: { resaleBundleId_listingId: { resaleBundleId: bundleId, listingId } },
          update: {},
          create: { resaleBundleId: bundleId, listingId },
        })
      ),
      ...(hasBundleFields ? [prisma.resaleBundle.update({ where: { id: bundleId }, data: bundleFields })] : []),
    ]);
  } else if (hasBundleFields) {
    await prisma.resaleBundle.update({ where: { id: bundleId }, data: bundleFields });
  }

  const updated = await prisma.resaleBundle.findUnique({
    where: { id: bundleId },
    include: { listings: { include: { listing: { include: { course: { select: { slug: true, title: true } } } } } } },
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

  // Listagens sobrevivem soltas (e em quaisquer outros bundles onde também
  // estejam) — só o vínculo com este bundle desaparece, via cascade em
  // ResaleBundleListing.
  await prisma.resaleBundle.delete({ where: { id: bundleId } });
  return new NextResponse(null, { status: 204 });
}
