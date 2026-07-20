import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { prisma } from "@/lib/db";

async function fetchCategories() {
  const rows = await prisma.course.findMany({
    where: { published: true },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
    take: 8,
  });
  return rows.map((r) => r.category);
}

export async function Footer() {
  const categories = await fetchCategories();
  const year = new Date().getFullYear();

  const columns: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Categorias",
      links: categories.map((c) => ({ label: c, href: `/courses?category=${encodeURIComponent(c)}` })),
    },
    {
      title: "Plataforma",
      links: [
        { label: "Catálogo de cursos", href: "/courses" },
        { label: "Instrutores", href: "/instructors" },
        { label: "Cursos gratuitos", href: "/courses?price=free" },
        { label: "O meu dashboard", href: "/dashboard" },
      ],
    },
    {
      title: "Ensinar",
      links: [
        { label: "Torna-te instrutor", href: "/register" },
        { label: "Área de instrutor", href: "/instructor" },
        { label: "Criar um curso", href: "/instructor/courses/new" },
      ],
    },
    {
      title: "Conta",
      links: [
        { label: "Iniciar sessão", href: "/login" },
        { label: "Criar conta", href: "/register" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <GraduationCap size={18} />
              </span>
              E-Learn
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-400">
              Aprende ao teu ritmo com cursos criados por instrutores reais.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-white">{col.title}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-slate-400 hover:text-white hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-slate-500">
          © {year} E-Learn. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
