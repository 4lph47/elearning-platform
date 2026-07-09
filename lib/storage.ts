import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export interface SavedFile {
  url: string;
  sizeBytes: number;
}

export interface Storage {
  save(file: File, folder: string): Promise<SavedFile>;
  delete(url: string): Promise<void>;
}

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Storage local em disco, pensado apenas para desenvolvimento.
 * Antes de fazer deploy na Vercel (filesystem efémero, sem persistência),
 * substituir por uma implementação equivalente que grave em storage cloud
 * (ex: S3Storage / R2Storage) mantendo a mesma interface `Storage`.
 */
class LocalDiskStorage implements Storage {
  async save(file: File, folder: string): Promise<SavedFile> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
    const dir = path.join(UPLOADS_ROOT, safeFolder);
    await mkdir(dir, { recursive: true });

    const ext = path.extname(file.name);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(dir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    return {
      url: `/uploads/${safeFolder}/${filename}`,
      sizeBytes: buffer.byteLength,
    };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    const filePath = path.join(process.cwd(), "public", url);
    await unlink(filePath).catch(() => undefined);
  }
}

export const storage: Storage = new LocalDiskStorage();
