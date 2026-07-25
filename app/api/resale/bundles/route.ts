import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resaleBundleSchema } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const bundles = await prisma.resaleBundle.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      listings: {
        include: { course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } } },
      },
    },
  });
  return NextResponse.json(bundles);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const body = await request.json();
  const parsed = resaleBundleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { name, description, coverImageUrl, listingIds } = parsed.data;

  const listings = await prisma.resaleListing.findMany({
    where: { id: { in: listingIds }, sellerId: session.user.id, active: true, resaleBundleId: null },
  });
  if (listings.length !== listingIds.length) {
    return NextResponse.json(
      { error: "Alguma listagem não existe, não te pertence, está desativada ou já está noutro bundle" },
      { status: 400 }
    );
  }

  const bundle = await prisma.$transaction(async (tx) => {
    const created = await tx.resaleBundle.create({
      data: { name, description, coverImageUrl, sellerId: session.user.id },
    });
    await tx.resaleListing.updateMany({
      where: { id: { in: listingIds } },
      data: { resaleBundleId: created.id },
    });
    return created;
  });
  return NextResponse.json(bundle, { status: 201 });
}
