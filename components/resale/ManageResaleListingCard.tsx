"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Trash2 } from "lucide-react";

// CRUD completo da própria listagem, direto na página do curso — antes só
// dava para editar o preço de dentro da lista em app/dashboard(ou
// instructor)/resale, longe do contexto real. Só quem é o vendedor desta
// listagem específica vê isto (ver isResaleOwner em app/courses/[slug]/page.tsx).
export function ManageResaleListingCard({
  listingId,
  initialPrice,
  initialActive,
  minCommission,
}: {
  listingId: string;
  initialPrice: number;
  initialActive: boolean;
  minCommission: number | null;
}) {
  const router = useRouter();
  const { fadeNavigate } = useFadeNav();
  const { data: session } = useSession();
  const [price, setPrice] = useState(String(initialPrice));
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function savePrice() {
    setError(null);
    const value = Number(price);
    if (!value || value <= 0) {
      setError("Indica um preço válido");
      return;
    }
    if (minCommission !== null && value < minCommission) {
      setError(`O preço tem de ser pelo menos ${minCommission.toFixed(2)}€`);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/resale/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: value }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }
    router.refresh();
  }

  async function toggleActive() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/resale/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }
    setActive((v) => !v);
    router.refresh();
  }

  async function deleteListing() {
    setError(null);
    setDeleting(true);
    const res = await fetch(`/api/resale/listings/${listingId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao remover");
      return;
    }
    fadeNavigate(session?.user.role === "STUDENT" ? "/dashboard/resale" : "/instructor/resale");
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-blue-500/30 bg-blue-600/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        A tua listagem de revenda
      </p>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={minCommission ?? 0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 py-1.5 text-sm"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400">€</span>
        <Button type="button" variant="outline" disabled={saving} onClick={savePrice} className="px-2.5 py-1.5 text-xs">
          Guardar
        </Button>
      </div>
      {minCommission !== null && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Comissão do instrutor (fixa):{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">{minCommission.toFixed(2)}€</span>
          </span>
          <span>
            A tua parte:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {Number(price) >= minCommission ? `${(Number(price) - minCommission).toFixed(2)}€` : "—"}
            </span>
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={toggleActive}
          className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {active ? "desativar" : "reativar"}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={deleteListing}
          className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
        >
          <Trash2 size={12} /> remover
        </button>
      </div>
    </div>
  );
}
