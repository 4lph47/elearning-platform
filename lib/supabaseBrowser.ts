"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Chave pública (anon) — protegida por RLS do lado do Supabase, feita para
// ser exposta ao browser. Só usada para o upload direto (uploadToSignedUrl);
// o token assinado é que autoriza a operação em si.
let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas");
    }
    client = createClient(url, anonKey, { auth: { persistSession: false } });
  }
  return client;
}
