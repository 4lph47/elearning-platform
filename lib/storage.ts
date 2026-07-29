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

// "key" no path do worker (video-renditions/{key}/..., video-captions/{key}/...,
// ver worker/index.js:uploadRenditionDir) — o assetId do upload direto, ou o
// lessonId na fila assíncrona antiga. Extraído do hlsMasterUrl porque é o
// único sítio onde sobrevive depois de guardado (não fica campo à parte na BD).
export function extractVideoAssetKey(hlsMasterUrl: string | null | undefined): string | null {
  if (!hlsMasterUrl) return null;
  const marker = "/video-renditions/";
  const idx = hlsMasterUrl.indexOf(marker);
  if (idx === -1) return null;
  const key = hlsMasterUrl.slice(idx + marker.length).split("/")[0];
  return key || null;
}

// Storage.list() não é recursivo — cada rendition tem os seus próprios
// segmentos .ts + index.m3u8 dentro de video-renditions/{key}/{label}/, por
// isso é preciso descer pasta a pasta. Entradas sem id são pastas (convenção
// do Supabase Storage), o resto são ficheiros.
async function listAllObjectPaths(bucketName: string, prefix: string): Promise<string[]> {
  const { data, error } = await getClient().storage.from(bucketName).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const entry of data) {
    const fullPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      paths.push(...(await listAllObjectPaths(bucketName, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

// Apaga TODOS os ficheiros de um vídeo processado (todas as renditions HLS +
// legendas) — chamado quando uma aula deixa de apontar pra este vídeo (foi
// substituído por outro upload, ou a aula/curso foi eliminado), pra não
// deixar o Storage a acumular vídeos órfãos pra sempre. Nunca lança — falhar
// a limpar não pode impedir a operação (troca de vídeo, eliminação de aula)
// que a chamou.
export async function deleteVideoAssetsByKey(key: string): Promise<void> {
  try {
    const [renditionPaths, captionPaths] = await Promise.all([
      listAllObjectPaths(bucket, `video-renditions/${key}`),
      listAllObjectPaths(bucket, `video-captions/${key}`),
    ]);
    const allPaths = [...renditionPaths, ...captionPaths];
    if (allPaths.length === 0) return;
    const { error } = await getClient().storage.from(bucket).remove(allPaths);
    if (error) throw error;
  } catch (err) {
    console.error(`Falha ao apagar assets de vídeo órfãos (key=${key}):`, err);
  }
}

export interface SignedUpload {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
  bucket: string;
}

// Documentos são grandes demais pro limite de 4.5MB no corpo de um pedido a
// uma serverless function do Vercel — em vez de passar o ficheiro por aqui
// (app/api/upload), isto só gera uma URL assinada e o browser envia
// diretamente para o Storage (ver components/instructor/FileUploadInput.tsx).
export async function createSignedUpload(kind: string, fileName: string): Promise<SignedUpload> {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const path = `${kind.toLowerCase()}s/${crypto.randomUUID()}${ext}`;

  const { data, error } = await getClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw error;

  const signedUrl = data.signedUrl.startsWith("http")
    ? data.signedUrl
    : `${process.env.SUPABASE_URL}${data.signedUrl}`;

  const { data: publicUrlData } = getClient().storage.from(bucket).getPublicUrl(data.path);

  return { signedUrl, token: data.token, path: data.path, publicUrl: publicUrlData.publicUrl, bucket };
}
