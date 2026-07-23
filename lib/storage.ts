import { createClient } from "@supabase/supabase-js";

export interface SavedFile {
  url: string;
  sizeBytes: number;
}

export interface Storage {
  save(file: File, folder: string): Promise<SavedFile>;
  delete(url: string): Promise<void>;
}

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "course-media";

let client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY não configuradas");
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}

class SupabaseStorage implements Storage {
  async save(file: File, folder: string): Promise<SavedFile> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const objectPath = `${safeFolder}/${crypto.randomUUID()}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await getClient()
      .storage.from(bucket)
      .upload(objectPath, buffer, { contentType: file.type || undefined, upsert: false });
    if (error) throw error;

    const { data } = getClient().storage.from(bucket).getPublicUrl(objectPath);
    return { url: data.publicUrl, sizeBytes: buffer.byteLength };
  }

  async delete(url: string): Promise<void> {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const objectPath = url.slice(idx + marker.length);
    await getClient().storage.from(bucket).remove([objectPath]);
  }
}

export const storage: Storage = new SupabaseStorage();
