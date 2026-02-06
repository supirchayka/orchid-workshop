import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = "Алехандро Пахуэло";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { name },
    update: {
      isAdmin: true,
      isActive: true,
      passwordHash,
      commissionPct: 0,
    },
    create: {
      name,
      isAdmin: true,
      isActive: true,
      passwordHash,
      commissionPct: 0,
    },
  });

  console.log("✅ Seed: admin создан/обновлён (логин: admin)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
