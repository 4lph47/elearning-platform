import { prisma } from "../lib/db";

// Comunidades de demonstração — a funcionalidade (app/communities) nasceu
// vazia (0 linhas na tabela), isto povoa umas quantas com dados realistas
// (dono aluno OU instrutor, algumas com requisitos de entrada, mensagens de
// exemplo) para a listagem/categorias não aparecerem em branco.
function avatarUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}-avatar/200/200`;
}
function bannerUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}-banner/1200/400`;
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true } });
  const byName = (name: string) => {
    const u = users.find((u) => u.name.startsWith(name));
    if (!u) throw new Error(`Utilizador seed não encontrado: ${name}`);
    return u;
  };

  const courses = await prisma.course.findMany({ select: { id: true, slug: true } });
  const bySlug = (slug: string) => {
    const c = courses.find((c) => c.slug === slug);
    if (!c) throw new Error(`Curso seed não encontrado: ${slug}`);
    return c;
  };

  const anaId = byName("Ana Rodrigues").id;
  const carlosId = byName("Carlos Mendes").id;
  const brunoId = byName("Bruno Aluno").id;
  const sofiaId = byName("Sofia Ferreira").id;
  const migueId = byName("Miguel Santos").id;
  const carlaId = byName("Carla Nunes").id;
  const tiagoId = byName("Tiago Silva").id;
  const beatrizId = byName("Beatriz Costa").id;

  interface Seed {
    key: string;
    name: string;
    category: string;
    description: string;
    rules: string;
    creatorId: string;
    admins?: string[];
    members?: string[];
    requirements?: { type: "PURCHASED_COURSE" | "COMPLETED_COURSE" | "MIN_ENROLLMENTS"; courseSlug?: string; minValue?: number }[];
    messages: { senderId: string; content: string }[];
  }

  const seeds: Seed[] = [
    {
      key: "devs-pt",
      name: "Devs em Português",
      category: "Programação",
      description: "Comunidade para trocar dúvidas e projetos entre alunos e instrutores que programam em português.",
      rules: "Sê respeitoso. Sem spam. Perguntas de código são bem-vindas, cola sempre o erro completo.",
      creatorId: carlosId,
      admins: [anaId],
      members: [brunoId, sofiaId, migueId],
      messages: [
        { senderId: carlosId, content: "Bem-vindos! Fiquem à vontade para partilhar o que estão a construir." },
        { senderId: brunoId, content: "Alguém já usou Server Actions do Next.js em produção?" },
        { senderId: sofiaId, content: "Eu uso, funciona bem para forms simples 👍" },
      ],
    },
    {
      key: "fotografos-amadores",
      name: "Fotógrafos Amadores",
      category: "Fotografia",
      description: "Partilha as tuas fotos, pede feedback e descobre técnicas novas com outros fotógrafos amadores.",
      rules: "Só fotos tiradas por ti. Feedback construtivo, nada de comentários agressivos.",
      creatorId: anaId,
      members: [carlaId, tiagoId],
      messages: [
        { senderId: anaId, content: "Desafio da semana: tirem uma foto só com luz natural e partilhem aqui." },
        { senderId: carlaId, content: "Adoro esta ideia, vou tentar ao pôr do sol." },
      ],
    },
    {
      key: "investir-do-zero",
      name: "Investir do Zero",
      category: "Finanças Pessoais",
      description: "Aprende os primeiros passos em investimentos e educação financeira com quem já está a estudar o tema.",
      rules: "Isto não é aconselhamento financeiro profissional — partilha experiências, não recomendações de compra.",
      creatorId: migueId,
      admins: [],
      members: [beatrizId],
      requirements: [{ type: "MIN_ENROLLMENTS", minValue: 1 }],
      messages: [{ senderId: migueId, content: "Alguém já fez o curso de Educação Financeira do Zero? Vale a pena?" }],
    },
    {
      key: "marketing-na-pratica",
      name: "Marketing na Prática",
      category: "Marketing",
      description: "Grupo para quem está a aplicar marketing digital no dia a dia — casos reais, dúvidas e boas práticas.",
      rules: "Podes divulgar o teu trabalho uma vez por semana, sem spam constante.",
      creatorId: carlosId,
      members: [sofiaId, tiagoId],
      requirements: [{ type: "PURCHASED_COURSE", courseSlug: "marketing-digital-do-zero" }],
      messages: [{ senderId: carlosId, content: "Grupo criado para quem tirou o curso de Marketing Digital do Zero. Boas trocas!" }],
    },
    {
      key: "cozinheiros-fim-de-semana",
      name: "Cozinheiros de Fim de Semana",
      category: "Culinária",
      description: "Receitas rápidas, dicas de cozinha e fotos dos teus pratos de fim de semana.",
      rules: "Partilha sempre a receita junto com a foto.",
      creatorId: carlaId,
      members: [beatrizId, brunoId],
      messages: [
        { senderId: carlaId, content: "Fiz a receita de massa do curso, ficou ótima! Deixo a foto." },
        { senderId: brunoId, content: "Boa aparência! Vou experimentar este fim de semana." },
      ],
    },
    {
      key: "musica-e-producao",
      name: "Música e Produção",
      category: "Música",
      description: "Para quem produz música e quer trocar feedback sobre mixagens, plugins e fluxo de trabalho.",
      rules: "Só entra quem já terminou o curso de Produção Musical com Ableton, para manter a conversa ao mesmo nível.",
      creatorId: anaId,
      admins: [carlosId],
      requirements: [{ type: "COMPLETED_COURSE", courseSlug: "producao-musical-ableton" }],
      messages: [{ senderId: anaId, content: "Partilhem as vossas mixagens aqui, adoro ouvir o progresso de todos." }],
    },
    {
      key: "negocios-empreendedorismo",
      name: "Negócios e Empreendedorismo",
      category: "Negócios",
      description: "Discussão sobre gestão de projetos, produtividade e o dia a dia de quem está a montar um negócio.",
      rules: "Sem promoção direta de serviços — o foco é trocar experiências.",
      creatorId: tiagoId,
      members: [migueId, carlosId],
      messages: [{ senderId: tiagoId, content: "Como é que vocês organizam as tarefas da semana? Uso Kanban mas sinto que falta algo." }],
    },
    {
      key: "bem-estar-mindfulness",
      name: "Bem-estar e Mindfulness",
      category: "Saúde e Bem-estar",
      description: "Espaço para partilhar rotinas de bem-estar, meditação e yoga.",
      rules: "Respeita o ritmo de cada um — não há certo ou errado em bem-estar.",
      creatorId: beatrizId,
      members: [sofiaId, carlaId],
      messages: [{ senderId: beatrizId, content: "Alguém mais está a seguir a rotina de yoga do curso? Como estão a correr as primeiras semanas?" }],
    },
  ];

  for (const seed of seeds) {
    const existing = await prisma.community.findFirst({ where: { name: seed.name } });
    if (existing) {
      console.log(`Já existe: ${seed.name} — a saltar.`);
      continue;
    }

    const community = await prisma.community.create({
      data: {
        name: seed.name,
        category: seed.category,
        description: seed.description,
        rules: seed.rules,
        coverImageUrl: avatarUrl(seed.key),
        bannerUrl: bannerUrl(seed.key),
        createdById: seed.creatorId,
        members: {
          create: [
            { userId: seed.creatorId, role: "OWNER" },
            ...(seed.admins ?? []).map((userId) => ({ userId, role: "ADMIN" as const })),
            ...(seed.members ?? []).map((userId) => ({ userId, role: "MEMBER" as const })),
          ],
        },
        ...(seed.requirements
          ? {
              requirements: {
                create: seed.requirements.map((r) => ({
                  type: r.type,
                  ...(r.courseSlug ? { courseId: bySlug(r.courseSlug).id } : {}),
                  ...(r.minValue ? { minValue: r.minValue } : {}),
                })),
              },
            }
          : {}),
      },
    });

    for (const m of seed.messages) {
      await prisma.communityMessage.create({ data: { communityId: community.id, senderId: m.senderId, content: m.content } });
    }

    console.log(`Criada: ${seed.name}`);
  }

  console.log("Comunidades seed concluídas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
