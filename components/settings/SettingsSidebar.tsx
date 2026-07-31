"use client";

import { usePathname } from "next/navigation";
import { FadeLink } from "@/components/course/FadeLink";
import { SETTINGS_NAV_GROUPS } from "@/components/settings/settingsNavGroups";

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-full shrink-0 flex-col gap-5 sm:flex sm:w-56">
      {SETTINGS_NAV_GROUPS.map((group) => (
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
