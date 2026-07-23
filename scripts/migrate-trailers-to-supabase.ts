import WebSocket from "ws";
(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { readFile, readdir } from "fs/promises";
import path from "path";

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "course-media";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const prisma = new PrismaClient();

async function main() {
  const dir = path.join(process.cwd(), "public", "uploads", "trailers");
  const files = await readdir(dir);

  for (const filename of files) {
    const localPath = `/uploads/trailers/${filename}`;
    const objectPath = `trailers/${filename}`;
    const buffer = await readFile(path.join(dir, filename));

    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, { contentType: "video/mp4", upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const { count } = await prisma.lesson.updateMany({
      where: { contentUrl: localPath },
      data: { contentUrl: data.publicUrl },
    });
    console.log(`${localPath} -> ${data.publicUrl} (${count} lessons atualizadas)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
