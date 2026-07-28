import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl py-10">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Definições</h1>
      <div className="mt-6 flex flex-col gap-8 sm:flex-row sm:gap-10">
        <SettingsSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
