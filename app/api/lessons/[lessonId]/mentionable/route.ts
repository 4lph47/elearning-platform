import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessLesson, getMentionableUsers } from "@/lib/lessonAccess";

const MAX_RESULTS = 8;

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await canAccessLesson(lessonId, session.user.id);
  if (!lesson) return NextResponse.json({ error: "Não tens acesso a esta aula" }, { status: 403 });

  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const candidates = await getMentionableUsers(lessonId);
  const users = candidates
    .filter((u) => u.id !== session.user.id && (query === "" || u.name.toLowerCase().includes(query)))
    .slice(0, MAX_RESULTS);

  return NextResponse.json({ users });
}
