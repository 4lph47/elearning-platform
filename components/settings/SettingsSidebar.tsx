"use client";

import { usePathname } from "next/navigation";
import { FadeLink } from "@/components/course/FadeLink";
import {
  UserCog,
  KeyRound,
  Megaphone,
  Eye,
  Users,
  Ban,
  Bell,
  Globe,
  MoonStar,
  Link2,
  ShoppingBag,
  Store,
  CreditCard,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface Group {
  title: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    title: "Central de Contas",
    items: [
      { href: "/settings/account", label: "Dados pessoais", icon: UserCog },
      { href: "/settings/security", label: "Senha e segurança", icon: KeyRound },
      { href: "/settings/ads", label: "Preferências de anúncios", icon: Megaphone },
    ],
  },
  {
    title: "Privacidade e Visibilidade",
    items: [
      { href: "/settings/privacy", label: "Ferramentas de privacidade", icon: Eye },
      { href: "/settings/communities", label: "Comunidades", icon: Users },
      { href: "/settings/blocked", label: "Bloqueio", icon: Ban },
    ],
  },
  {
    title: "Vendas e Compras",
    items: [
      { href: "/settings/sales", label: "Venda", icon: Store },
      { href: "/settings/resale", label: "Revenda", icon: ShoppingBag },
      { href: "/settings/payments", label: "Pagamentos", icon: CreditCard },
    ],
  },
  {
    title: "Preferências e Aplicativos",
    items: [
      { href: "/settings/courses", label: "Cursos", icon: BookOpen },
      { href: "/settings/notifications", label: "Notificações", icon: Bell },
      { href: "/settings/language", label: "Idioma e região", icon: Globe },
      { href: "/settings/appearance", label: "Aparência", icon: MoonStar },
      { href: "/settings/connections", label: "Aplicativos e sites", icon: Link2 },
    ],
  },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full shrink-0 flex-col gap-5 sm:w-56">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <FadeLink
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={16} />
                  <span className="truncate">{item.label}</span>
                </FadeLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
