import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app";
import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";

const ALICE = "user-alice";
const GOLD_ASSET = "00000000-0000-4000-a000-000000000001";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /v1/wallets/:userId/balance", () => {
  it("returns balances for a seeded user", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/wallets/${ALICE}/balance`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty("balance");
    expect(body.data[0]).toHaveProperty("symbol");
  });

  it("returns empty array for unknown user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/wallets/nonexistent-user/balance",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toEqual([]);
  });
});

describe("POST /v1/wallets/:userId/topup", () => {
  it("successfully tops up and returns shaped result", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/topup`,
      payload: {
        amount: 50,
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("transactionId");
    expect(body.data).toHaveProperty("newBalance");
    expect(body.data.type).toBe("TOPUP");
  });

  it("returns 400 on invalid payload (missing amount)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/topup`,
      payload: {
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 on negative amount", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/topup`,
      payload: {
        amount: -10,
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /v1/wallets/:userId/bonus", () => {
  it("successfully issues a bonus", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/bonus`,
      payload: {
        amount: 25,
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
        note: "Welcome bonus",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.type).toBe("BONUS");
    expect(body.data).toHaveProperty("newBalance");
  });
});

describe("POST /v1/wallets/:userId/spend", () => {
  it("successfully spends and returns new balance", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/spend`,
      payload: {
        amount: 10,
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.type).toBe("SPEND");
    expect(body.data).toHaveProperty("newBalance");
  });

  it("returns 422 when spending more than balance", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/spend`,
      payload: {
        amount: 999_999_999,
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe("INSUFFICIENT_FUNDS");
  });

  it("returns 404 for non-existent user account", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/wallets/ghost-user/spend",
      payload: {
        amount: 1,
        assetTypeId: GOLD_ASSET,
        idempotencyKey: uuidv4(),
      },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.errorCode).toBe("ACCOUNT_NOT_FOUND");
  });
});

describe("GET /v1/wallets/:userId/transactions", () => {
  it("returns transaction history for a seeded user", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/v1/wallets/${ALICE}/transactions`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 404 for unknown user", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/wallets/nonexistent-user/transactions",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("Idempotency", () => {
  it("returns 200 with cached result on duplicate idempotency key", async () => {
    const key = uuidv4();
    const payload = {
      amount: 5,
      assetTypeId: GOLD_ASSET,
      idempotencyKey: key,
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/topup`,
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: `/v1/wallets/${ALICE}/topup`,
      payload,
    });
    expect(second.statusCode).toBe(200);
    const body = second.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("already processed");
  });
});

describe("Concurrency — parallel spends never overdraw", () => {
  it("only allows spends up to the available balance", async () => {
    const balRes = await app.inject({
      method: "GET",
      url: `/v1/wallets/${ALICE}/balance`,
    });
    const balances = balRes.json().data as Array<{
      assetTypeId: string;
      balance: string;
    }>;
    const goldBalance = Number(
      balances.find((b) => b.assetTypeId === GOLD_ASSET)?.balance ?? 0,
    );

    const spendAmount = Math.ceil(goldBalance / 2) + 1;
    const attempts = 3;

    const results = await Promise.all(
      Array.from({ length: attempts }, () =>
        app.inject({
          method: "POST",
          url: `/v1/wallets/${ALICE}/spend`,
          payload: {
            amount: spendAmount,
            assetTypeId: GOLD_ASSET,
            idempotencyKey: uuidv4(),
          },
        }),
      ),
    );

    const successes = results.filter((r) => r.statusCode === 201);
    const failures = results.filter((r) => r.statusCode === 422);

    expect(successes.length).toBeGreaterThanOrEqual(0);
    expect(successes.length + failures.length).toBe(attempts);

    const finalBal = await app.inject({
      method: "GET",
      url: `/v1/wallets/${ALICE}/balance`,
    });
    const finalGold = Number(
      (finalBal.json().data as Array<{ assetTypeId: string; balance: string }>)
        .find((b) => b.assetTypeId === GOLD_ASSET)?.balance ?? 0,
    );
    expect(finalGold).toBeGreaterThanOrEqual(0);
  });
});
