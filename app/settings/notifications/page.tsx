"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/settings/SettingsSection";

interface NotifData {
  notifyPush: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
}

export default function SettingsNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NotifData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d: NotifData) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  async function patch(partial: Partial<NotifData>) {
    setData((d) => (d ? { ...d, ...partial } : d));
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    setSaving(false);
  }

  if (loading || !data) return <p className="text-sm text-slate-400">A carregar...</p>;

  return (
    <SettingsSection
      title="Como queres ser avisado"
      description="Menções, respostas a comentários e alterações de comissões de revenda geram notificações — escolhe onde as receber."
    >
      <div className="space-y-3">
        <Toggle
          checked={data.notifyPush}
          onChange={(v) => patch({ notifyPush: v })}
          labelPosition="left"
          label="Notificações no sino da plataforma"
        />
        <Toggle
          checked={data.notifyEmail}
          onChange={(v) => patch({ notifyEmail: v })}
          labelPosition="left"
          label="Notificações por email"
        />
        <Toggle
          checked={data.notifySms}
          onChange={(v) => patch({ notifySms: v })}
          labelPosition="left"
          label="Notificações por SMS"
        />
      </div>
      {saving && <p className="mt-2 text-xs text-slate-400">A guardar...</p>}
    </SettingsSection>
  );
}
