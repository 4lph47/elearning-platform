import Link from "next/link";
import { GraduationCap, Check } from "lucide-react";

const FEATURES = [
  "Cursos criados por instrutores reais",
  "Aprende ao teu ritmo, em qualquer dispositivo",
  "Certificados e acompanhamento de progresso",
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-57px)] w-full">
      <div className="relative hidden w-1/2 shrink-0 overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />
          <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        </div>

        <Link href="/" className="relative flex w-fit items-center gap-2 text-lg font-bold text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-950/40">
            <GraduationCap size={20} />
          </span>
          E-Learn
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-3xl font-bold leading-tight text-white">
            Aprende novas competências, ao teu ritmo.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-slate-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  <Check size={12} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} E-Learn. Todos os direitos reservados.
        </p>
      </div>

      <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden bg-white px-4 py-16 dark:bg-black">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-900/20 blur-3xl dark:bg-blue-900/30" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="mx-auto flex w-fit items-center gap-2 text-lg font-bold text-slate-900 dark:text-white lg:hidden"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/40">
                <GraduationCap size={22} />
              </span>
              E-Learn
            </Link>
            <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white lg:mt-0">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>

          {children}

          {footer && <div className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
