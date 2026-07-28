import { prisma } from "../lib/db";
import { slugifyUsernameBase } from "../lib/generateUsername";

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
    const base = slugifyUsernameBase(user.name || "user");
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
