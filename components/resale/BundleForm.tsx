"use client";

import { useState } from "react";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";

export interface EligibleListing {
  id: string;
  courseTitle: string;
  price: number;
  thumbnailUrl: string | null;
}

// Criação e edição de bundle partilham este formulário — a única diferença
// é o endpoint/método (POST cria, PATCH atualiza), igual em espírito ao
// CourseDetailsForm (mesmo formulário serve os dois casos). Mais simples
// que o de curso de propósito: um bundle não tem módulos/aulas, só nome,
// capa, descrição e que listagens entram.
export function BundleForm({
  mode,
  bundleId,
  initialName = "",
  initialDescription = "",
  initialCoverImageUrl = null,
  initialListingIds = [],
  eligibleListings,
}: {
  mode: "create" | "edit";
  bundleId?: string;
  initialName?: string;
  initialDescription?: string;
  initialCoverImageUrl?: string | null;
  initialListingIds?: string[];
  eligibleListings: EligibleListing[];
}) {
  const { fadeNavigate } = useFadeNav();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialCoverImageUrl);
  const [listingIds, setListingIds] = useState<string[]>(initialListingIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleListing(id: string) {
    setListingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Indica um nome para o bundle");
      return;
    }
    if (listingIds.length === 0) {
      setError("Escolhe pelo menos um curso para o bundle");
      return;
    }
    setSaving(true);
    const body = { name: name.trim(), description: description.trim() || null, coverImageUrl, listingIds };
    const res = await fetch(mode === "create" ? "/api/resale/bundles" : `/api/resale/bundles/${bundleId}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar bundle");
      return;
    }
    const saved = await res.json();
    fadeNavigate(`/resale/bundles/${saved.id ?? bundleId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {mode === "create" ? "Criar bundle" : "Editar bundle"}
      </h1>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <Card className="space-y-4 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Detalhes</h2>
        <div>
          <Label htmlFor="bundle-name">Nome</Label>
          <Input id="bundle-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <Label htmlFor="bundle-description">Descrição</Label>
          <Textarea
            id="bundle-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div>
          <Label>Capa</Label>
          <FileUploadInput kind="IMAGE" currentUrl={coverImageUrl} onUploaded={(result) => setCoverImageUrl(result.url)} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cursos incluídos</h2>
        {eligibleListings.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Não tens listagens de revenda disponíveis para meter neste bundle.
          </p>
        ) : (
          <div className="space-y-1">
            {eligibleListings.map((listing) => (
              <Toggle
                key={listing.id}
                id={`listing-${listing.id}`}
                checked={listingIds.includes(listing.id)}
                onChange={() => toggleListing(listing.id)}
                labelPosition="left"
                label={
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">{listing.courseTitle}</span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{listing.price.toFixed(2)}€</span>
                  </span>
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Button type="button" onClick={save} disabled={saving}>
        {saving ? "A guardar..." : mode === "create" ? "Criar bundle" : "Guardar alterações"}
      </Button>
    </div>
  );
}
