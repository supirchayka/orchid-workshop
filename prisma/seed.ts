import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:pgadmin@localhost:5432/orchid_pwa?schema=public";

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function upsertUser(params: {
  name: string;
  password: string;
  commissionPct: number;
  isAdmin: boolean;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  return prisma.user.upsert({
    where: { name: params.name },
    update: {
      isAdmin: params.isAdmin,
      isActive: true,
      commissionPct: params.commissionPct,
      passwordHash,
    },
    create: {
      name: params.name,
      isAdmin: params.isAdmin,
      isActive: true,
      commissionPct: params.commissionPct,
      passwordHash,
    },
  });
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const masterPassword = process.env.SEED_MASTER_PASSWORD ?? "master12345";
  const withSampleData = process.env.SEED_SAMPLE_DATA === "1";

  await upsertUser({
    name: "admin",
    password: adminPassword,
    commissionPct: 0,
    isAdmin: true,
  });

  if (withSampleData) {
    await Promise.all([
      upsertUser({
        name: "master1",
        password: masterPassword,
        commissionPct: 40,
        isAdmin: false,
      }),
      upsertUser({
        name: "master2",
        password: masterPassword,
        commissionPct: 35,
        isAdmin: false,
      }),
    ]);

    await Promise.all([
      prisma.service.upsert({
        where: { name: "Диагностика" },
        update: { defaultPriceCents: 100_000, isActive: true },
        create: { name: "Диагностика", defaultPriceCents: 100_000, isActive: true },
      }),
      prisma.service.upsert({
        where: { name: "Настройка" },
        update: { defaultPriceCents: 150_000, isActive: true },
        create: { name: "Настройка", defaultPriceCents: 150_000, isActive: true },
      }),
      prisma.service.upsert({
        where: { name: "Пайка" },
        update: { defaultPriceCents: 50_000, isActive: true },
        create: { name: "Пайка", defaultPriceCents: 50_000, isActive: true },
      }),
      prisma.service.upsert({
        where: { name: "Экранирование" },
        update: { defaultPriceCents: 250_000, isActive: true },
        create: { name: "Экранирование", defaultPriceCents: 250_000, isActive: true },
      }),
    ]);
  }

  console.log(`✅ Seed completed. admin upserted${withSampleData ? ", sample users/services upserted" : ""}.`);
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
