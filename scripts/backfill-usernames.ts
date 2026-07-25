import { prisma } from "../lib/db";

// Preenche username em quem já existe na BD sem um (contas antigas de antes
// do campo existir) — mesma regra de formato de lib/validations.ts
// (usernameSchema): minúsculas, letras/números/_, começa por letra, 3-20
// chars. Não mexe em usernameChangedAt (fica null, tal como uma escolha
// feita no registo — a pessoa pode trocar quando quiser, sem cooldown, até
// à primeira troca de facto).
function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(" ")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  const withLetterStart = /^[a-z]/.test(base) ? base : `u${base}`;
  const padded = withLetterStart.length >= 3 ? withLetterStart : `${withLetterStart}user`.slice(0, 3);
  return padded.slice(0, 20);
}

async function main() {
  const users = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, name: true },
  });

  const existing = new Set(
    (await prisma.user.findMany({ where: { username: { not: null } }, select: { username: true } })).map(
      (u) => u.username!
    )
  );

  for (const user of users) {
    const base = slugify(user.name || "user");
    let candidate = base;
    let suffix = 2;
    while (existing.has(candidate)) {
      candidate = `${base}${suffix}`.slice(0, 20);
      suffix++;
    }
    existing.add(candidate);
    await prisma.user.update({ where: { id: user.id }, data: { username: candidate } });
    console.log(`${user.name} -> @${candidate}`);
  }

  console.log(`${users.length} username(s) preenchido(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
