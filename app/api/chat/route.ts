import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MODEL = "claude-sonnet-5";
const MAX_MESSAGES = 20;
const MAX_OUTPUT_TOKENS = 600;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

// In-memory limiter — resets on server restart, per-process only. Good enough
// for a single-instance deployment; swap for a shared store (Redis, DB) if
// this ever runs across multiple instances.
const requestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(userId, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(userId, timestamps);
  return false;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (isRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: `Limite de ${RATE_LIMIT_MAX_REQUESTS} perguntas por hora atingido. Tenta novamente mais tarde.` },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { courseId, lessonId, messages } = body as {
    courseId?: string;
    lessonId?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  };

  if (!courseId || !lessonId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      instructor: { select: { name: true } },
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  const lesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  const isOwner = course.instructorId === session.user.id;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  const isEnrolled = Boolean(enrollment);
  if (!isOwner && !isEnrolled && !lesson.isFreePreview) {
    return NextResponse.json({ error: "Sem acesso a esta aula" }, { status: 403 });
  }

  const syllabus = course.modules
    .map((m, mi) => {
      const lessonLines = m.lessons.map((l, li) => `  ${mi + 1}.${li + 1} ${l.title}`).join("\n");
      return `Módulo ${mi + 1}: ${m.title}\n${lessonLines}`;
    })
    .join("\n\n");

  const systemPrompt = `És um assistente de apoio ao aluno dentro da plataforma de e-learning "E-Learn". Respondes SÓ a perguntas relacionadas com o curso abaixo — o teu contexto é exclusivo deste curso.

Curso: ${course.title}
Categoria: ${course.category} · Nível: ${course.level}
Instrutor: ${course.instructor.name}
Descrição: ${course.description}

Currículo completo do curso:
${syllabus}

Aula atual que o aluno está a ver: "${lesson.title}"

Instruções:
- Responde em português, de forma clara, curta e direta.
- Não tens acesso ao conteúdo em vídeo em si (sem transcrição) — só à estrutura do curso (títulos de módulos/aulas) e à descrição. Se a pergunta exigir detalhe do vídeo que não tens, diz isso e sugere rever a aula ou perguntar ao instrutor.
- Se a pergunta não tiver relação com este curso, explica que só podes ajudar com questões sobre este curso.
- Podes sugerir em que módulo/aula encontrar um tópico, com base no currículo acima.`;

  const trimmedMessages = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: trimmedMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
