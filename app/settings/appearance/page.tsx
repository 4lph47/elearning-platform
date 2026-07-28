"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Check } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ACCENT_COLORS } from "@/components/layout/AppearanceEffects";

const FONT_SIZE_OPTIONS: { value: "sm" | "md" | "lg"; label: string }[] = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
];

export default function SettingsAppearancePage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accentColor, setAccentColor] = useState("blue");
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => {
        setAccentColor(d.accentColor ?? "blue");
        setFontSize(d.fontSize ?? "md");
        setReduceMotion(Boolean(d.reduceMotion));
      })
      .finally(() => setLoading(false));
  }, []);

  async function patch(partial: Record<string, unknown>) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
  }

  function handleAccentChange(key: string) {
    setAccentColor(key);
    const palette = ACCENT_COLORS[key];
    document.documentElement.style.setProperty("--accent", palette.accent);
    document.documentElement.style.setProperty("--accent-hover", palette.hover);
    patch({ accentColor: key });
  }

  function handleFontSizeChange(value: "sm" | "md" | "lg") {
    setFontSize(value);
    document.documentElement.setAttribute("data-font-size", value);
    patch({ fontSize: value });
  }

  function handleReduceMotionChange(value: boolean) {
    setReduceMotion(value);
    document.documentElement.setAttribute("data-reduce-motion", String(value));
    patch({ reduceMotion: value });
  }

  if (!mounted) return null;
  const isDark = resolvedTheme === "dark";

  return (
    <div className="space-y-5">
      <SettingsSection title="Tema" description="Escolhe entre tema claro ou escuro para toda a plataforma.">
        <div className="flex gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border px-4 py-4 text-sm font-medium transition-colors duration-150 ${
              !isDark
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            <Sun size={20} /> Claro
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border px-4 py-4 text-sm font-medium transition-colors duration-150 ${
              isDark
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            <Moon size={20} /> Escuro
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Cor de destaque"
        description="Aplica-se aos botões principais e aos interruptores — o resto da interface mantém-se neutro."
      >
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACCENT_COLORS).map(([key, palette]) => (
              <button
                key={key}
                onClick={() => handleAccentChange(key)}
                aria-label={palette.label}
                title={palette.label}
                className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-white transition-transform duration-150 hover:scale-110 dark:ring-offset-neutral-900"
                style={{
                  backgroundColor: palette.accent,
                  ...({ "--tw-ring-color": accentColor === key ? palette.accent : "transparent" } as React.CSSProperties),
                }}
              >
                {accentColor === key && <Check size={16} className="text-white" />}
              </button>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Tamanho do texto" description="Ajusta a escala de toda a plataforma.">
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : (
          <div className="flex gap-2">
            {FONT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleFontSizeChange(opt.value)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  fontSize === opt.value
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Movimento" description="Reduz transições e animações em toda a plataforma.">
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : (
          <Toggle
            checked={reduceMotion}
            onChange={handleReduceMotionChange}
            labelPosition="left"
            label="Reduzir animações"
          />
        )}
      </SettingsSection>
    </div>
  );
}
