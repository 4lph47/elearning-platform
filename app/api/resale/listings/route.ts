import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resaleListingSchema } from "@/lib/validations";
import { getResaleEligibility } from "@/lib/resale";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const listings = await prisma.resaleListing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } } },
  });
  return NextResponse.json(listings);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const body = await request.json();
  const parsed = resaleListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { courseId, price } = parsed.data;

  // Nunca confiar no preço/elegibilidade vindos do cliente — revalidar tudo
  // aqui, incluindo o mínimo definido pelo instrutor (pode ter mudado desde
  // que o formulário foi aberto).
  const eligibility = await getResaleEligibility(courseId, session.user.id);
  if (!eligibility) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
  if (!eligibility.canResell) {
    return NextResponse.json({ error: eligibility.reason ?? "Não podes revender este curso" }, { status: 403 });
  }
  if (eligibility.minCommission !== null && price < eligibility.minCommission) {
    return NextResponse.json(
      { error: `O preço tem de ser pelo menos ${eligibility.minCommission}€ (comissão mínima do instrutor)` },
      { status: 400 }
    );
  }

  try {
    const listing = await prisma.resaleListing.create({
      data: { sellerId: session.user.id, courseId, price },
    });
    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Já tens uma listagem para este curso" }, { status: 409 });
    }
    throw err;
  }
}
