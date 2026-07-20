"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, Input } from "@/components/ui/Input";

export function ProfileForm({
  initialBio,
  initialWebsiteUrl,
  initialTwitterUrl,
  initialLinkedinUrl,
  initialYoutubeUrl,
}: {
  initialBio: string;
  initialWebsiteUrl?: string;
  initialTwitterUrl?: string;
  initialLinkedinUrl?: string;
  initialYoutubeUrl?: string;
}) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [twitterUrl, setTwitterUrl] = useState(initialTwitterUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedinUrl ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/instructor/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio, websiteUrl, twitterUrl, linkedinUrl, youtubeUrl }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <Label htmlFor="bio">Bio pública</Label>
        <Textarea
          id="bio"
          rows={4}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conta um pouco sobre a tua experiência e o que ensinas..."
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{bio.length}/600</p>
      </div>

      <div>
        <Label htmlFor="websiteUrl">Website</Label>
        <Input
          id="websiteUrl"
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://o-teu-site.com"
        />
      </div>
      <div>
        <Label htmlFor="twitterUrl">Twitter / X</Label>
        <Input
          id="twitterUrl"
          type="url"
          value={twitterUrl}
          onChange={(e) => setTwitterUrl(e.target.value)}
          placeholder="https://x.com/utilizador"
        />
      </div>
      <div>
        <Label htmlFor="linkedinUrl">LinkedIn</Label>
        <Input
          id="linkedinUrl"
          type="url"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/in/utilizador"
        />
      </div>
      <div>
        <Label htmlFor="youtubeUrl">YouTube</Label>
        <Input
          id="youtubeUrl"
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://youtube.com/@canal"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "A guardar..." : "Guardar"}
        </Button>
        {saved && <span className="text-sm text-slate-500 dark:text-slate-400">Guardado.</span>}
      </div>
    </form>
  );
}
