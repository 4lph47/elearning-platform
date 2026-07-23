import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import ExcelJS from "exceljs";
import { buildSlideDeck } from "../lib/slideDeck";

const prisma = new PrismaClient();

const SUPABASE_MEDIA_BASE = "https://gnynvupaqvzfthiecjix.supabase.co/storage/v1/object/public/course-media";
const SAMPLE_VIDEO = `${SUPABASE_MEDIA_BASE}/sample/sample-video.mp4`;
const SAMPLE_DOC = `${SUPABASE_MEDIA_BASE}/sample/sample-doc.pdf`;
const SAMPLE_IMAGE = `${SUPABASE_MEDIA_BASE}/sample/sample-image.jpg`;
const GENERATED_DIR = path.join(process.cwd(), "public", "uploads", "generated");
fs.mkdirSync(GENERATED_DIR, { recursive: true });

function thumb(seed: string) {
  return `https://picsum.photos/seed/${seed}/640/360`;
}

// Vídeos reais do Pexels (royalty-free), escolhidos por tema de cada curso/categoria.
const PEXELS_TRAILERS: Record<string, string> = {
  "introducao-ao-nextjs": "https://videos.pexels.com/video-files/11274330/11274330-sd_640_360_25fps.mp4",
  "react-avancado-performance": "https://videos.pexels.com/video-files/11274330/11274330-sd_640_360_25fps.mp4",
  "typescript-para-iniciantes": "https://videos.pexels.com/video-files/11274330/11274330-sd_640_360_25fps.mp4",
  "nodejs-apis-rest": "https://videos.pexels.com/video-files/11274330/11274330-sd_640_360_25fps.mp4",
  "design-de-interfaces": "https://videos.pexels.com/video-files/1350205/1350205-sd_640_360_30fps.mp4",
  "producao-musical-ableton": "https://videos.pexels.com/video-files/12330928/12330928-sd_360_640_25fps.mp4",
  "fotografia-com-telemovel": "https://videos.pexels.com/video-files/5168109/5168109-sd_640_360_25fps.mp4",
  "gestao-de-projetos-ageis": "https://videos.pexels.com/video-files/8033854/8033854-sd_640_360_25fps.mp4",
  "marketing-digital-do-zero": "https://videos.pexels.com/video-files/7966582/7966582-sd_640_360_25fps.mp4",
  "ingles-para-viagens": "https://videos.pexels.com/video-files/5409006/5409006-sd_360_640_30fps.mp4",
  "yoga-e-mindfulness": "https://videos.pexels.com/video-files/7521693/7521693-sd_640_360_25fps.mp4",
  "educacao-financeira-do-zero": "https://videos.pexels.com/video-files/7735814/7735814-sd_640_360_25fps.mp4",
  "cozinha-rapida-do-dia-a-dia": "https://videos.pexels.com/video-files/8626672/8626672-sd_640_360_25fps.mp4",
  "produtividade-e-gestao-do-tempo": "https://videos.pexels.com/video-files/4197892/4197892-sd_640_360_30fps.mp4",
  "fundamentos-de-vendas": "https://videos.pexels.com/video-files/7735499/7735499-sd_640_360_25fps.mp4",
  "desenho-e-ilustracao-digital": "https://videos.pexels.com/video-files/854136/854136-sd_640_360_25fps.mp4",
  "excel-para-negocios": "https://videos.pexels.com/video-files/8033854/8033854-sd_640_360_25fps.mp4",
  "copywriting-que-vende": "https://videos.pexels.com/video-files/7966582/7966582-sd_640_360_25fps.mp4",
  "guitarra-para-iniciantes": "https://videos.pexels.com/video-files/12330928/12330928-sd_360_640_25fps.mp4",
};

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
  type?: "VIDEO" | "TEXT";
  textContent?: string;
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
  originalPrice?: number;
  rating: number;
  ratingCount: number;
  instructor: "ana" | "carlos";
  learningOutcomes?: string[];
  requirements?: string[];
  targetAudience?: string[];
  topics?: string[];
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
    learningOutcomes: [
      "Construir uma aplicação completa com o App Router do Next.js 14",
      "Distinguir Server Components de Client Components e saber quando usar cada um",
      "Ligar a aplicação a uma base de dados real com Prisma",
      "Fazer deploy de um projeto Next.js na Vercel",
    ],
    requirements: ["Conhecimentos básicos de JavaScript", "Familiaridade com HTML e CSS", "Node.js instalado"],
    targetAudience: [
      "Programadores que já sabem JavaScript e querem aprender React/Next.js",
      "Quem quer construir aplicações web modernas e escaláveis",
      "Devs que já usam Next.js e querem atualizar para o App Router",
    ],
    topics: ["Next.js", "React", "App Router", "Server Components", "Prisma"],
    modules: [
      {
        title: "Primeiros Passos",
        lessons: [
          {
            title: "Bem-vindo ao curso",
            durationSeconds: 180,
            isFreePreview: true,
            type: "TEXT",
            textContent:
              "Bem-vindo ao curso de Next.js 14!\n\nNeste curso vais aprender a construir uma aplicação completa, do zero até ao deploy, usando o App Router, Server Components e Prisma.\n\nAntes de começares, recomendamos que tenhas o Node.js instalado e conhecimentos básicos de JavaScript e React. Cada módulo tem exercícios práticos — não saltes nenhum!\n\nVamos a isto.",
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
    learningOutcomes: [
      "Aplicar princípios essenciais de UI/UX sem precisar de formação em design",
      "Escolher paletas de cor e tipografia que funcionam de verdade",
      "Criar layouts com grelhas e espaçamento consistente",
      "Usar hierarquia visual para guiar o utilizador na interface",
    ],
    requirements: ["Nenhuma experiência prévia em design", "Vontade de melhorar interfaces que já constróis"],
    targetAudience: [
      "Programadores que criam as suas próprias interfaces",
      "Product managers que querem falar a mesma língua dos designers",
      "Freelancers que precisam de entregar produtos com bom aspeto",
    ],
    topics: ["UI", "UX", "Design de Interfaces", "Tipografia", "Cor"],
    modules: [
      {
        title: "Fundamentos Visuais",
        lessons: [
          {
            title: "O que é um bom design",
            durationSeconds: 260,
            isFreePreview: true,
            type: "TEXT",
            textContent:
              "Bom design não é sobre parecer bonito — é sobre ser claro.\n\nUma interface bem desenhada guia o utilizador sem que ele precise de pensar: os botões parecem clicáveis, a informação mais importante salta à vista primeiro, e os erros são fáceis de entender e corrigir.\n\nNeste curso vamos focar-nos em três pilares: hierarquia visual, consistência e feedback. Não precisas de ser designer para aplicar isto — precisas de saber olhar para uma interface e perguntar 'o que é que o utilizador precisa de ver primeiro?'",
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
    learningOutcomes: [
      "Programar em Python desde os fundamentos até estruturas de dados",
      "Manipular e limpar dados reais com pandas",
      "Criar visualizações de dados claras com matplotlib",
      "Aplicar análise de dados a problemas do dia a dia",
    ],
    requirements: ["Nenhuma experiência prévia em programação é obrigatória", "Computador com Python instalável"],
    targetAudience: [
      "Iniciantes que querem entrar na área de dados",
      "Profissionais que precisam de analisar dados no trabalho",
      "Estudantes de áreas quantitativas que querem aprender Python aplicado",
    ],
    topics: ["Python", "Pandas", "NumPy", "Ciência de Dados", "Matplotlib"],
    modules: [
      {
        title: "Fundamentos de Python",
        lessons: [
          {
            title: "Variáveis, tipos e estruturas de dados",
            durationSeconds: 500,
            isFreePreview: true,
            type: "TEXT",
            textContent:
              "Python guarda dados em variáveis sem precisares de declarar o tipo à partida — o tipo é decidido pelo valor que atribuis.\n\nOs tipos base que vais usar mais são: int (números inteiros), float (números decimais), str (texto) e bool (verdadeiro/falso).\n\nPara guardar várias informações juntas, tens as estruturas de dados: list (lista ordenada e alterável), tuple (lista ordenada e imutável), dict (pares chave-valor) e set (coleção sem duplicados).\n\nExperimenta no teu terminal Python: cria uma lista de números, um dicionário com o teu nome e idade, e usa type() para confirmares o tipo de cada variável.",
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
    learningOutcomes: [
      "Definir o público-alvo certo para o teu negócio",
      "Construir um funil de vendas do zero",
      "Criar conteúdo que converte em redes sociais",
      "Configurar campanhas pagas no Instagram e Facebook",
    ],
    requirements: ["Nenhuma experiência prévia em marketing", "Uma conta de rede social para praticar"],
    targetAudience: [
      "Donos de pequenos negócios que querem vender mais online",
      "Freelancers que querem oferecer serviços de marketing",
      "Quem quer começar a trabalhar com redes sociais profissionalmente",
    ],
    topics: ["Marketing Digital", "Redes Sociais", "Anúncios Pagos", "Funil de Vendas"],
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
    learningOutcomes: [
      "Dominar composição e enquadramento",
      "Usar luz natural a teu favor",
      "Editar fotos diretamente no telemóvel",
      "Criar um estilo visual consistente",
    ],
    requirements: [
      "Um smartphone com câmara",
      "Nenhuma experiência prévia em fotografia",
      "Vontade de praticar entre as aulas",
    ],
    targetAudience: [
      "Iniciantes que querem tirar melhores fotos com o telemóvel",
      "Criadores de conteúdo para redes sociais",
      "Quem quer começar a vender fotografia sem equipamento caro",
    ],
    topics: ["Fotografia", "Mobile", "Edição de Fotos", "Redes Sociais"],
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
    learningOutcomes: [
      "Aplicar Scrum e Kanban em equipas reais",
      "Planear e conduzir sprints do início ao fim",
      "Acompanhar métricas como velocity e burndown",
      "Escolher a cerimónia e ferramenta certa para cada equipa",
    ],
    requirements: ["Experiência a trabalhar em equipa", "Nenhum conhecimento prévio de metodologias ágeis"],
    targetAudience: [
      "Gestores de projeto que querem adotar métodos ágeis",
      "Product owners e scrum masters em início de carreira",
      "Equipas que querem melhorar a forma como entregam trabalho",
    ],
    topics: ["Scrum", "Kanban", "Gestão de Projetos", "Metodologias Ágeis"],
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
    learningOutcomes: [
      "Criar sons próprios com síntese e presets",
      "Programar e arranjar uma faixa do zero",
      "Aplicar EQ e compressão de forma eficaz",
      "Masterizar uma faixa a um nível profissional básico",
    ],
    requirements: ["Ableton Live instalado (trial serve)", "Auscultadores ou monitores de estúdio"],
    targetAudience: [
      "Músicos que querem produzir as próprias faixas",
      "Iniciantes em produção musical eletrónica",
      "Quem já usa Ableton mas quer melhorar mistura e masterização",
    ],
    topics: ["Produção Musical", "Ableton Live", "Mistura", "Masterização", "Sound Design"],
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
    learningOutcomes: [
      "Entender como e quando o React re-renderiza componentes",
      "Otimizar performance com memo, useMemo e useCallback",
      "Estruturar arquitetura de componentes para projetos grandes",
      "Escrever testes para componentes React",
    ],
    requirements: ["Experiência sólida com React", "Conhecimentos de JavaScript moderno (ES6+)"],
    targetAudience: [
      "Programadores React de nível intermédio que querem subir de nível",
      "Devs que trabalham em aplicações React de grande escala",
      "Quem prepara entrevistas técnicas para vagas de frontend sénior",
    ],
    topics: ["React", "Performance", "Arquitetura de Software", "Testes"],
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
    title: "TypeScript para Iniciantes",
    slug: "typescript-para-iniciantes",
    description:
      "Aprende TypeScript do zero: tipos, interfaces, generics e como aplicar tudo isto em projetos reais de JavaScript.",
    category: "Programação",
    level: "beginner",
    published: true,
    price: 19.99,
    originalPrice: 39.99,
    rating: 4.6,
    ratingCount: 512,
    instructor: "ana",
    learningOutcomes: [
      "Entender tipos básicos e inferência de tipos",
      "Criar interfaces e types reutilizáveis",
      "Usar generics para escrever código mais flexível",
      "Configurar TypeScript num projeto real com tsconfig",
    ],
    requirements: ["Conhecimentos de JavaScript", "Nenhuma experiência prévia com TypeScript"],
    targetAudience: [
      "Programadores JavaScript que querem adicionar tipos ao seu código",
      "Iniciantes que querem entrar em equipas que usam TypeScript",
      "Quem quer projetos mais seguros e fáceis de manter",
    ],
    topics: ["TypeScript", "JavaScript", "Tipos", "Generics"],
    modules: [
      {
        title: "Fundamentos de TypeScript",
        lessons: [
          {
            title: "Porque usar TypeScript",
            durationSeconds: 260,
            isFreePreview: true,
            type: "TEXT",
            textContent:
              "TypeScript é JavaScript com um sistema de tipos por cima. Todo o código JavaScript válido já é TypeScript válido — a diferença é que TypeScript te avisa de erros antes de correres o código.\n\nSem tipos, um erro como chamar .toUpperCase() num número só aparece quando o código corre (às vezes só em produção). Com TypeScript, o editor sublinha o erro enquanto escreves.\n\nOutras vantagens práticas: autocomplete muito mais preciso, refactors mais seguros (o compilador avisa-te de tudo o que quebraste), e documentação viva — os tipos dizem-te exatamente o que uma função espera receber e devolver, sem precisares de ler a implementação.",
            resources: [{ name: "Slides - Porque TypeScript.pptx", type: "SLIDES", sizeBytes: 560_000 }],
          },
          { title: "Tipos básicos e inferência", durationSeconds: 380 },
          {
            title: "Interfaces e types",
            durationSeconds: 410,
            resources: [{ name: "Cheatsheet de tipos.pdf", type: "PDF", sizeBytes: 140_000 }],
          },
        ],
      },
      {
        title: "TypeScript na Prática",
        lessons: [
          { title: "Generics explicados com exemplos", durationSeconds: 470 },
          {
            title: "Configurar tsconfig num projeto real",
            durationSeconds: 320,
            resources: [{ name: "tsconfig de exemplo.pdf", type: "PDF", sizeBytes: 60_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Node.js e APIs REST",
    slug: "nodejs-apis-rest",
    description:
      "Constrói APIs REST robustas com Node.js e Express: autenticação, validação, base de dados e boas práticas de arquitetura.",
    category: "Programação",
    level: "intermediate",
    published: true,
    price: 34.99,
    rating: 4.5,
    ratingCount: 410,
    instructor: "carlos",
    learningOutcomes: [
      "Construir APIs REST com Node.js e Express",
      "Ligar a aplicação a uma base de dados",
      "Implementar autenticação com JWT",
      "Aplicar boas práticas de arquitetura e segurança",
    ],
    requirements: ["Conhecimentos de JavaScript", "Noções básicas de HTTP"],
    targetAudience: [
      "Programadores frontend que querem aprender backend",
      "Devs que querem construir as suas próprias APIs",
      "Quem se prepara para vagas de backend Node.js",
    ],
    topics: ["Node.js", "Express", "APIs REST", "JWT", "Backend"],
    modules: [
      {
        title: "Fundamentos de APIs",
        lessons: [
          {
            title: "Como funciona uma API REST",
            durationSeconds: 300,
            isFreePreview: true,
            resources: [{ name: "Slides - Fundamentos de APIs.pptx", type: "SLIDES", sizeBytes: 600_000 }],
          },
          { title: "Rotas e middlewares no Express", durationSeconds: 420 },
        ],
      },
      {
        title: "Persistência e Segurança",
        lessons: [
          {
            title: "Ligar a uma base de dados",
            durationSeconds: 500,
            resources: [{ name: "Diagrama de arquitetura API.png", type: "IMAGE", sizeBytes: 200_000 }],
          },
          {
            title: "Autenticação com JWT",
            durationSeconds: 460,
            resources: [{ name: "Checklist de segurança.pdf", type: "PDF", sizeBytes: 110_000 }],
          },
        ],
      },
    ],
  },
  {
    title: "Inglês para Viagens",
    slug: "ingles-para-viagens",
    description:
      "Vocabulário e frases essenciais de inglês para te desenrascares em aeroportos, hotéis, restaurantes e situações do dia a dia em viagem.",
    category: "Idiomas",
    level: "beginner",
    published: true,
    price: 0,
    rating: 4.7,
    ratingCount: 890,
    instructor: "carlos",
    learningOutcomes: [
      "Comunicar com confiança em aeroportos e hotéis",
      "Pedir comida e bebida em restaurantes",
      "Pedir ajuda e indicações em inglês",
      "Usar vocabulário essencial para situações do dia a dia em viagem",
    ],
    requirements: ["Nenhum nível prévio de inglês é necessário"],
    targetAudience: [
      "Quem vai viajar em breve e quer aprender o essencial",
      "Iniciantes em inglês que querem foco prático, não gramática",
    ],
    topics: ["Inglês", "Viagens", "Vocabulário", "Conversação"],
    modules: [
      {
        title: "Primeiros Contactos",
        lessons: [
          {
            title: "Saudações e apresentações",
            durationSeconds: 240,
            isFreePreview: true,
            resources: [{ name: "Slides - Saudações.pptx", type: "SLIDES", sizeBytes: 480_000 }],
          },
          { title: "No aeroporto e no hotel", durationSeconds: 320 },
        ],
      },
      {
        title: "No Dia a Dia",
        lessons: [
          {
            title: "Pedir comida num restaurante",
            durationSeconds: 300,
            resources: [{ name: "Vocabulário - Restaurante.pdf", type: "PDF", sizeBytes: 100_000 }],
          },
          { title: "Pedir ajuda e indicações", durationSeconds: 260 },
        ],
      },
    ],
  },
  {
    title: "Yoga e Mindfulness para o Dia a Dia",
    slug: "yoga-e-mindfulness",
    description:
      "Práticas simples de yoga e mindfulness para reduzir stress, melhorar o sono e criar uma rotina de bem-estar sustentável.",
    category: "Saúde e Bem-estar",
    level: "beginner",
    published: true,
    price: 24.99,
    rating: 4.8,
    ratingCount: 640,
    instructor: "ana",
    learningOutcomes: [
      "Praticar respiração consciente para reduzir stress",
      "Executar posturas básicas de yoga com segurança",
      "Criar uma rotina diária de bem-estar sustentável",
      "Usar mindfulness para melhorar a qualidade do sono",
    ],
    requirements: ["Um tapete ou espaço confortável no chão", "Roupa confortável"],
    targetAudience: [
      "Quem quer reduzir stress e ansiedade no dia a dia",
      "Iniciantes em yoga e meditação",
      "Quem procura uma rotina de bem-estar simples de manter",
    ],
    topics: ["Yoga", "Mindfulness", "Bem-estar", "Meditação"],
    modules: [
      {
        title: "Fundamentos",
        lessons: [
          {
            title: "Respiração consciente",
            durationSeconds: 280,
            isFreePreview: true,
            resources: [{ name: "Slides - Respiração.pptx", type: "SLIDES", sizeBytes: 460_000 }],
          },
          { title: "Posturas básicas de yoga", durationSeconds: 420 },
        ],
      },
      {
        title: "Rotina Diária",
        lessons: [
          {
            title: "Sequência rápida de 10 minutos",
            durationSeconds: 600,
            resources: [{ name: "Guia da sequência.pdf", type: "PDF", sizeBytes: 90_000 }],
          },
          { title: "Mindfulness antes de dormir", durationSeconds: 340 },
        ],
      },
    ],
  },
  {
    title: "Educação Financeira do Zero",
    slug: "educacao-financeira-do-zero",
    description:
      "Organiza as tuas finanças pessoais: orçamento, poupança, investimento básico e como sair de dívidas de forma prática.",
    category: "Finanças Pessoais",
    level: "beginner",
    published: true,
    price: 19.99,
    rating: 4.5,
    ratingCount: 430,
    instructor: "carlos",
    learningOutcomes: [
      "Criar e seguir um orçamento pessoal simples",
      "Cortar despesas sem sacrificar qualidade de vida",
      "Construir um fundo de emergência",
      "Dar os primeiros passos em investimentos",
    ],
    requirements: ["Nenhum conhecimento prévio de finanças"],
    targetAudience: [
      "Quem quer organizar as finanças pessoais pela primeira vez",
      "Pessoas a tentar sair de dívidas",
      "Quem quer começar a poupar e investir com segurança",
    ],
    topics: ["Finanças Pessoais", "Orçamento", "Poupança", "Investimentos"],
    modules: [
      {
        title: "Organizar o Orçamento",
        lessons: [
          {
            title: "Como fazer um orçamento simples",
            durationSeconds: 300,
            isFreePreview: true,
            resources: [{ name: "Template de orçamento.xlsx", type: "OTHER", sizeBytes: 55_000 }],
          },
          { title: "Cortar despesas sem sofrimento", durationSeconds: 340 },
        ],
      },
      {
        title: "Poupar e Investir",
        lessons: [
          {
            title: "Criar um fundo de emergência",
            durationSeconds: 320,
            resources: [{ name: "Checklist de poupança.pdf", type: "PDF", sizeBytes: 80_000 }],
          },
          { title: "Primeiros passos em investimentos", durationSeconds: 380 },
        ],
      },
    ],
  },
  {
    title: "Cozinha Rápida do Dia a Dia",
    slug: "cozinha-rapida-do-dia-a-dia",
    description:
      "Receitas práticas e rápidas para o dia a dia, técnicas básicas de confeção e planeamento de refeições para a semana.",
    category: "Culinária",
    level: "beginner",
    published: true,
    price: 14.99,
    rating: 4.6,
    ratingCount: 310,
    instructor: "ana",
    learningOutcomes: [
      "Dominar cortes e técnicas básicas de faca",
      "Usar temperos e bases de sabor com confiança",
      "Planear refeições para a semana toda",
      "Cozinhar receitas completas em menos de 20 minutos",
    ],
    requirements: ["Uma cozinha básica equipada", "Nenhuma experiência prévia em cozinhar"],
    targetAudience: [
      "Quem tem pouco tempo para cozinhar no dia a dia",
      "Iniciantes na cozinha que querem ganhar confiança",
      "Estudantes ou pessoas a viver sozinhas pela primeira vez",
    ],
    topics: ["Culinária", "Receitas Rápidas", "Planeamento de Refeições"],
    modules: [
      {
        title: "Técnicas Básicas",
        lessons: [
          {
            title: "Facas, cortes e mise en place",
            durationSeconds: 260,
            isFreePreview: true,
            resources: [{ name: "Slides - Técnicas básicas.pptx", type: "SLIDES", sizeBytes: 450_000 }],
          },
          { title: "Temperos e bases de sabor", durationSeconds: 300 },
        ],
      },
      {
        title: "Refeições da Semana",
        lessons: [
          {
            title: "Planear refeições para 5 dias",
            durationSeconds: 340,
            resources: [{ name: "Plano semanal.pdf", type: "PDF", sizeBytes: 70_000 }],
          },
          { title: "3 receitas em menos de 20 minutos", durationSeconds: 400 },
        ],
      },
    ],
  },
  {
    title: "Produtividade e Gestão do Tempo",
    slug: "produtividade-e-gestao-do-tempo",
    description:
      "Técnicas práticas para organizar o teu dia, eliminar distrações e criar hábitos que aumentam o foco e a produtividade real.",
    category: "Desenvolvimento Pessoal",
    level: "beginner",
    published: true,
    price: 0,
    rating: 4.6,
    ratingCount: 720,
    instructor: "ana",
    learningOutcomes: [
      "Identificar porque falhas a gerir o teu tempo",
      "Priorizar tarefas com a matriz de Eisenhower",
      "Criar uma rotina diária que realmente segues",
      "Eliminar distrações digitais que roubam o teu foco",
    ],
    requirements: ["Nenhuma ferramenta especial necessária", "Vontade de mudar hábitos"],
    targetAudience: [
      "Quem sente que nunca tem tempo suficiente",
      "Profissionais e estudantes que querem mais foco",
      "Quem já tentou várias apps de produtividade sem resultado",
    ],
    topics: ["Produtividade", "Gestão do Tempo", "Hábitos", "Foco"],
    modules: [
      {
        title: "Fundamentos da Produtividade",
        lessons: [
          {
            title: "Porque falhamos a gerir o tempo",
            durationSeconds: 260,
            isFreePreview: true,
            resources: [{ name: "Slides - Fundamentos.pptx", type: "SLIDES", sizeBytes: 470_000 }],
          },
          { title: "Definir prioridades com a matriz de Eisenhower", durationSeconds: 340 },
        ],
      },
      {
        title: "Hábitos e Ferramentas",
        lessons: [
          {
            title: "Criar uma rotina diária eficaz",
            durationSeconds: 320,
            resources: [{ name: "Template de rotina.pdf", type: "PDF", sizeBytes: 75_000 }],
          },
          { title: "Eliminar distrações digitais", durationSeconds: 280 },
        ],
      },
    ],
  },
  {
    title: "Fundamentos de Vendas",
    slug: "fundamentos-de-vendas",
    description:
      "Aprende a estrutura de uma venda eficaz: prospeção, negociação, lidar com objeções e fechar negócios com confiança.",
    category: "Vendas",
    level: "beginner",
    published: true,
    price: 27.99,
    rating: 4.4,
    ratingCount: 275,
    instructor: "carlos",
    learningOutcomes: [
      "Entender as etapas de uma venda de sucesso",
      "Prospetar os clientes certos para o teu negócio",
      "Responder a objeções comuns com confiança",
      "Fechar negócios sem parecer insistente",
    ],
    requirements: ["Nenhuma experiência prévia em vendas"],
    targetAudience: [
      "Quem está a começar numa carreira de vendas",
      "Donos de negócio que vendem os próprios produtos ou serviços",
      "Freelancers que precisam de fechar mais clientes",
    ],
    topics: ["Vendas", "Negociação", "Prospeção", "Fecho de Negócio"],
    modules: [
      {
        title: "O Processo de Venda",
        lessons: [
          {
            title: "As etapas de uma venda de sucesso",
            durationSeconds: 300,
            isFreePreview: true,
            resources: [{ name: "Slides - Processo de venda.pptx", type: "SLIDES", sizeBytes: 500_000 }],
          },
          { title: "Como prospetar clientes certos", durationSeconds: 340 },
        ],
      },
      {
        title: "Negociação e Fecho",
        lessons: [
          {
            title: "Responder a objeções comuns",
            durationSeconds: 360,
            resources: [{ name: "Guia de objeções.pdf", type: "PDF", sizeBytes: 95_000 }],
          },
          { title: "Técnicas de fecho de negócio", durationSeconds: 310 },
        ],
      },
    ],
  },
  {
    title: "Desenho e Ilustração Digital",
    slug: "desenho-e-ilustracao-digital",
    description:
      "Do esboço à ilustração final: fundamentos de desenho, cor e composição usando ferramentas digitais acessíveis.",
    category: "Arte e Ilustração",
    level: "beginner",
    published: true,
    price: 22.99,
    rating: 4.7,
    ratingCount: 380,
    instructor: "ana",
    learningOutcomes: [
      "Desenhar formas básicas com proporção correta",
      "Aplicar luz, sombra e volume nos teus desenhos",
      "Configurar e usar ferramentas de ilustração digital",
      "Colorir e finalizar uma ilustração do início ao fim",
    ],
    requirements: ["Um tablet gráfico ou telemóvel/tablet com caneta", "Nenhuma experiência prévia em desenho"],
    targetAudience: [
      "Iniciantes que querem aprender a desenhar do zero",
      "Quem quer migrar do papel para a ilustração digital",
      "Criadores de conteúdo que querem produzir as próprias ilustrações",
    ],
    topics: ["Desenho", "Ilustração Digital", "Cor", "Composição"],
    modules: [
      {
        title: "Fundamentos do Desenho",
        lessons: [
          {
            title: "Formas básicas e proporção",
            durationSeconds: 280,
            isFreePreview: true,
            resources: [{ name: "Slides - Formas e proporção.pptx", type: "SLIDES", sizeBytes: 490_000 }],
          },
          { title: "Luz, sombra e volume", durationSeconds: 320 },
        ],
      },
      {
        title: "Ilustração Digital",
        lessons: [
          {
            title: "Configurar o teu primeiro documento digital",
            durationSeconds: 300,
            resources: [{ name: "Paleta de exemplo.png", type: "IMAGE", sizeBytes: 190_000 }],
          },
          { title: "Colorir e finalizar uma ilustração", durationSeconds: 380 },
        ],
      },
    ],
  },
  {
    title: "Excel para Negócios",
    slug: "excel-para-negocios",
    description:
      "Domina o Excel para o trabalho: fórmulas, tabelas dinâmicas, dashboards simples e automação básica para decisões de negócio mais rápidas.",
    category: "Negócios",
    level: "beginner",
    published: true,
    price: 24.99,
    rating: 4.5,
    ratingCount: 540,
    instructor: "carlos",
    learningOutcomes: [
      "Usar fórmulas essenciais do Excel no dia a dia de trabalho",
      "Criar tabelas dinâmicas para analisar dados rapidamente",
      "Construir um dashboard simples para acompanhar métricas",
      "Automatizar tarefas repetitivas com funções básicas",
    ],
    requirements: ["Excel ou Google Sheets instalado", "Nenhuma experiência prévia necessária"],
    targetAudience: [
      "Profissionais que usam Excel no trabalho mas querem ser mais rápidos",
      "Quem quer criar relatórios e dashboards para a equipa",
      "Estudantes de gestão e negócios",
    ],
    topics: ["Excel", "Tabelas Dinâmicas", "Dashboards", "Produtividade"],
    modules: [
      {
        title: "Fórmulas Essenciais",
        lessons: [
          {
            title: "Fórmulas que todos deviam saber",
            durationSeconds: 320,
            isFreePreview: true,
            resources: [{ name: "Slides - Fórmulas essenciais.pptx", type: "SLIDES", sizeBytes: 520_000 }],
          },
          { title: "Referências relativas vs absolutas", durationSeconds: 280 },
        ],
      },
      {
        title: "Análise de Dados",
        lessons: [
          {
            title: "Criar a tua primeira tabela dinâmica",
            durationSeconds: 400,
            resources: [{ name: "Dataset de prática.xlsx", type: "OTHER", sizeBytes: 68_000 }],
          },
          { title: "Construir um dashboard simples", durationSeconds: 420 },
        ],
      },
    ],
  },
  {
    title: "Copywriting que Vende",
    slug: "copywriting-que-vende",
    description:
      "Escreve textos persuasivos para anúncios, emails e redes sociais que realmente convertem leitores em clientes.",
    category: "Marketing",
    level: "intermediate",
    published: true,
    price: 29.99,
    rating: 4.6,
    ratingCount: 320,
    instructor: "carlos",
    learningOutcomes: [
      "Escrever headlines que capturam atenção",
      "Estruturar textos persuasivos usando gatilhos mentais",
      "Criar emails que geram vendas sem parecer spam",
      "Adaptar o teu copy a diferentes plataformas e públicos",
    ],
    requirements: ["Nenhuma experiência prévia em copywriting"],
    targetAudience: [
      "Donos de negócio que escrevem os próprios anúncios",
      "Profissionais de marketing que querem melhorar conversões",
      "Freelancers que querem oferecer copywriting como serviço",
    ],
    topics: ["Copywriting", "Marketing", "Vendas", "Email Marketing"],
    modules: [
      {
        title: "Fundamentos do Copywriting",
        lessons: [
          {
            title: "Como escrever headlines irresistíveis",
            durationSeconds: 300,
            isFreePreview: true,
            resources: [{ name: "Slides - Headlines.pptx", type: "SLIDES", sizeBytes: 470_000 }],
          },
          { title: "Gatilhos mentais que funcionam", durationSeconds: 360 },
        ],
      },
      {
        title: "Copy na Prática",
        lessons: [
          {
            title: "Escrever um email de vendas do zero",
            durationSeconds: 380,
            resources: [{ name: "Template de email.pdf", type: "PDF", sizeBytes: 85_000 }],
          },
          { title: "Adaptar o copy a redes sociais", durationSeconds: 300 },
        ],
      },
    ],
  },
  {
    title: "Guitarra para Iniciantes",
    slug: "guitarra-para-iniciantes",
    description:
      "Aprende a tocar guitarra do zero: acordes essenciais, ritmo, e as tuas primeiras músicas completas em poucas semanas.",
    category: "Música",
    level: "beginner",
    published: true,
    price: 19.99,
    rating: 4.8,
    ratingCount: 465,
    instructor: "ana",
    learningOutcomes: [
      "Tocar os acordes essenciais de guitarra",
      "Manter ritmo constante com diferentes padrões de batida",
      "Trocar entre acordes de forma fluida",
      "Tocar a tua primeira música completa",
    ],
    requirements: ["Uma guitarra acústica ou elétrica", "Nenhuma experiência prévia necessária"],
    targetAudience: [
      "Quem sempre quis aprender a tocar guitarra",
      "Iniciantes completos sem qualquer base musical",
      "Quem quer aprender a acompanhar músicas simples",
    ],
    topics: ["Guitarra", "Música", "Acordes", "Ritmo"],
    modules: [
      {
        title: "Primeiros Acordes",
        lessons: [
          {
            title: "Postura e afinação da guitarra",
            durationSeconds: 260,
            isFreePreview: true,
            resources: [{ name: "Slides - Afinação.pptx", type: "SLIDES", sizeBytes: 440_000 }],
          },
          { title: "Os 4 acordes que abrem 100 músicas", durationSeconds: 400 },
        ],
      },
      {
        title: "Ritmo e Prática",
        lessons: [
          {
            title: "Padrões de batida essenciais",
            durationSeconds: 340,
            resources: [{ name: "Tablatura de prática.pdf", type: "PDF", sizeBytes: 60_000 }],
          },
          { title: "Tocar a tua primeira música completa", durationSeconds: 450 },
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

  const anaBio =
    "Ex-engenheira de software com mais de 10 anos de experiência em produto e frontend. Apaixonada por ensinar de forma prática, com projetos reais em vez de teoria solta.";
  const carlosBio =
    "Analista de dados e consultor de negócio há 13 anos. Já ajudei dezenas de equipas a tomar decisões melhores com dados — agora traz essa experiência para os cursos.";

  const anaSocials = {
    websiteUrl: "https://anarodrigues.dev",
    twitterUrl: "https://x.com/anarodrigues",
    linkedinUrl: "https://linkedin.com/in/anarodrigues",
    youtubeUrl: "https://youtube.com/@anarodrigues",
  };
  const carlosSocials = {
    websiteUrl: "https://carlosmendes.consulting",
    linkedinUrl: "https://linkedin.com/in/carlosmendes",
  };

  const ana = await prisma.user.upsert({
    where: { email: "instrutor@example.com" },
    update: { bio: anaBio, ...anaSocials },
    create: {
      name: "Ana Rodrigues",
      email: "instrutor@example.com",
      passwordHash,
      role: "INSTRUCTOR",
      bio: anaBio,
      ...anaSocials,
    },
  });

  const carlos = await prisma.user.upsert({
    where: { email: "carlos@example.com" },
    update: { bio: carlosBio, ...carlosSocials },
    create: {
      name: "Carlos Mendes",
      email: "carlos@example.com",
      passwordHash,
      role: "INSTRUCTOR",
      bio: carlosBio,
      ...carlosSocials,
    },
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

  const miguel = await prisma.user.upsert({
    where: { email: "miguel@example.com" },
    update: {},
    create: { name: "Miguel Santos", email: "miguel@example.com", passwordHash, role: "STUDENT" },
  });

  const carla = await prisma.user.upsert({
    where: { email: "carla@example.com" },
    update: {},
    create: { name: "Carla Nunes", email: "carla@example.com", passwordHash, role: "STUDENT" },
  });

  const tiago = await prisma.user.upsert({
    where: { email: "tiago@example.com" },
    update: {},
    create: { name: "Tiago Silva", email: "tiago@example.com", passwordHash, role: "STUDENT" },
  });

  const beatriz = await prisma.user.upsert({
    where: { email: "beatriz@example.com" },
    update: {},
    create: { name: "Beatriz Costa", email: "beatriz@example.com", passwordHash, role: "STUDENT" },
  });

  const reviewers = [bruno, sofia, miguel, carla, tiago, beatriz];
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
      update: {
        trailerUrl: PEXELS_TRAILERS[c.slug] ?? null,
        learningOutcomes: c.learningOutcomes ?? [],
        requirements: c.requirements ?? [],
        targetAudience: c.targetAudience ?? [],
        topics: c.topics ?? [],
      },
      create: {
        title: c.title,
        slug: c.slug,
        description: c.description,
        category: c.category,
        level: c.level,
        published: c.published,
        price: c.price,
        originalPrice: c.originalPrice ?? null,
        rating: c.rating,
        ratingCount: c.ratingCount,
        thumbnailUrl: c.published ? thumb(c.slug) : null,
        trailerUrl: PEXELS_TRAILERS[c.slug] ?? null,
        learningOutcomes: c.learningOutcomes ?? [],
        requirements: c.requirements ?? [],
        targetAudience: c.targetAudience ?? [],
        topics: c.topics ?? [],
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
                type: l.type ?? "VIDEO",
                contentUrl: l.type === "TEXT" ? null : SAMPLE_VIDEO,
                textContent: l.type === "TEXT" ? l.textContent ?? null : null,
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

  // Converte a aula "Bem-vindo ao curso" para aula de texto (demonstra o tipo TEXT);
  // não afeta reseeds — só atualiza a aula já existente com esse título.
  await prisma.lesson.updateMany({
    where: { module: { courseId: courses["introducao-ao-nextjs"].id }, title: "Bem-vindo ao curso" },
    data: {
      type: "TEXT",
      contentUrl: null,
      textContent:
        "Bem-vindo ao curso de Next.js 14!\n\nNeste curso vais aprender a construir uma aplicação completa, do zero até ao deploy, usando o App Router, Server Components e Prisma.\n\nAntes de começares, recomendamos que tenhas o Node.js instalado e conhecimentos básicos de JavaScript e React. Cada módulo tem exercícios práticos — não saltes nenhum!\n\nVamos a isto.",
    },
  });

  // Mesma conversão para mais algumas aulas, para haver aulas de texto em vários cursos.
  await prisma.lesson.updateMany({
    where: { module: { courseId: courses["design-de-interfaces"].id }, title: "O que é um bom design" },
    data: {
      type: "TEXT",
      contentUrl: null,
      textContent:
        "Bom design não é sobre parecer bonito — é sobre ser claro.\n\nUma interface bem desenhada guia o utilizador sem que ele precise de pensar: os botões parecem clicáveis, a informação mais importante salta à vista primeiro, e os erros são fáceis de entender e corrigir.\n\nNeste curso vamos focar-nos em três pilares: hierarquia visual, consistência e feedback. Não precisas de ser designer para aplicar isto — precisas de saber olhar para uma interface e perguntar 'o que é que o utilizador precisa de ver primeiro?'",
    },
  });
  await prisma.lesson.updateMany({
    where: { module: { courseId: courses["python-ciencia-de-dados"].id }, title: "Variáveis, tipos e estruturas de dados" },
    data: {
      type: "TEXT",
      contentUrl: null,
      textContent:
        "Python guarda dados em variáveis sem precisares de declarar o tipo à partida — o tipo é decidido pelo valor que atribuis.\n\nOs tipos base que vais usar mais são: int (números inteiros), float (números decimais), str (texto) e bool (verdadeiro/falso).\n\nPara guardar várias informações juntas, tens as estruturas de dados: list (lista ordenada e alterável), tuple (lista ordenada e imutável), dict (pares chave-valor) e set (coleção sem duplicados).\n\nExperimenta no teu terminal Python: cria uma lista de números, um dicionário com o teu nome e idade, e usa type() para confirmares o tipo de cada variável.",
    },
  });
  await prisma.lesson.updateMany({
    where: { module: { courseId: courses["typescript-para-iniciantes"].id }, title: "Porque usar TypeScript" },
    data: {
      type: "TEXT",
      contentUrl: null,
      textContent:
        "TypeScript é JavaScript com um sistema de tipos por cima. Todo o código JavaScript válido já é TypeScript válido — a diferença é que TypeScript te avisa de erros antes de correres o código.\n\nSem tipos, um erro como chamar .toUpperCase() num número só aparece quando o código corre (às vezes só em produção). Com TypeScript, o editor sublinha o erro enquanto escreves.\n\nOutras vantagens práticas: autocomplete muito mais preciso, refactors mais seguros (o compilador avisa-te de tudo o que quebraste), e documentação viva — os tipos dizem-te exatamente o que uma função espera receber e devolver, sem precisares de ler a implementação.",
    },
  });

  await enroll(bruno.id, "introducao-ao-nextjs", 1);
  await enroll(bruno.id, "python-ciencia-de-dados", 0.4);
  await enroll(bruno.id, "fotografia-com-telemovel", 0);

  await enroll(sofia.id, "design-de-interfaces", 0.5);
  await enroll(sofia.id, "marketing-digital-do-zero", 1);
  await enroll(sofia.id, "gestao-de-projetos-ageis", 0.25);
  await enroll(sofia.id, "react-avancado-performance", 0);

  async function ensureBundle(name: string, instructorId: string, slugs: string[]) {
    let bundle = await prisma.bundle.findFirst({ where: { name, instructorId } });
    if (!bundle) {
      bundle = await prisma.bundle.create({ data: { name, instructorId } });
    }
    await prisma.course.updateMany({
      where: { slug: { in: slugs } },
      data: { bundleId: bundle.id },
    });
  }

  await ensureBundle("Pacote Frontend Moderno", ana.id, ["introducao-ao-nextjs", "typescript-para-iniciantes"]);
  await ensureBundle("Pacote Data & Backend", carlos.id, [
    "python-ciencia-de-dados",
    "nodejs-apis-rest",
    "react-avancado-performance",
  ]);
  await ensureBundle("Pacote Criativo Completo", ana.id, [
    "design-de-interfaces",
    "fotografia-com-telemovel",
    "producao-musical-ableton",
    "guitarra-para-iniciantes",
  ]);
  await ensureBundle("Pacote Gestão & Marketing", carlos.id, [
    "marketing-digital-do-zero",
    "gestao-de-projetos-ageis",
    "excel-para-negocios",
    "copywriting-que-vende",
  ]);
  await ensureBundle("Pacote Bem-estar & Criatividade", ana.id, [
    "yoga-e-mindfulness",
    "cozinha-rapida-do-dia-a-dia",
    "produtividade-e-gestao-do-tempo",
    "desenho-e-ilustracao-digital",
  ]);
  await ensureBundle("Pacote Vendas & Finanças", carlos.id, [
    "ingles-para-viagens",
    "educacao-financeira-do-zero",
    "fundamentos-de-vendas",
  ]);

  const REVIEW_COMMENTS: Record<number, string[]> = {
    5: [
      "Curso excelente, recomendo a qualquer pessoa que queira aprender a sério.",
      "Aprendi imenso, o instrutor explica tudo de forma muito clara.",
      "Conteúdo muito bem estruturado, superou as minhas expectativas.",
      "Um dos melhores cursos que já fiz nesta área.",
      "Didática excelente, dá mesmo vontade de continuar a aprender.",
    ],
    4: [
      "Muito bom, só senti falta de mais exercícios práticos.",
      "Curso sólido, algumas partes podiam ser mais aprofundadas.",
      "Gostei bastante, o instrutor explica bem e o ritmo é bom.",
      "Boa relação qualidade-preço, recomendo.",
    ],
    3: [
      "Curso ok, mas esperava um pouco mais de profundidade.",
      "Conteúdo básico, serve bem para quem está a começar.",
    ],
  };
  const REVIEW_RATING_POOL = [5, 5, 5, 4, 4, 3];

  for (const c of courseSeeds) {
    if (!c.published) continue;
    const course = courses[c.slug];
    const numReviews = 3 + (course.title.length % 4); // varia entre 3 e 6 reviews por curso
    const courseReviewers = shuffle(reviewers).slice(0, numReviews);

    for (let i = 0; i < courseReviewers.length; i++) {
      const reviewer = courseReviewers[i];
      const rating = REVIEW_RATING_POOL[(course.title.length + i) % REVIEW_RATING_POOL.length];
      const comments = REVIEW_COMMENTS[rating];
      const comment = comments[(course.title.length + i * 7) % comments.length];
      const createdAt = new Date(Date.now() - (i + 1) * 9 * 24 * 60 * 60 * 1000);

      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: reviewer.id, courseId: course.id } },
        update: {},
        create: { userId: reviewer.id, courseId: course.id, enrolledAt: createdAt },
      });

      await prisma.review.upsert({
        where: { userId_courseId: { userId: reviewer.id, courseId: course.id } },
        update: { rating, comment },
        create: { userId: reviewer.id, courseId: course.id, rating, comment, createdAt },
      });
    }

    const agg = await prisma.review.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.course.update({
      where: { id: course.id },
      data: {
        rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : c.rating,
        ratingCount: agg._count,
      },
    });
  }

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

  // Quiz de módulo já não é 1:1 (pode haver vários por módulo, intercalados
  // com as aulas por `order`) — cria só se ainda não houver nenhum, em vez
  // de upsert por moduleId.
  if (!(await prisma.quiz.findFirst({ where: { moduleId: firstModule.id } }))) {
    await prisma.quiz.create({
      data: {
        scope: "MODULE",
        title: "Quiz: Primeiros Passos",
        moduleId: firstModule.id,
        order: await prisma.lesson.count({ where: { moduleId: firstModule.id } }),
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
  }

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
    // Não é mais 1:1 por moduleId — cria só se este módulo ainda não tiver nenhum.
    if (await prisma.quiz.findFirst({ where: { moduleId: mod.id } })) continue;
    await prisma.quiz.create({
      data: {
        scope: "MODULE",
        title: `Quiz: ${mod.title}`,
        moduleId: mod.id,
        order: mod.lessons.length,
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
