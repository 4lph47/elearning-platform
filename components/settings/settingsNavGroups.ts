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

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SettingsNavGroup {
  title: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
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
