# Orchid Workshop PWA — Техническое задание (MVP)

Дата: 2026-02-07  
Язык интерфейса: **русский**  
Стиль UI: **iPhone dark vibe** (тёмная тема по умолчанию)

## 1. Цель
Сделать PWA-приложение для учёта заказов гитарной мастерской:
- создание и ведение заказов на ремонт/работы
- учёт запчастей, оплачиваемых клиентом
- учёт расходов мастерской (общих и по заказам)
- расчёт комиссий мастерам
- аудит действий
- финансовая аналитика для администратора (графики по периодам)

## 2. Технологический стек
- Next.js (App Router) + TypeScript
- Prisma ORM v7 (prisma.config.ts), PostgreSQL
- JWT авторизация (httpOnly cookie)
- PWA: manifest + service worker (минимум для установки)

## 3. Термины и сущности

### 3.1 Пользователь (User)
- `name` (уникальный, имя без фамилии) — используется как логин и отображаемое имя
- `passwordHash`
- `isAdmin` (boolean)
- `commissionPct` (int, 0..100) — комиссия мастера в процентах
- `isActive` (boolean)

Пользователь может быть админом и одновременно исполнителем работ (мастером).

### 3.2 Заказ (Order)
Поля:
- `title`, `guitarSerial?`, `description?`
- `status`: `NEW`, `IN_PROGRESS`, `WAITING_PARTS`, `READY_FOR_PICKUP`, `PAID`
- `paidAt?` — устанавливается при переходе в PAID, обнуляется при уходе из PAID
- Денормализованные суммы:
  - `laborSubtotalCents` — сумма работ (без запчастей)
  - `partsSubtotalCents` — сумма запчастей
  - `invoiceTotalCents` — сумма к оплате клиентом = labor + parts
  - `orderExpensesCents` — сумма расходов, привязанных к заказу (внутренние)
- Связи: works, parts, expenses, comments, auditLogs

### 3.3 Строка работ (OrderWork)
Каждая работа в заказе может быть выполнена отдельным мастером.
Храним snapshot, чтобы изменение каталога услуг и комиссии пользователя не ломало историю:
- `serviceId?` (nullable) — если работа кастомная, то null
- `serviceName` — snapshot названия
- `unitPriceCents`, `quantity`
- `performerId` — исполнитель
- `commissionPctSnapshot` — snapshot процента комиссии исполнителя
- `commissionCentsSnapshot` — snapshot комиссии (floor(lineTotal * pct / 100))

### 3.4 Каталог услуг (Service)
- `name`, `defaultPriceCents`, `isActive`

### 3.5 Запчасти клиента (OrderPart)
Запчасти оплачивает клиент. Они входят в invoiceTotal, но **не участвуют** в доходе/комиссиях мастерской.
- `name`, `unitPriceCents`, `quantity`
- `costCents?` (опционально на будущее)

### 3.6 Расходы (Expense)
- Общие расходы: `orderId = null` (доступны админам)
- Расходы по заказу: `orderId = <id>` (доступны staff, с правами создатель/админ)
- `title`, `amountCents`, `expenseDate`
- `createdById`

### 3.7 Комментарии (OrderComment)
- Мастера оставляют комментарии к заказу
- Сортировка: **новые сверху** (`createdAt desc`)
- При статусе PAID комментарии **запрещены**

### 3.8 Аудит (AuditLog)
Логируем каждое действие:
- actorId (кто сделал)
- action: CREATE/UPDATE/DELETE/STATUS_CHANGE/LOGIN/LOGOUT
- entity: ORDER/ORDER_WORK/ORDER_PART/EXPENSE/COMMENT/USER/SERVICE/AUTH
- entityId, orderId?
- diff (Json) — before/after или patch
- createdAt

## 4. Бизнес-правила

### 4.1 Правило PAID-lock (критично)
Если заказ имеет `status = PAID`:
- **любые изменения** (заказ/работы/запчасти/расходы/комментарии) запрещены **всем**, включая админа
- менять статус заказа, если текущий статус PAID, может **только админ**
- пометить заказ как PAID (перевести в PAID) может **только админ**
- для исправления данных: админ переводит заказ из PAID в другой статус (paidAt -> null), вносит правки, затем снова PAID

### 4.2 Суммы заказа
- `laborSubtotalCents = Σ(works.unitPriceCents * works.quantity)`
- `partsSubtotalCents = Σ(parts.unitPriceCents * parts.quantity)`
- `invoiceTotalCents = laborSubtotalCents + partsSubtotalCents`
- `orderExpensesCents = Σ(expenses.amountCents WHERE orderId = Order.id)`

### 4.3 Комиссия
Комиссия считается только от работ:
- lineTotal = unitPriceCents * quantity
- lineCommission = floor(lineTotal * commissionPctSnapshot / 100)
- commissionCentsSnapshot хранится в OrderWork для быстрой аналитики и “заморозки истории”

### 4.4 Финансовая аналитика (админ)
За период [from..to] (по paidAt для заказов и expenseDate для расходов):
- laborRevenuePaid = Σ(order.laborSubtotalCents) по заказам со статусом PAID и paidAt в периоде
- commissionsPaid = Σ(orderWork.commissionCentsSnapshot) по строкам работ этих заказов
- expenses = Σ(expense.amountCents) по всем расходам (общие + по заказам), expenseDate в периоде
- netProfit = laborRevenuePaid - commissionsPaid - expenses

Запчасти в прибыль не включаются.

## 5. Авторизация и доступы

### 5.1 JWT
- вход: /api/auth/login → JWT в httpOnly cookie
- выход: /api/auth/logout → очистка cookie
- защищённые страницы/эндпоинты требуют валидного JWT

### 5.2 Роли
- Admin:
  - CRUD users/services/general expenses
  - analytics
  - смена статуса на/с PAID
- Staff (любой залогиненный не-админ):
  - создание и ведение заказов, работы, запчасти, расходы по заказу, комментарии — **только если заказ не PAID**
  - просмотр своей комиссии

## 6. UI/UX (MVP)
- Тёмная тема по умолчанию (html.dark)
- Русский язык в интерфейсе/ошибках
- Основные экраны:
  - Login
  - Orders list
  - Order detail: tabs (Works, Parts, Expenses, Comments, Audit)
  - My commission
  - Admin: Analytics, Users, Services, General expenses

## 7. Требования к коду (обязательные)
- Вся бизнес-логика мутаций на сервере:
  - guards: requireSession/requireAdmin
  - locks: assertOrderMutable, assertStatusChangeAllowed
  - totals: recalcOrderTotalsTx (транзакционно)
  - commission: calcCommissionCents + snapshot update
- Все операции мутаций пишут AuditLog.
- Все ошибки API возвращаются в JSON:
  - `{ ok: false, message: "..." }` и HTTP статус (401/403/409/400/500).