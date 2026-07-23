import WebSocket from "ws";
(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;

import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "course-media";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

const FILES: { local: string; objectPath: string; contentType: string }[] = [
  { local: "public/uploads/sample/sample-video.mp4", objectPath: "sample/sample-video.mp4", contentType: "video/mp4" },
  { local: "public/uploads/sample/sample-doc.pdf", objectPath: "sample/sample-doc.pdf", contentType: "application/pdf" },
  { local: "public/uploads/sample/sample-image.jpg", objectPath: "sample/sample-image.jpg", contentType: "image/jpeg" },
];

async function main() {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;

  if (!buckets.some((b) => b.name === bucket)) {
    const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
    if (createErr) throw createErr;
    console.log(`bucket "${bucket}" criado (público)`);
  } else {
    console.log(`bucket "${bucket}" já existe`);
  }

  for (const f of FILES) {
    const buffer = await readFile(path.join(process.cwd(), f.local));
    const { error } = await supabase.storage
      .from(bucket)
      .upload(f.objectPath, buffer, { contentType: f.contentType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(f.objectPath);
    console.log(`${f.local} -> ${data.publicUrl}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
