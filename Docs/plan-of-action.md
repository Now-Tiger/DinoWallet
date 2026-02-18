## 1. Tech Stack Decision

**Backend:** Node.js (TypeScript) with **Fastify** — lightweight, schema-validated, and performant. **Database:** PostgreSQL with **Prisma ORM** — ACID-compliant, excellent for ledger patterns, and pairs well with migrations. **Containerization:** Docker + Docker Compose for local dev and cloud portability. **Hosting:** Railway or Render (zero-friction PostgreSQL + Node deploys, free tier, public URL out of the box). This stack gives a clean REST API surface today and can plug into any frontend framework (Next.js, React, etc.) trivially via the same hosted base URL.

---

## 2. Plan of Action

```markdown
# Wallet Service — Plan of Action

## Phase 1: Project Scaffolding

- [ ] Init Node.js + TypeScript project (`tsconfig`, `package.json`)
- [ ] Install deps: `fastify`, `@prisma/client`, `prisma`, `zod`, `uuid`, `dotenv`
- [ ] Set up folder structure:
      src/
      routes/
      services/
      middleware/
      plugins/
      prisma/
      schema.prisma
      seed.ts (or seed.sql)
      docker/

## Phase 2: Database Schema Design (Prisma)

Define the following models:

- **AssetType** — id, name (e.g. "Gold Coins"), symbol, createdAt
- **Account** — id, ownerId (nullable for system), ownerType (USER | SYSTEM),
  assetTypeId, createdAt
- **LedgerEntry** — id, debitAccountId, creditAccountId, amount, type
  (TOPUP | BONUS | SPEND), idempotencyKey (unique),
  referenceId, note, createdAt
- **AccountBalance** — materialised view OR computed via SUM on LedgerEntry
  (go pure ledger — no mutable balance column)

> Double-entry rule: every transaction has exactly one DEBIT and one CREDIT account.
> Balance = SUM(credits) - SUM(debits) for an account.

## Phase 3: Seed Script

Create `prisma/seed.ts` (and export `seed.sql`):

- Insert AssetTypes: Gold Coins, Diamonds, Loyalty Points
- Insert System Accounts: Treasury (one per asset type)
- Insert Users: user_alice, user_bob with initial balances
  (via ledger entries: Treasury DEBIT → User CREDIT)

## Phase 4: Core Service Logic

Implement `WalletService` with the following methods,
each wrapped in a Prisma `$transaction`:

1. **topUp(userId, assetTypeId, amount, idempotencyKey)**
   - Treasury → User (CREDIT flow)
   - Check idempotencyKey uniqueness before insert

2. **issueBonus(userId, assetTypeId, amount, idempotencyKey)**
   - Treasury → User (BONUS flow)
   - Same idempotency guard

3. **spend(userId, assetTypeId, amount, idempotencyKey)**
   - Compute live balance inside transaction (SELECT ... FOR UPDATE on ledger)
   - Reject if balance < amount (never go negative)
   - User → Treasury (DEBIT flow)

**Concurrency Strategy:**

- Use `SELECT SUM(...) FOR UPDATE` on ledger rows scoped to an account
  inside the Prisma `$transaction` — this row-locks the account's ledger
  preventing phantom reads and double-spends under concurrent requests
- Idempotency key (UUID v4, unique constraint on LedgerEntry) ensures
  retried requests are no-ops, not double-credits

**Deadlock Avoidance:**

- Always acquire account locks in a consistent canonical order
  (lower account UUID first) to prevent circular waits

## Phase 5: API Routes (Fastify)

| Method | Path                          | Description            |
| ------ | ----------------------------- | ---------------------- |
| GET    | /health                       | Health check           |
| GET    | /wallets/:userId/balance      | Get all asset balances |
| GET    | /wallets/:userId/transactions | Get ledger history     |
| POST   | /wallets/:userId/topup        | Top-up credits         |
| POST   | /wallets/:userId/bonus        | Issue bonus credits    |
| POST   | /wallets/:userId/spend        | Spend credits          |

- Validate all request bodies with `zod` schemas
- Return consistent JSON: `{ success, data, error }`

## Phase 6: Docker Setup

- `Dockerfile` — multi-stage build (builder → runner)
- `docker-compose.yml`:
  - `db` service: postgres:16-alpine, volume mount, env vars
  - `app` service: depends_on db, runs migrations + seed + server
  - `migrate` entrypoint: `prisma migrate deploy && prisma db seed`

## Phase 7: README

Cover:

- Prerequisites & quick start (`docker compose up`)
- Manual setup (local Node + Postgres)
- Env vars reference (`.env.example`)
- Tech choices rationale
- Concurrency & idempotency strategy explanation
- API reference with example curl commands
- Live hosted URL

## Phase 8: Hosting (Brownie Points)

- Push to GitHub
- Deploy to Railway:
  - Provision PostgreSQL plugin
  - Set env vars
  - Deploy app service (auto-detects Dockerfile)
  - Run `prisma migrate deploy` as release command
- Confirm live URL returns /health → 200
```
