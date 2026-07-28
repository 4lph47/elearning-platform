"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ShieldCheck, Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { Badge } from "@/components/ui/Card";

export default function SettingsSecurityPage() {
  const { data: session, update } = useSession();
  const hasPassword = Boolean(session?.user.hasPassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: hasPassword ? currentPassword : undefined, newPassword }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Não foi possível alterar a password");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setSaved(true);
    await update();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title={hasPassword ? "Alterar password" : "Definir password"}
        description={
          hasPassword
            ? "Precisas da password atual para definir uma nova."
            : "A tua conta entrou por Google/link mágico — define uma password para também poderes entrar com email e password."
        }
      >
        <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
          {hasPassword && (
            <div>
              <Label htmlFor="currentPassword">Password atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="newPassword">Nova password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />} Guardar
            </Button>
            {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Password atualizada.</span>}
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Autenticação de dois fatores" description="Camada extra de segurança com um código temporário.">
        <div className="flex items-center gap-2 opacity-60">
          <ShieldCheck size={16} />
          <span className="text-sm text-slate-600 dark:text-slate-300">Autenticação por app/SMS</span>
          <Badge tone="warning">Em breve</Badge>
        </div>
      </SettingsSection>

      <SettingsSection title="Alertas de login" description="Aviso por email sempre que a tua conta entra num dispositivo novo.">
        <div className="flex items-center gap-2 opacity-60">
          <Bell size={16} />
          <span className="text-sm text-slate-600 dark:text-slate-300">Notificar novos acessos</span>
          <Badge tone="warning">Em breve</Badge>
        </div>
      </SettingsSection>
    </div>
  );
}
