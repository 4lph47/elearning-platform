"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Download, Trash2 } from "lucide-react";

export default function AccountPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Falha ao exportar dados");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "e-learn-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível exportar os dados. Tenta novamente.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar a tua conta e todos os teus dados? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Não foi possível eliminar a conta.");
    setDeleting(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">A minha conta</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Gere os teus dados pessoais. Ver{" "}
        <Link href="/privacidade" className="text-blue-500 hover:underline">
          política de privacidade
        </Link>
        .
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
          <h2 className="font-medium text-slate-900 dark:text-white">Exportar os meus dados</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Descarrega uma cópia de tudo o que a tua conta gerou (perfil, inscrições, progresso, comentários, avaliações).
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-3 flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Download size={15} /> {exporting ? "A exportar..." : "Exportar dados"}
          </button>
        </div>

        <div className="rounded-lg border border-red-200 p-4 dark:border-red-500/20">
          <h2 className="font-medium text-red-600 dark:text-red-400">Eliminar conta</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Remove permanentemente a tua conta e todos os dados associados. Instrutores com cursos publicados devem
            contactar o suporte primeiro.
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-3 flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            <Trash2 size={15} /> {deleting ? "A eliminar..." : "Eliminar conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
