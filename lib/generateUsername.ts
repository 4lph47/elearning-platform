import { prisma } from "@/lib/db";

export function slugifyUsernameBase(seed: string): string {
  const base = seed
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const withLetterStart = /^[a-z]/.test(base) ? base : `u${base}`;
  const padded = withLetterStart.length >= 3 ? withLetterStart : `${withLetterStart}user`.slice(0, 3);
  return padded.slice(0, 20);
}

export async function generateUniqueUsername(seed: string): Promise<string> {
  const base = slugifyUsernameBase(seed || "user");
  let candidate = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) {
    candidate = `${base}${suffix}`.slice(0, 20);
    suffix++;
  }
  return candidate;
}
