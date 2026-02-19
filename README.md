# DinoWallet — Internal Wallet Service

A closed-loop wallet service for a gaming platform, built as a take-home assignment for Dino Ventures. Tracks user balances of application-specific credits (Gold Coins, Diamonds, Loyalty Points) using a **double-entry ledger** architecture with full **concurrency safety** and **idempotency** guarantees.

---

## Table of Contents

- [Quick Start (Docker)](#quick-start-docker)
- [Manual Setup](#manual-setup)
- [Environment Variables](#environment-variables)
- [Tech Stack & Rationale](#tech-stack--rationale)
- [Database Architecture](#database-architecture)
- [Concurrency & Idempotency Strategy](#concurrency--idempotency-strategy)
- [API Reference](#api-reference)
- [Curl Examples](#curl-examples)

---

## Quick Start (Docker)

The fastest way to run everything — PostgreSQL, migrations, seed data, and the API server — in one command:

```bash
docker compose up --build
```

The API will be available at `http://localhost:8000`.

To tear down and reset:

```bash
docker compose down -v
```

---

## Manual Setup

Prerequisites: Node.js 20+, PostgreSQL 15+.

```bash
# Install dependencies
npm install

# Set up your .env (see section below), then:

# Push schema to database
npx prisma db push

# Seed initial data
npm run seed

# Start dev server
npm run dev
```

The server starts on the port defined in `.env` (default `8000`).

---

## Environment Variables

Create a `.env` file in the project root. Reference:

| Variable       | Description                   | Default                                                              |
| -------------- | ----------------------------- | -------------------------------------------------------------------- |
| `PORT`         | Server port                   | `8000`                                                               |
| `ENV`          | `development` or `production` | `development`                                                        |
| `DB_HOST`      | PostgreSQL host               | `postgres`                                                           |
| `DB_PORT`      | PostgreSQL port               | `5432`                                                               |
| `DB_USER`      | PostgreSQL user               | `postgres_user`                                                      |
| `DB_PASSWORD`  | PostgreSQL password           | `pg_password`                                                        |
| `DB_NAME`      | Database name                 | `pg_db`                                                              |
| `DATABASE_URL` | Full connection string        | `postgresql://postgres_user:pg_password@postgres:5432/pg_db?schema=public` |

---

## Tech Stack & Rationale

| Layer            | Choice               | Why                                                                                        |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Runtime          | Node.js + TypeScript | Type safety, large ecosystem, fast iteration                                               |
| Framework        | Fastify              | Lightweight, schema-validated, 2-3x faster than Express under load                         |
| Database         | PostgreSQL           | ACID-compliant, `SELECT ... FOR UPDATE` row locking, battle-tested for financial workloads  |
| ORM              | Prisma 7 + PrismaPg  | Type-safe queries, interactive transactions, clean migration tooling                       |
| Validation       | Zod                  | Runtime schema validation with TypeScript type inference                                   |
| Containerisation | Docker + Compose     | One-command setup, reproducible environments                                               |

---

## Database Architecture

The schema follows a **double-entry ledger** pattern. There is no mutable `balance` column — balances are always derived from the ledger.

### Models

- **AssetType** — Defines credit types (`Gold Coins`, `Diamonds`, `Loyalty Points`).
- **Account** — A wallet scoped to one asset type. `ownerType` distinguishes `USER` wallets from the `SYSTEM` treasury.
- **LedgerEntry** — An immutable record of value movement between two accounts. Every entry has a debit account (source) and credit account (destination).

### Balance Computation

```
Balance(account) = SUM(credits to account) - SUM(debits from account)
```

This is computed on the fly from `ledger_entries`, ensuring the ledger is the single source of truth.

### Seed Data

The seed script creates:

- 3 asset types: Gold Coins (GLD), Diamonds (DMD), Loyalty Points (LPT)
- 3 treasury (SYSTEM) accounts, one per asset type
- 2 users (`user-alice`, `user-bob`) with 3 accounts each
- Initial balances via ledger entries: Alice gets 1000 GLD / 50 DMD / 500 LPT, Bob gets 750 GLD / 30 DMD / 300 LPT

---

## Concurrency & Idempotency Strategy

### Concurrency Control

All write operations (`topUp`, `issueBonus`, `spend`) run inside a Prisma interactive `$transaction`. Before modifying any data, the transaction acquires **row-level locks** on both participating account rows using `SELECT ... FOR UPDATE`. This serialises all concurrent writes that touch the same account, preventing race conditions and double-spends.

### Deadlock Avoidance

When a transaction involves two accounts (e.g. treasury and user), locks are always acquired in **deterministic UUID order** (lower UUID first). This canonical ordering eliminates circular wait conditions that cause deadlocks.

### Idempotency

Every transaction carries a client-supplied `idempotencyKey` (UUID v4). This key has a unique constraint in the database. The system checks for an existing entry with the same key inside the transaction before inserting. If a duplicate is found, the original entry is returned as-is. As a fallback, a `P2002` unique constraint violation from a race between two concurrent identical requests is caught and resolved to the existing entry.

---

## API Reference

All responses follow the shape: `{ success: boolean, message: string, data?: T, error?: string }`.

| Method | Path                            | Description                  | Status Codes       |
| ------ | ------------------------------- | ---------------------------- | ------------------ |
| GET    | `/health`                       | Health check                 | 200                |
| GET    | `/wallets/users`                | List all accounts            | 200                |
| GET    | `/wallets/:userId/balance`      | Get all asset balances       | 200, 404           |
| GET    | `/wallets/:userId/transactions` | Get paginated ledger history | 200, 404           |
| POST   | `/wallets/:userId/topup`        | Top-up credits               | 201, 400, 404      |
| POST   | `/wallets/:userId/bonus`        | Issue bonus credits          | 201, 400, 404      |
| POST   | `/wallets/:userId/spend`        | Spend credits                | 201, 400, 404, 422 |

### Request Bodies (POST)

**Top-up** and **Bonus** share the same shape:

```json
{
  "amount": 100,
  "assetTypeId": "<uuid>",
  "idempotencyKey": "<uuid-v4>",
  "referenceId": "optional-ref",
  "note": "optional note"
}
```

**Spend** accepts the same fields. Returns `422` if balance is insufficient.

### Query Parameters (GET transactions)

| Param    | Type   | Default | Max |
| -------- | ------ | ------- | --- |
| `limit`  | number | 50      | 100 |
| `offset` | number | 0       | --  |

---

## Curl Examples

> The seed script uses fixed asset type UUIDs so these curls work out of the box:
> - **Gold Coins (GLD):** `00000000-0000-4000-a000-000000000001`
> - **Diamonds (DMD):** `00000000-0000-4000-a000-000000000002`
> - **Loyalty Points (LPT):** `00000000-0000-4000-a000-000000000003`

```bash
# ------------------------------------------------
# 1. Health check
# ------------------------------------------------
curl http://localhost:8000/health

# ------------------------------------------------
# 2. List all accounts (discover owner IDs)
# ------------------------------------------------
curl http://localhost:8000/wallets/users

# ------------------------------------------------
# 3. Get Alice's balances across all asset types
# ------------------------------------------------
curl http://localhost:8000/wallets/user-alice/balance

# ------------------------------------------------
# 4. Get Bob's balances
# ------------------------------------------------
curl http://localhost:8000/wallets/user-bob/balance

# ------------------------------------------------
# 5. Top-up Alice's Gold Coins by 200
# ------------------------------------------------
curl -X POST http://localhost:8000/wallets/user-alice/topup \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 200,
    "assetTypeId": "00000000-0000-4000-a000-000000000001",
    "idempotencyKey": "a1b2c3d4-1111-4000-a000-000000000001"
  }'

# ------------------------------------------------
# 6. Issue a bonus of 25 Diamonds to Bob
# ------------------------------------------------
curl -X POST http://localhost:8000/wallets/user-bob/bonus \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25,
    "assetTypeId": "00000000-0000-4000-a000-000000000002",
    "idempotencyKey": "a1b2c3d4-2222-4000-a000-000000000002"
  }'

# ------------------------------------------------
# 7. Alice spends 150 Gold Coins
# ------------------------------------------------
curl -X POST http://localhost:8000/wallets/user-alice/spend \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150,
    "assetTypeId": "00000000-0000-4000-a000-000000000001",
    "idempotencyKey": "a1b2c3d4-3333-4000-a000-000000000003"
  }'

# ------------------------------------------------
# 8. Verify Alice's updated balances
# ------------------------------------------------
curl http://localhost:8000/wallets/user-alice/balance

# ------------------------------------------------
# 9. Get Alice's transaction history (paginated)
# ------------------------------------------------
curl "http://localhost:8000/wallets/user-alice/transactions?limit=10&offset=0"

# ------------------------------------------------
# 10. Idempotency test — reuse the same key twice
#     (the second call returns the original entry, no duplicate created)
# ------------------------------------------------
curl -X POST http://localhost:8000/wallets/user-bob/topup \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "assetTypeId": "00000000-0000-4000-a000-000000000001",
    "idempotencyKey": "a1b2c3d4-4444-4000-a000-000000000004"
  }'

curl -X POST http://localhost:8000/wallets/user-bob/topup \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "assetTypeId": "00000000-0000-4000-a000-000000000001",
    "idempotencyKey": "a1b2c3d4-4444-4000-a000-000000000004"
  }'

# Bob's balance should only increase by 100, not 200.
curl http://localhost:8000/wallets/user-bob/balance

# ------------------------------------------------
# 11. Insufficient balance test — try to overspend
# ------------------------------------------------
curl -X POST http://localhost:8000/wallets/user-bob/spend \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 999999,
    "assetTypeId": "00000000-0000-4000-a000-000000000001",
    "idempotencyKey": "a1b2c3d4-5555-4000-a000-000000000005"
  }'
```

---

## License

MIT
