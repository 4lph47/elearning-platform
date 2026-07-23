import WebSocket from "ws";
(globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;

import { createClient } from "@supabase/supabase-js";

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "course-media";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data: before, error: getErr } = await supabase.storage.getBucket(bucket);
  if (getErr) throw getErr;
  console.log("Limite atual:", before.file_size_limit);

  const { error } = await supabase.storage.updateBucket(bucket, {
    public: true,
    fileSizeLimit: "5GB",
  });
  if (error) throw error;

  const { data: after, error: getErr2 } = await supabase.storage.getBucket(bucket);
  if (getErr2) throw getErr2;
  console.log("Limite novo:", after.file_size_limit);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
