// Rascunho local (localStorage) das edições de curso/aula — se a pessoa sair
// da tela sem guardar (mesmo confirmando o aviso do useUnsavedChangesGuard,
// ou fechando o separador), o que escreveu não se perde: ao voltar à MESMA
// edição, é oferecido para retomar de onde ficou.
export interface StoredDraft<T> {
  value: T;
  savedAt: number;
}

export function saveDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // localStorage cheio/desabilitado — rascunho é conveniência, não crítico
  }
}

export function loadDraft<T>(key: string): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft<T>;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

// Campos de URL vindos de upload de ficheiro (trailer, thumbnail, vídeo,
// legendas) só devem conter o que o upload devolveu, nunca texto à mão —
// um rascunho antigo (doutra versão do código, ou duma tentativa de upload
// que falhou a meio) podia ter deixado lá algo que não bate com esse
// formato, e isso só apareceria mais tarde como "Ficheiro inválido" ao
// guardar. Sanear ao restaurar o rascunho evita esse erro tardio e confuso.
export function sanitizeUploadedUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}
