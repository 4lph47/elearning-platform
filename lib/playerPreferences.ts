// Preferências do player persistidas entre aulas (não por aula) — "se
// escolher 4K/1.5x uma vez, deve ficar assim daqui pra frente".
const SPEED_KEY = "player:speed";
const AMBIENT_KEY = "player:ambient";
const QUALITY_KEY = "player:quality";

export function getStoredSpeed(): number {
  if (typeof window === "undefined") return 1;
  const v = Number(localStorage.getItem(SPEED_KEY));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function setStoredSpeed(rate: number) {
  if (typeof window !== "undefined") localStorage.setItem(SPEED_KEY, String(rate));
}

export function getStoredAmbient(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AMBIENT_KEY) === "1";
}

export function setStoredAmbient(on: boolean) {
  if (typeof window !== "undefined") localStorage.setItem(AMBIENT_KEY, on ? "1" : "0");
}

// Etiqueta de qualidade (ex.: "1080p", "2160p") — se a aula atual não tiver
// essa rendition disponível, quem usa isto decide o fallback (ver
// QualityMenu no LessonPlayer).
export function getStoredQuality(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(QUALITY_KEY);
}

export function setStoredQuality(quality: string) {
  if (typeof window !== "undefined") localStorage.setItem(QUALITY_KEY, quality);
}
