-- seed.sql
-- Raw SQL equivalent of src/seed.ts for direct DB seeding.
-- Run with: psql $DATABASE_URL -f prisma/seed.sql

BEGIN;

-- Asset types (deterministic IDs for reproducibility)
INSERT INTO asset_types (id, code, name, symbol, created_at)
VALUES
  ('00000000-0000-4000-a000-000000000001', 'GOLD_COINS',      'Gold Coins',      'GLD', NOW()),
  ('00000000-0000-4000-a000-000000000002', 'DIAMONDS',         'Diamonds',        'DMD', NOW()),
  ('00000000-0000-4000-a000-000000000003', 'LOYALTY_POINTS',   'Loyalty Points',  'LPT', NOW())
ON CONFLICT (name) DO NOTHING;

-- Treasury (SYSTEM) accounts — one per asset type
INSERT INTO accounts (id, owner_id, owner_type, asset_type_id, created_at)
VALUES
  ('10000000-0000-4000-a000-000000000001', 'system-treasury', 'SYSTEM', '00000000-0000-4000-a000-000000000001', NOW()),
  ('10000000-0000-4000-a000-000000000002', 'system-treasury', 'SYSTEM', '00000000-0000-4000-a000-000000000002', NOW()),
  ('10000000-0000-4000-a000-000000000003', 'system-treasury', 'SYSTEM', '00000000-0000-4000-a000-000000000003', NOW())
ON CONFLICT (owner_id, asset_type_id) DO NOTHING;

-- Alice's accounts
INSERT INTO accounts (id, owner_id, owner_type, asset_type_id, created_at)
VALUES
  ('20000000-0000-4000-a000-000000000001', 'user-alice', 'USER', '00000000-0000-4000-a000-000000000001', NOW()),
  ('20000000-0000-4000-a000-000000000002', 'user-alice', 'USER', '00000000-0000-4000-a000-000000000002', NOW()),
  ('20000000-0000-4000-a000-000000000003', 'user-alice', 'USER', '00000000-0000-4000-a000-000000000003', NOW())
ON CONFLICT (owner_id, asset_type_id) DO NOTHING;

-- Bob's accounts
INSERT INTO accounts (id, owner_id, owner_type, asset_type_id, created_at)
VALUES
  ('30000000-0000-4000-a000-000000000001', 'user-bob', 'USER', '00000000-0000-4000-a000-000000000001', NOW()),
  ('30000000-0000-4000-a000-000000000002', 'user-bob', 'USER', '00000000-0000-4000-a000-000000000002', NOW()),
  ('30000000-0000-4000-a000-000000000003', 'user-bob', 'USER', '00000000-0000-4000-a000-000000000003', NOW())
ON CONFLICT (owner_id, asset_type_id) DO NOTHING;

-- Initial ledger entries (top-ups from treasury to users)
INSERT INTO ledger_entries (id, debit_account_id, credit_account_id, amount, type, idempotency_key, note, created_at)
VALUES
  (gen_random_uuid(), '10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 1000, 'TOPUP', 'seed-alice-gld-initial', 'Initial balance — Alice Gold Coins',      NOW()),
  (gen_random_uuid(), '10000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000002',   50, 'TOPUP', 'seed-alice-dmd-initial', 'Initial balance — Alice Diamonds',        NOW()),
  (gen_random_uuid(), '10000000-0000-4000-a000-000000000003', '20000000-0000-4000-a000-000000000003',  500, 'TOPUP', 'seed-alice-lpt-initial', 'Initial balance — Alice Loyalty Points',  NOW()),
  (gen_random_uuid(), '10000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001',  750, 'TOPUP', 'seed-bob-gld-initial',   'Initial balance — Bob Gold Coins',        NOW()),
  (gen_random_uuid(), '10000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000002',   30, 'TOPUP', 'seed-bob-dmd-initial',   'Initial balance — Bob Diamonds',          NOW()),
  (gen_random_uuid(), '10000000-0000-4000-a000-000000000003', '30000000-0000-4000-a000-000000000003',  300, 'TOPUP', 'seed-bob-lpt-initial',   'Initial balance — Bob Loyalty Points',    NOW())
ON CONFLICT (idempotency_key) DO NOTHING;

COMMIT;
