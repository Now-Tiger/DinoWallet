import {PrismaClient, OwnerType, TransactionType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { v4 as uuidv4 } from "uuid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  const GOLD_ID   = "00000000-0000-4000-a000-000000000001";
  const DMD_ID    = "00000000-0000-4000-a000-000000000002";
  const LPT_ID    = "00000000-0000-4000-a000-000000000003";

  const [goldCoins, diamonds, loyaltyPoints] = await Promise.all([
    prisma.assetType.upsert({
      where: { name: "Gold Coins" },
      update: {},
      create: { id: GOLD_ID, name: "Gold Coins", symbol: "GLD" },
    }),
    prisma.assetType.upsert({
      where: { name: "Diamonds" },
      update: {},
      create: { id: DMD_ID, name: "Diamonds", symbol: "DMD" },
    }),
    prisma.assetType.upsert({
      where: { name: "Loyalty Points" },
      update: {},
      create: { id: LPT_ID, name: "Loyalty Points", symbol: "LPT" },
    }),
  ]);

  console.log("✅ Asset types created");

  const TREASURY_ID = "system-treasury";

  const [treasuryGld, treasuryDmd, treasuryLpt] = await Promise.all([
    prisma.account.upsert({
      where: {
        unique_owner_asset: { ownerId: TREASURY_ID, assetTypeId: goldCoins.id },
      },
      update: {},
      create: {
        id: uuidv4(),
        ownerId: TREASURY_ID,
        ownerType: OwnerType.SYSTEM,
        assetTypeId: goldCoins.id,
      },
    }),
    prisma.account.upsert({
      where: {
        unique_owner_asset: { ownerId: TREASURY_ID, assetTypeId: diamonds.id },
      },
      update: {},
      create: {
        id: uuidv4(),
        ownerId: TREASURY_ID,
        ownerType: OwnerType.SYSTEM,
        assetTypeId: diamonds.id,
      },
    }),
    prisma.account.upsert({
      where: {
        unique_owner_asset: {
          ownerId: TREASURY_ID,
          assetTypeId: loyaltyPoints.id,
        },
      },
      update: {},
      create: {
        id: uuidv4(),
        ownerId: TREASURY_ID,
        ownerType: OwnerType.SYSTEM,
        assetTypeId: loyaltyPoints.id,
      },
    }),
  ]);

  console.log("✅ Treasury accounts created");

  const ALICE_ID = "user-alice";
  const BOB_ID = "user-bob";

  const [aliceGld, aliceDmd, aliceLpt, bobGld, bobDmd, bobLpt] =
    await Promise.all([
      prisma.account.upsert({
        where: {
          unique_owner_asset: { ownerId: ALICE_ID, assetTypeId: goldCoins.id },
        },
        update: {},
        create: {
          id: uuidv4(),
          ownerId: ALICE_ID,
          ownerType: OwnerType.USER,
          assetTypeId: goldCoins.id,
        },
      }),
      prisma.account.upsert({
        where: {
          unique_owner_asset: { ownerId: ALICE_ID, assetTypeId: diamonds.id },
        },
        update: {},
        create: {
          id: uuidv4(),
          ownerId: ALICE_ID,
          ownerType: OwnerType.USER,
          assetTypeId: diamonds.id,
        },
      }),
      prisma.account.upsert({
        where: {
          unique_owner_asset: {
            ownerId: ALICE_ID,
            assetTypeId: loyaltyPoints.id,
          },
        },
        update: {},
        create: {
          id: uuidv4(),
          ownerId: ALICE_ID,
          ownerType: OwnerType.USER,
          assetTypeId: loyaltyPoints.id,
        },
      }),
      prisma.account.upsert({
        where: {
          unique_owner_asset: { ownerId: BOB_ID, assetTypeId: goldCoins.id },
        },
        update: {},
        create: {
          id: uuidv4(),
          ownerId: BOB_ID,
          ownerType: OwnerType.USER,
          assetTypeId: goldCoins.id,
        },
      }),
      prisma.account.upsert({
        where: {
          unique_owner_asset: { ownerId: BOB_ID, assetTypeId: diamonds.id },
        },
        update: {},
        create: {
          id: uuidv4(),
          ownerId: BOB_ID,
          ownerType: OwnerType.USER,
          assetTypeId: diamonds.id,
        },
      }),
      prisma.account.upsert({
        where: {
          unique_owner_asset: {
            ownerId: BOB_ID,
            assetTypeId: loyaltyPoints.id,
          },
        },
        update: {},
        create: {
          id: uuidv4(),
          ownerId: BOB_ID,
          ownerType: OwnerType.USER,
          assetTypeId: loyaltyPoints.id,
        },
      }),
    ]);

  console.log("✅ User accounts created");

  const initialEntries = [
    {
      id: uuidv4(),
      debitAccountId: treasuryGld.id,
      creditAccountId: aliceGld.id,
      amount: 1000,
      type: TransactionType.TOPUP,
      idempotencyKey: "seed-alice-gld-initial",
      note: "Initial balance — Alice Gold Coins",
    },
    {
      id: uuidv4(),
      debitAccountId: treasuryDmd.id,
      creditAccountId: aliceDmd.id,
      amount: 50,
      type: TransactionType.TOPUP,
      idempotencyKey: "seed-alice-dmd-initial",
      note: "Initial balance — Alice Diamonds",
    },
    {
      id: uuidv4(),
      debitAccountId: treasuryLpt.id,
      creditAccountId: aliceLpt.id,
      amount: 500,
      type: TransactionType.TOPUP,
      idempotencyKey: "seed-alice-lpt-initial",
      note: "Initial balance — Alice Loyalty Points",
    },
    {
      id: uuidv4(),
      debitAccountId: treasuryGld.id,
      creditAccountId: bobGld.id,
      amount: 750,
      type: TransactionType.TOPUP,
      idempotencyKey: "seed-bob-gld-initial",
      note: "Initial balance — Bob Gold Coins",
    },
    {
      id: uuidv4(),
      debitAccountId: treasuryDmd.id,
      creditAccountId: bobDmd.id,
      amount: 30,
      type: TransactionType.TOPUP,
      idempotencyKey: "seed-bob-dmd-initial",
      note: "Initial balance — Bob Diamonds",
    },
    {
      id: uuidv4(),
      debitAccountId: treasuryLpt.id,
      creditAccountId: bobLpt.id,
      amount: 300,
      type: TransactionType.TOPUP,
      idempotencyKey: "seed-bob-lpt-initial",
      note: "Initial balance — Bob Loyalty Points",
    },
  ];

  for (const entry of initialEntries) {
    await prisma.ledgerEntry.upsert({
      where: { idempotencyKey: entry.idempotencyKey },
      update: {},
      create: entry,
    });
  }

  console.log("✅ Initial ledger entries created");
  console.log("🎉 Seeding complete");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
