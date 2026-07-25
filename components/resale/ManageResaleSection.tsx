"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";

export interface EligibleCourse {
  id: string;
  title: string;
  minCommission: number;
}

export interface OwnListing {
  id: string;
  price: number;
  active: boolean;
  courseId: string;
  courseTitle: string;
  bundleId: string | null;
}

export interface OwnBundle {
  id: string;
  name: string;
  listingIds: string[];
}

// Só o dono do perfil vê isto (isOwner) — cria/gere as suas próprias
// listagens e bundles de revenda através da API construída em
// app/api/resale/listings e app/api/resale/bundles. Sem isto o utilizador
// nunca teria como sequer criar uma listagem, só de a ver depois de criada.
export function ManageResaleSection({
  eligibleCourses,
  listings,
  bundles,
}: {
  eligibleCourses: EligibleCourse[];
  listings: OwnListing[];
  bundles: OwnBundle[];
}) {
  const router = useRouter();
  const [priceByCourse, setPriceByCourse] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundleListingIds, setBundleListingIds] = useState<string[]>([]);

  if (eligibleCourses.length === 0 && listings.length === 0 && bundles.length === 0) return null;

  async function handleError(res: Response) {
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Erro ao processar pedido");
  }

  async function createListing(courseId: string) {
    setError(null);
    const price = Number(priceByCourse[courseId]);
    if (!price || price <= 0) {
      setError("Indica um preço válido");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/resale/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, price }),
    });
    setBusy(false);
    if (!res.ok) return handleError(res);
    router.refresh();
  }

  async function toggleActive(listing: OwnListing) {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/resale/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !listing.active }),
    });
    setBusy(false);
    if (!res.ok) return handleError(res);
    router.refresh();
  }

  async function deleteListing(listingId: string) {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/resale/listings/${listingId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return handleError(res);
    router.refresh();
  }

  async function createBundle() {
    setError(null);
    if (bundleName.trim().length < 2) {
      setError("Indica um nome para o bundle");
      return;
    }
    if (bundleListingIds.length === 0) {
      setError("Escolhe pelo menos uma listagem para o bundle");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/resale/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bundleName.trim(), listingIds: bundleListingIds }),
    });
    setBusy(false);
    if (!res.ok) return handleError(res);
    setBundleName("");
    setBundleListingIds([]);
    router.refresh();
  }

  async function deleteBundle(bundleId: string) {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/resale/bundles/${bundleId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return handleError(res);
    router.refresh();
  }

  function toggleBundleListing(id: string) {
    setBundleListingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const unbundledActiveListings = listings.filter((l) => l.active && !l.bundleId);

  return (
    <CollapsibleCard title="Gerir revendas">
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {eligibleCourses.length > 0 && (
        <div>
          <Label>Cursos que podes vender</Label>
          <div className="space-y-2">
            {eligibleCourses.map((course) => (
              <div key={course.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-white/10">
                <span className="min-w-0 flex-1 truncate text-sm">{course.title}</span>
                <span className="text-xs text-slate-500">mín. {course.minCommission.toFixed(2)}€</span>
                <Input
                  type="number"
                  min={course.minCommission}
                  step="0.01"
                  placeholder="Preço"
                  value={priceByCourse[course.id] ?? ""}
                  onChange={(e) => setPriceByCourse((prev) => ({ ...prev, [course.id]: e.target.value }))}
                  className="w-24"
                />
                <Button type="button" variant="outline" disabled={busy} onClick={() => createListing(course.id)}>
                  Colocar à venda
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {listings.length > 0 && (
        <div>
          <Label>As tuas listagens</Label>
          <div className="space-y-1.5">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10"
              >
                <span className="min-w-0 flex-1 truncate">
                  {listing.courseTitle} · {listing.price.toFixed(2)}€ {!listing.active && "(desativada)"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggleActive(listing)}
                  className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {listing.active ? "desativar" : "reativar"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => deleteListing(listing.id)}
                  className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(unbundledActiveListings.length > 0 || bundles.length > 0) && (
        <div>
          <Label>Bundles</Label>
          {bundles.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {bundle.name} · {bundle.listingIds.length} cursos
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => deleteBundle(bundle.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          )}
          {unbundledActiveListings.length > 0 && (
            <div className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-white/10">
              <Input placeholder="Nome do bundle" value={bundleName} onChange={(e) => setBundleName(e.target.value)} />
              <div className="space-y-1">
                {unbundledActiveListings.map((listing) => (
                  <label key={listing.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={bundleListingIds.includes(listing.id)}
                      onChange={() => toggleBundleListing(listing.id)}
                    />
                    {listing.courseTitle} ({listing.price.toFixed(2)}€)
                  </label>
                ))}
              </div>
              <Button type="button" variant="outline" disabled={busy} onClick={createBundle}>
                Criar bundle
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleCard>
  );
}
