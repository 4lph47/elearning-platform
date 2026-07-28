"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Download, Trash2, Briefcase, Loader2, X } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { UsernameField } from "@/components/account/UsernameField";
import { SettingsSection } from "@/components/settings/SettingsSection";

interface AccountData {
  name: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  emailVerified: string | null;
}

export default function SettingsAccountPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AccountData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d: AccountData) => {
        setData(d);
        setName(d.name);
        setPhone(d.phone ?? "");
        setBirthDate(d.birthDate ? d.birthDate.slice(0, 10) : "");
      });
    fetch("/api/account/username")
      .then((res) => res.json())
      .then((d: { username: string | null }) => setUsername(d.username));
  }, []);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: phone.trim() || null,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
      }),
    });
    setSavingProfile(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setProfileError(err.error ?? "Não foi possível guardar");
      return;
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  async function handleChangeEmail() {
    setEmailSending(true);
    setEmailError(null);
    setEmailSent(false);
    const res = await fetch("/api/settings/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim() }),
    });
    setEmailSending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setEmailError(err.error ?? "Não foi possível trocar o email");
      return;
    }
    setEmailSent(true);
    setData((d) => (d ? { ...d, email: newEmail.trim(), emailVerified: null } : d));
    setNewEmail("");
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "moz-academy-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    const err = await res.json().catch(() => ({}));
    setDeleteError(err.error ?? "Não foi possível eliminar a conta.");
    setDeleting(false);
    setShowDeleteModal(false);
  }

  if (!data) {
    return <p className="text-sm text-slate-400">A carregar...</p>;
  }

  return (
    <div className="space-y-5">
      <SettingsSection title="Dados pessoais" description="As informações que identificam a tua conta.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label htmlFor="phone">Número de telefone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+258 8X XXX XXXX"
              maxLength={30}
            />
          </div>
          <div>
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div>
            <Label>Username</Label>
            <UsernameField className="mt-0" />
          </div>
        </div>
        {profileError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{profileError}</p>}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "A guardar..." : "Guardar"}
          </Button>
          {profileSaved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Guardado.</span>}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Email"
        description={`Email atual: ${data.email}${data.emailVerified ? "" : " (por verificar)"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="novo@email.com"
            className="max-w-xs"
            type="email"
          />
          <Button onClick={handleChangeEmail} disabled={emailSending || !newEmail.trim()}>
            {emailSending && <Loader2 size={14} className="animate-spin" />} Trocar email
          </Button>
        </div>
        {emailError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{emailError}</p>}
        {emailSent && (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            Enviámos um código de confirmação para o novo email — vais ter de o introduzir no próximo acesso.
          </p>
        )}
      </SettingsSection>

      {session?.user.role === "STUDENT" && (
        <SettingsSection title="Tornar-me instrutor" description="Cria e vende os teus próprios cursos na plataforma.">
          <FadeLink
            href="/register/complete?role=instrutor"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            <Briefcase size={15} /> Continuar
          </FadeLink>
        </SettingsSection>
      )}

      <SettingsSection title="Exportar os meus dados" description="Descarrega uma cópia de tudo o que a tua conta gerou.">
        <Button onClick={handleExport} disabled={exporting} variant="primary">
          <Download size={15} /> {exporting ? "A exportar..." : "Exportar dados"}
        </Button>
      </SettingsSection>

      <SettingsSection title="Eliminar conta" description="Remove permanentemente a tua conta e todos os dados associados.">
        {deleteError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
        <Button
          onClick={() => {
            setDeleteConfirmInput("");
            setShowDeleteModal(true);
          }}
          disabled={deleting}
          variant="danger"
        >
          <Trash2 size={15} /> Eliminar conta
        </Button>
      </SettingsSection>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Eliminar conta</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Esta ação não pode ser desfeita. Para confirmar, escreve{" "}
              <span className="font-mono font-semibold text-slate-900 dark:text-white">@{username}</span> abaixo.
            </p>
            <Input
              className="mt-3"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={`@${username ?? ""}`}
              autoFocus
            />
            {deleteError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={deleting || !username || deleteConfirmInput.trim().replace(/^@/, "") !== username}
              >
                {deleting ? "A eliminar..." : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
