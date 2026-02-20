import { z } from "zod";

const positiveAmount = z.number().positive("Amount must be greater than zero");
const uuidString = z.uuid("Must be a valid UUID");

export const topUpSchema = z.object({
  amount: positiveAmount,
  assetTypeId: uuidString,
  idempotencyKey: uuidString,
  referenceId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const bonusSchema = z.object({
  amount: positiveAmount,
  assetTypeId: uuidString,
  idempotencyKey: uuidString,
  note: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const spendSchema = z.object({
  amount: positiveAmount,
  assetTypeId: uuidString,
  idempotencyKey: uuidString,
  referenceId: z.string().optional(),
  note: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
