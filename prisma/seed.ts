import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const connectionString = "postgresql://postgres:pgadmin@localhost:5432/orchid_pwa?schema=public";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

  console.log("✅ Seed completed: admin user created/updated.");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
