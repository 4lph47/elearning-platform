import Link from "next/link";
import { unstable_cache } from "next/cache";
import { GraduationCap } from "lucide-react";
import { prisma } from "@/lib/db";

// Rodapé é igual em todas as páginas — cache partilhado evita 1 query à BD
// por página carregada (e por página gerada no build).
const fetchCategories = unstable_cache(
  async () => {
    const rows = await prisma.course.findMany({
      where: { published: true },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
      take: 8,
    });
    return rows.map((r) => r.category);
  },
  ["footer-categories"],
  { revalidate: 300, tags: ["courses"] }
);

export async function Footer() {
  // Nunca deixar uma falha transitória da BD (rede, pooler) derrubar a página
  // toda por causa do rodapé — degrada para sem categorias em vez de rebentar.
  const categories = await fetchCategories().catch(() => []);
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
        { label: "A minha conta", href: "/account" },
        { label: "Privacidade", href: "/privacidade" },
        { label: "Termos e Serviços", href: "/termos" },
      ],
    },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white dark:border-white/10 dark:bg-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <GraduationCap size={18} />
              </span>
              E-Learn
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              Aprende ao teu ritmo com cursos criados por instrutores reais.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{col.title}</h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-white/10">
          © {year} E-Learn. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
