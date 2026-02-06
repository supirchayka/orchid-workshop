# Orchid Workshop PWA (учёт заказов)

Стек:
- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- JWT (httpOnly cookie)
- PWA (manifest + service worker)

## Язык интерфейса
Все тексты UI и сообщения — на русском.

## Запуск (локально)
1) DB:
   docker compose up -d

2) ENV:
   DATABASE_URL=...
   JWT_SECRET=...
   SEED_ADMIN_PASSWORD=...

3) Prisma:
   npx prisma migrate dev --name init
   npx prisma db seed

4) Dev:
   npm run dev

Открой: http://localhost:3000

Логин по умолчанию:
- имя: admin
- пароль: берётся из SEED_ADMIN_PASSWORD

## Модули (что где лежит)
- src/app/api/auth/* — login/logout (JWT cookie)
- src/proxy.ts — защита роутов и редиректы (Next.js Proxy)
- src/lib/auth/* — JWT/сессия/пароли
- src/lib/prisma.ts — PrismaClient singleton
- prisma/* — schema, migrations, seed
- src/app/manifest.ts + public/sw.js — PWA

## Важно про доступы и PAID-лок (будет в бизнес-логике)
Когда заказ в статусе PAID:
- любые изменения заказа/работ/запчастей/расходов/комментариев запрещены всем (включая админа)
- статус PAID может менять только админ (чтобы разлочить и исправить)
