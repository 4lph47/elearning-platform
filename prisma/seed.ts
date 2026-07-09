import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import ExcelJS from "exceljs";
import { buildSlideDeck } from "../lib/slideDeck";

const prisma = new PrismaClient();

const SAMPLE_VIDEO = "/uploads/sample/sample-video.mp4";
const SAMPLE_DOC = "/uploads/sample/sample-doc.pdf";
const SAMPLE_IMAGE = "/uploads/sample/sample-image.jpg";
const GENERATED_DIR = path.join(process.cwd(), "public", "uploads", "generated");
fs.mkdirSync(GENERATED_DIR, { recursive: true });

function thumb(seed: string) {
  return `https://picsum.photos/seed/${seed}/640/360`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapePdfText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makeSimplePdf(title: string, subtitle: string): Buffer {
  const lines = [title, "", subtitle, "", "Documento de exemplo gerado automaticamente."];
  const contentStream = lines
    .map((line, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${700 - i * 28} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${Buffer.byteLength(contentStream, "latin1")}>>stream\n${contentStream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj${obj}endobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function generatedDocUrl(name: string, subtitle: string) {
  const filename = `${slugify(name)}.pdf`;
  const filePath = path.join(GENERATED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, makeSimplePdf(name, subtitle));
  }
  return `/uploads/generated/${filename}`;
}

async function generatedSlidesUrl(name: string) {
  const filename = `${slugify(name)}.pptx`;
  const filePath = path.join(GENERATED_DIR, filename);
  const pptx = new PptxGenJS();
  for (const slide of buildSlideDeck(name)) {
    const s = pptx.addSlide();
    s.addText(slide.title, { x: 0.5, y: 0.6, w: 9, h: 1, fontSize: 28, bold: true });
    if (slide.body) {
      s.addText(slide.body, { x: 0.5, y: 1.8, w: 9, h: 2, fontSize: 16 });
    }
  }
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  fs.writeFileSync(filePath, buffer);
  return `/uploads/generated/${filename}`;
}

async function generatedSpreadsheetUrl(name: string) {
  const filename = `${slugify(name)}.xlsx`;
  const filePath = path.join(GENERATED_DIR, filename);
  const topic = name.replace(/\.(xlsx|xls)$/i, "");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Dados");
  sheet.addRow(["Item", "Valor", "Notas"]);
  sheet.addRow([`${topic} - linha 1`, 100, "Exemplo"]);
  sheet.addRow([`${topic} - linha 2`, 200, "Exemplo"]);
  sheet.addRow([`${topic} - linha 3`, 300, "Exemplo"]);
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return `/uploads/generated/${filename}`;
}

async function resourceUrl(r: { name: string; type: "PDF" | "IMAGE" | "VIDEO" | "OTHER" | "SLIDES" }) {
  if (r.type === "IMAGE") return `https://picsum.photos/seed/${slugify(r.name)}/900/600`;
  if (r.type === "VIDEO") return SAMPLE_VIDEO;
  if (r.type === "SLIDES") return generatedSlidesUrl(r.name);
  if (r.type === "OTHER" && /\.xlsx?$/i.test(r.name)) return generatedSpreadsheetUrl(r.name);
  return generatedDocUrl(r.name, r.type === "OTHER" ? "Material de apoio" : "Documento PDF");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface LessonSeed {
  title: string;
  durationSeconds: number;
  isFreePreview?: boolean;
  resources?: { name: string; type: "PDF" | "IMAGE" | "VIDEO" | "OTHER" | "SLIDES"; sizeBytes: number }[];
}

interface ModuleSeed {
  title: string;
  lessons: LessonSeed[];
}

interface CourseSeed {
  title: string;
  slug: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  published: boolean;
  price: number;
  rating: number;
  ratingCount: number;
  instructor: "ana" | "carlos";
  modules: ModuleSeed[];
}

const courseSeeds: CourseSeed[] = [
  {
    title: "Introdução ao Next.js 14",
    slug: "introducao-ao-nextjs",
    description:
      "Aprende os fundamentos do Next.js 14 com App Router, Server Components e rotas de API, construindo uma aplicação real do zero até ao deploy.",
    category: "Programação",
    level: "beginner",
    published: true,
    price: 0,
    rating: 4.7,
    ratingCount: 1284,
    instructor: "ana",
    modules: [
      {
        title: "Primeiros Passos",
        lessons: [
          {
            title: "Bem-vindo ao curso",
            durationSeconds: 180,
            isFreePreview: true,
            resources: [{ name: "Slides - Boas-vindas.pptx", type: "SLIDES", sizeBytes: 610_000 }],
          },
          { title: "Instalação e setup do projeto", durationSeconds: 320, isFreePreview: true },
          {
            title: "Estrutura de pastas do App Router",
            durationSeconds: 410,
            resources: [{ name: "Diagrama de pastas.png", type: "IMAGE", sizeBytes: 210_000 }],
          },
        ],
      },
      {
        title: "App Router na Prática",
        lessons: [
          { title: "Rotas, layouts e páginas", durationSeconds: 480 },
          {
            title: "Server Components vs Client Components",
            durationSeconds: 560,
            resources: [
              { name: "Cheatsheet Server vs Client.pdf", type: "PDF", sizeBytes: 182_000 },
              { name: "Slides - Server vs Client.pptx", type: "SLIDES", sizeBytes: 540_000 },
            ],
          },
          { title: "Referência de APIs do framework", durationSeconds: 300 },
        ],
      },
      {
        title: "Dados e Deploy",
        lessons: [
          { title: "Ligar a uma base de dados com Prisma", durationSeconds: 620 },
          {
            title: "Deploy na Vercel",
            durationSeconds: 340,
            resources: [{ name: "Checklist de deploy.xlsx", type: "OTHER", sizeBytes: 45_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Design de Interfaces para Devs",
    slug: "design-de-interfaces",
    description:
      "Princípios essenciais de UI/UX para programadores criarem interfaces mais claras, acessíveis e agradáveis, sem precisar de ser designer.",
    category: "Design",
    level: "intermediate",
    published: true,
    price: 24.99,
    rating: 4.5,
    ratingCount: 342,
    instructor: "ana",
    modules: [
      {
        title: "Fundamentos Visuais",
        lessons: [
          {
            title: "O que é um bom design",
            durationSeconds: 260,
            isFreePreview: true,
            resources: [{ name: "Slides - Fundamentos visuais.pptx", type: "SLIDES", sizeBytes: 720_000 }],
          },
          {
            title: "Paletas de cor que funcionam",
            durationSeconds: 300,
            resources: [{ name: "Paleta de exemplo.png", type: "IMAGE", sizeBytes: 180_000 }],
          },
          { title: "Tipografia para interfaces", durationSeconds: 390 },
        ],
      },
      {
        title: "Layout e Espaçamento",
        lessons: [
          {
            title: "Grelhas e sistemas de espaçamento",
            durationSeconds: 440,
            resources: [{ name: "Grelha de 8pt.pdf", type: "PDF", sizeBytes: 96_000 }],
          },
          {
            title: "Hierarquia visual na prática",
            durationSeconds: 310,
            resources: [{ name: "Exemplo de hierarquia.jpg", type: "IMAGE", sizeBytes: 240_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Python para Ciência de Dados",
    slug: "python-ciencia-de-dados",
    description:
      "Do zero à análise de dados: Python, pandas, NumPy e visualização com matplotlib, com exercícios práticos em cada aula.",
    category: "Programação",
    level: "intermediate",
    published: true,
    price: 39.99,
    rating: 4.6,
    ratingCount: 897,
    instructor: "carlos",
    modules: [
      {
        title: "Fundamentos de Python",
        lessons: [
          {
            title: "Variáveis, tipos e estruturas de dados",
            durationSeconds: 500,
            isFreePreview: true,
            resources: [{ name: "Slides - Fundamentos Python.pptx", type: "SLIDES", sizeBytes: 680_000 }],
          },
          { title: "Funções e módulos", durationSeconds: 470 },
        ],
      },
      {
        title: "Análise de Dados com pandas",
        lessons: [
          {
            title: "DataFrames e Series",
            durationSeconds: 610,
            resources: [{ name: "Exercícios.xlsx", type: "OTHER", sizeBytes: 62_000 }],
          },
          {
            title: "Limpeza e transformação de dados",
            durationSeconds: 540,
            resources: [{ name: "Dataset de exemplo.pdf", type: "PDF", sizeBytes: 240_000 }],
          },
          { title: "Exercício guiado", durationSeconds: 260 },
        ],
      },
      {
        title: "Visualização de Dados",
        lessons: [
          {
            title: "Gráficos com matplotlib",
            durationSeconds: 400,
            resources: [{ name: "Exemplo de gráfico.png", type: "IMAGE", sizeBytes: 195_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Marketing Digital do Zero",
    slug: "marketing-digital-do-zero",
    description:
      "Aprende a criar campanhas em redes sociais, Google Ads e email marketing, com estratégias práticas para pequenos negócios.",
    category: "Marketing",
    level: "beginner",
    published: true,
    price: 0,
    rating: 4.4,
    ratingCount: 610,
    instructor: "carlos",
    modules: [
      {
        title: "Estratégia e Fundamentos",
        lessons: [
          {
            title: "Definir o teu público-alvo",
            durationSeconds: 280,
            isFreePreview: true,
            resources: [{ name: "Slides - Estratégia de marketing.pptx", type: "SLIDES", sizeBytes: 590_000 }],
          },
          {
            title: "Funil de vendas explicado",
            durationSeconds: 360,
            resources: [{ name: "Funil de vendas.png", type: "IMAGE", sizeBytes: 170_000 }],
          },
        ],
      },
      {
        title: "Redes Sociais",
        lessons: [
          {
            title: "Criar conteúdo que converte",
            durationSeconds: 330,
            resources: [{ name: "Calendário de conteúdo.xlsx", type: "OTHER", sizeBytes: 58_000 }],
          },
          {
            title: "Anúncios pagos no Instagram e Facebook",
            durationSeconds: 520,
            resources: [{ name: "Checklist de campanha.pdf", type: "PDF", sizeBytes: 120_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Fotografia com o Telemóvel",
    slug: "fotografia-com-telemovel",
    description:
      "Tira fotos profissionais apenas com o telemóvel: composição, luz natural, edição rápida e storytelling visual para redes sociais.",
    category: "Fotografia",
    level: "beginner",
    published: true,
    price: 14.99,
    rating: 4.8,
    ratingCount: 2043,
    instructor: "ana",
    modules: [
      {
        title: "Composição e Luz",
        lessons: [
          {
            title: "Regra dos terços e enquadramento",
            durationSeconds: 240,
            isFreePreview: true,
            resources: [{ name: "Exemplo de enquadramento.jpg", type: "IMAGE", sizeBytes: 310_000 }],
          },
          {
            title: "Como usar luz natural",
            durationSeconds: 300,
            resources: [{ name: "Slides - Luz natural.pptx", type: "SLIDES", sizeBytes: 480_000 }],
          },
        ],
      },
      {
        title: "Edição Rápida",
        lessons: [
          {
            title: "Ajustar cor e contraste",
            durationSeconds: 340,
            resources: [{ name: "Tutorial de edição rápida.mp4", type: "VIDEO", sizeBytes: 8_400_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Gestão de Projetos Ágeis",
    slug: "gestao-de-projetos-ageis",
    description:
      "Scrum, Kanban e princípios ágeis aplicados a equipas reais: sprints, cerimónias, métricas e ferramentas de acompanhamento.",
    category: "Negócios",
    level: "intermediate",
    published: true,
    price: 29.99,
    rating: 4.3,
    ratingCount: 205,
    instructor: "carlos",
    modules: [
      {
        title: "Fundamentos Ágeis",
        lessons: [
          {
            title: "Manifesto ágil e valores",
            durationSeconds: 250,
            isFreePreview: true,
            resources: [{ name: "Slides - Manifesto ágil.pptx", type: "SLIDES", sizeBytes: 510_000 }],
          },
          { title: "Scrum vs Kanban", durationSeconds: 430 },
        ],
      },
      {
        title: "Aplicar na Prática",
        lessons: [
          {
            title: "Planear uma sprint",
            durationSeconds: 380,
            resources: [{ name: "Template de sprint planning.pdf", type: "PDF", sizeBytes: 88_000 }],
          },
          {
            title: "Métricas: velocity e burndown",
            durationSeconds: 310,
            resources: [{ name: "Planilha de métricas.xlsx", type: "OTHER", sizeBytes: 71_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Produção Musical com Ableton",
    slug: "producao-musical-ableton",
    description:
      "Cria as tuas próprias faixas do zero: sound design, arranjo, mistura e masterização básica usando o Ableton Live.",
    category: "Música",
    level: "advanced",
    published: true,
    price: 49.99,
    rating: 4.9,
    ratingCount: 156,
    instructor: "ana",
    modules: [
      {
        title: "Sound Design",
        lessons: [
          {
            title: "Sintetizadores e presets",
            durationSeconds: 500,
            isFreePreview: true,
            resources: [{ name: "Demo de síntese.mp4", type: "VIDEO", sizeBytes: 12_100_000 }],
          },
          {
            title: "Criar um kit de bateria próprio",
            durationSeconds: 460,
            resources: [{ name: "Screenshot do kit.png", type: "IMAGE", sizeBytes: 260_000 }],
          },
        ],
      },
      {
        title: "Mistura e Masterização",
        lessons: [
          {
            title: "EQ e compressão essenciais",
            durationSeconds: 580,
            resources: [{ name: "Preset pack.pdf", type: "PDF", sizeBytes: 150_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "React Avançado: Performance e Arquitetura",
    slug: "react-avancado-performance",
    description:
      "Padrões avançados de React: otimização de renders, arquitetura de componentes escalável, testes e boas práticas para apps de produção.",
    category: "Programação",
    level: "advanced",
    published: true,
    price: 44.99,
    rating: 4.6,
    ratingCount: 731,
    instructor: "carlos",
    modules: [
      {
        title: "Performance",
        lessons: [
          {
            title: "Como o React decide re-renderizar",
            durationSeconds: 550,
            isFreePreview: true,
            resources: [{ name: "Slides - Ciclo de renders.pptx", type: "SLIDES", sizeBytes: 640_000 }],
          },
          {
            title: "memo, useMemo e useCallback na prática",
            durationSeconds: 490,
            resources: [{ name: "Exercícios de otimização.xlsx", type: "OTHER", sizeBytes: 54_000 }],
          },
        ],
      },
      {
        title: "Arquitetura",
        lessons: [
          {
            title: "Organizar um projeto grande",
            durationSeconds: 400,
            resources: [{ name: "Diagrama de arquitetura.png", type: "IMAGE", sizeBytes: 225_000 }],
          },
          { title: "Testes de componentes", durationSeconds: 420 },
        ],
      },
    ],
  },
  {
    title: "Curso em Preparação",
    slug: "curso-rascunho",
    description: "Curso ainda não publicado, usado para testar a área do instrutor.",
    category: "Programação",
    level: "beginner",
    published: false,
    price: 0,
    rating: 0,
    ratingCount: 0,
    instructor: "ana",
    modules: [],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const ana = await prisma.user.upsert({
    where: { email: "instrutor@example.com" },
    update: {},
    create: { name: "Ana Rodrigues", email: "instrutor@example.com", passwordHash, role: "INSTRUCTOR" },
  });

  const carlos = await prisma.user.upsert({
    where: { email: "carlos@example.com" },
    update: {},
    create: { name: "Carlos Mendes", email: "carlos@example.com", passwordHash, role: "INSTRUCTOR" },
  });

  const bruno = await prisma.user.upsert({
    where: { email: "aluno@example.com" },
    update: {},
    create: { name: "Bruno Aluno", email: "aluno@example.com", passwordHash, role: "STUDENT" },
  });

  const sofia = await prisma.user.upsert({
    where: { email: "sofia@example.com" },
    update: {},
    create: { name: "Sofia Ferreira", email: "sofia@example.com", passwordHash, role: "STUDENT" },
  });

  const instructors = { ana, carlos };
  const courses: Record<string, Awaited<ReturnType<typeof prisma.course.upsert>>> = {};

  const resourceUrlCache = new Map<object, string>();
  for (const c of courseSeeds) {
    for (const m of c.modules) {
      for (const l of m.lessons) {
        if (!l.resources) continue;
        for (const r of l.resources) {
          resourceUrlCache.set(r, await resourceUrl(r));
        }
      }
    }
  }

  for (const c of courseSeeds) {
    const course = await prisma.course.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        title: c.title,
        slug: c.slug,
        description: c.description,
        category: c.category,
        level: c.level,
        published: c.published,
        price: c.price,
        rating: c.rating,
        ratingCount: c.ratingCount,
        thumbnailUrl: c.published ? thumb(c.slug) : null,
        instructorId: instructors[c.instructor].id,
        modules: {
          create: c.modules.map((m, mi) => ({
            title: m.title,
            order: mi,
            lessons: {
              create: m.lessons.map((l, li) => ({
                title: l.title,
                order: li,
                isFreePreview: l.isFreePreview ?? false,
                contentUrl: SAMPLE_VIDEO,
                durationSeconds: l.durationSeconds,
                resources: l.resources
                  ? {
                      create: l.resources.map((r) => ({
                        name: r.name,
                        type: r.type,
                        url: resourceUrlCache.get(r)!,
                        sizeBytes: r.sizeBytes,
                      })),
                    }
                  : undefined,
              })),
            },
          })),
        },
      },
    });
    courses[c.slug] = course;
  }

  async function lessonsOf(slug: string) {
    return prisma.lesson.findMany({
      where: { module: { courseId: courses[slug].id } },
      orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
    });
  }

  for (const c of courseSeeds) {
    const flatLessons = c.modules.flatMap((m) => m.lessons);
    const dbLessons = await lessonsOf(c.slug);
    for (let i = 0; i < flatLessons.length; i++) {
      const seedLesson = flatLessons[i];
      const dbLesson = dbLessons[i];
      if (!seedLesson.resources || !dbLesson) continue;
      for (const r of seedLesson.resources) {
        const url = resourceUrlCache.get(r) ?? (await resourceUrl(r));
        const existing = await prisma.lessonResource.findFirst({
          where: { lessonId: dbLesson.id, name: r.name },
        });
        if (existing) {
          if (existing.url !== url || existing.type !== r.type) {
            await prisma.lessonResource.update({ where: { id: existing.id }, data: { url, type: r.type } });
          }
          continue;
        }
        await prisma.lessonResource.create({
          data: {
            lessonId: dbLesson.id,
            name: r.name,
            type: r.type,
            url,
            sizeBytes: r.sizeBytes,
          },
        });
      }
    }
  }

  async function enroll(userId: string, slug: string, progressRatio: number) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId: courses[slug].id } },
      update: {},
      create: { userId, courseId: courses[slug].id },
    });

    const lessons = await lessonsOf(slug);
    const completedCount = Math.round(lessons.length * progressRatio);
    for (let i = 0; i < lessons.length; i++) {
      const completed = i < completedCount;
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lessons[i].id } },
        update: {},
        create: {
          userId,
          lessonId: lessons[i].id,
          completed,
          completedAt: completed ? new Date() : null,
          watchedSeconds: completed ? lessons[i].durationSeconds ?? 60 : 0,
        },
      });
    }
  }

  await enroll(bruno.id, "introducao-ao-nextjs", 1);
  await enroll(bruno.id, "python-ciencia-de-dados", 0.4);
  await enroll(bruno.id, "fotografia-com-telemovel", 0);

  await enroll(sofia.id, "design-de-interfaces", 0.5);
  await enroll(sofia.id, "marketing-digital-do-zero", 1);
  await enroll(sofia.id, "gestao-de-projetos-ageis", 0.25);
  await enroll(sofia.id, "react-avancado-performance", 0);

  const nextjsCourse = courses["introducao-ao-nextjs"];
  const nextjsModules = await prisma.module.findMany({
    where: { courseId: nextjsCourse.id },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const firstModule = nextjsModules[0];
  const firstLesson = firstModule.lessons[0];

  await prisma.quiz.upsert({
    where: { lessonId: firstLesson.id },
    update: {},
    create: {
      scope: "LESSON",
      title: "Quiz: Bem-vindo ao curso",
      lessonId: firstLesson.id,
      questions: {
        create: [
          {
            text: "Qual framework é usado neste curso?",
            order: 0,
            options: {
              create: [
                { text: "Next.js", isCorrect: true, order: 0 },
                { text: "Angular", isCorrect: false, order: 1 },
                { text: "Vue", isCorrect: false, order: 2 },
                { text: "Svelte", isCorrect: false, order: 3 },
              ],
            },
          },
          {
            text: "Que router é usado no curso?",
            order: 1,
            options: {
              create: [
                { text: "Pages Router", isCorrect: false, order: 0 },
                { text: "App Router", isCorrect: true, order: 1 },
                { text: "React Router", isCorrect: false, order: 2 },
                { text: "Remix Router", isCorrect: false, order: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.quiz.upsert({
    where: { moduleId: firstModule.id },
    update: { maxAttempts: null },
    create: {
      scope: "MODULE",
      title: "Quiz: Primeiros Passos",
      moduleId: firstModule.id,
      questions: {
        create: [
          {
            text: "O que é necessário instalar antes de criar um projeto Next.js?",
            order: 0,
            options: {
              create: [
                { text: "Node.js", isCorrect: true, order: 0 },
                { text: "PHP", isCorrect: false, order: 1 },
                { text: "Ruby", isCorrect: false, order: 2 },
                { text: "Java", isCorrect: false, order: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.quiz.upsert({
    where: { courseId: nextjsCourse.id },
    update: { timeLimitMinutes: 10 },
    create: {
      scope: "COURSE",
      title: "Teste final: Introdução ao Next.js",
      courseId: nextjsCourse.id,
      timeLimitMinutes: 10,
      questions: {
        create: [
          {
            text: "Qual comando cria migrations no Prisma?",
            order: 0,
            options: {
              create: [
                { text: "prisma migrate dev", isCorrect: true, order: 0 },
                { text: "prisma push", isCorrect: false, order: 1 },
                { text: "prisma build", isCorrect: false, order: 2 },
                { text: "prisma sync", isCorrect: false, order: 3 },
              ],
            },
          },
          {
            text: "Onde o curso recomenda fazer o deploy da aplicação?",
            order: 1,
            options: {
              create: [
                { text: "Vercel", isCorrect: true, order: 0 },
                { text: "Heroku", isCorrect: false, order: 1 },
                { text: "Netlify", isCorrect: false, order: 2 },
                { text: "Railway", isCorrect: false, order: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  // Garante que todo módulo e todo curso (publicado) tem um quiz — gera perguntas
  // automáticas baseadas em dados reais (títulos de aulas / nº de módulos) para os
  // módulos/cursos que ainda não têm um quiz definido manualmente acima.
  const allModules = await prisma.module.findMany({ include: { lessons: true } });
  const allLessonTitles = allModules.flatMap((m) => m.lessons.map((l) => l.title));

  for (const mod of allModules) {
    if (mod.lessons.length === 0) continue;
    const ownTitles = mod.lessons.map((l) => l.title);
    const correct = ownTitles[0];
    const distractors = shuffle(allLessonTitles.filter((t) => !ownTitles.includes(t))).slice(0, 3);
    const options = shuffle([
      { text: correct, isCorrect: true },
      ...distractors.map((d) => ({ text: d, isCorrect: false })),
    ]);

    // Quizzes de módulo nunca limitam tentativas — só o teste final do curso pode.
    await prisma.quiz.upsert({
      where: { moduleId: mod.id },
      update: { maxAttempts: null },
      create: {
        scope: "MODULE",
        title: `Quiz: ${mod.title}`,
        moduleId: mod.id,
        questions: {
          create: [
            {
              text: `Qual destas aulas pertence ao módulo "${mod.title}"?`,
              order: 0,
              options: { create: options.map((o, i) => ({ ...o, order: i })) },
            },
          ],
        },
      },
    });
  }

  let courseQuizIndex = 0;
  for (const slug of Object.keys(courses)) {
    const course = courses[slug];
    const moduleCount = await prisma.module.count({ where: { courseId: course.id } });
    if (moduleCount === 0) continue;

    const correct = moduleCount;
    const distractorSet = new Set<number>();
    while (distractorSet.size < 3) {
      const d = Math.max(1, correct + (Math.floor(Math.random() * 5) - 2));
      if (d !== correct) distractorSet.add(d);
    }
    const options = shuffle([
      { text: String(correct), isCorrect: true },
      ...Array.from(distractorSet).map((d) => ({ text: String(d), isCorrect: false })),
    ]);
    const timed = courseQuizIndex % 2 === 0;
    courseQuizIndex += 1;

    await prisma.quiz.upsert({
      where: { courseId: course.id },
      update: {},
      create: {
        scope: "COURSE",
        title: `Teste final: ${course.title}`,
        courseId: course.id,
        timeLimitMinutes: timed ? 10 : null,
        questions: {
          create: [
            {
              text: `Quantos módulos tem o curso "${course.title}"?`,
              order: 0,
              options: { create: options.map((o, i) => ({ ...o, order: i })) },
            },
          ],
        },
      },
    });
  }

  console.log({
    instructors: [ana.email, carlos.email],
    students: [bruno.email, sofia.email],
    courses: Object.keys(courses),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
