import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMembership, getMentionableUsers } from "@/lib/communityAccess";

const MAX_RESULTS = 8;

export async function GET(request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Só membros veem esta comunidade" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const candidates = await getMentionableUsers(communityId);
  const users = candidates
    .filter(
      (u) =>
        u.id !== session.user.id &&
        (query === "" || u.name.toLowerCase().includes(query) || u.username.toLowerCase().includes(query))
    )
    .slice(0, MAX_RESULTS);

  return NextResponse.json({ users });
}
