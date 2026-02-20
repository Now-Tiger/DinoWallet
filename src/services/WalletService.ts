import {
  PrismaClient,
  Prisma,
  TransactionType,
  OwnerType,
} from "../generated/prisma/client";
import {
  InsufficientBalanceError,
  AccountNotFoundError,
  DuplicateTransactionError,
} from "../domain/errors";
import { Money } from "../domain/values";

const TREASURY_OWNER_ID = "system-treasury";

export interface TransactionParams {
  userId: string;
  assetTypeId: string;
  amount: number;
  idempotencyKey: string;
  referenceId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionResult {
  transactionId: string;
  type: TransactionType;
  amount: string;
  newBalance: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AssetBalance {
  accountId: string;
  assetTypeId: string;
  assetName: string;
  symbol: string;
  balance: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

const resolveAccounts = async (
  tx: TxClient,
  userId: string,
  assetTypeId: string,
) => {
  const userAccount = await tx.account.findUnique({
    where: { unique_owner_asset: { ownerId: userId, assetTypeId } },
  });
  if (!userAccount) throw new AccountNotFoundError(userId, assetTypeId);

  const treasuryAccount = await tx.account.findUnique({
    where: {
      unique_owner_asset: { ownerId: TREASURY_OWNER_ID, assetTypeId },
    },
  });
  if (!treasuryAccount) {
    throw new AccountNotFoundError(TREASURY_OWNER_ID, assetTypeId);
  }

  return { userAccount, treasuryAccount };
};

/**
 * Acquires row-level locks on both accounts in deterministic UUID order
 * to prevent deadlocks when concurrent transactions touch the same pair.
 */
const lockAccountsInOrder = async (
  tx: TxClient,
  idA: string,
  idB: string,
) => {
  const [first, second] = idA < idB ? [idA, idB] : [idB, idA];
  await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${first} FOR UPDATE`;
  if (first !== second) {
    await tx.$queryRaw`SELECT id FROM accounts WHERE id = ${second} FOR UPDATE`;
  }
};

const computeBalance = async (
  tx: TxClient,
  accountId: string,
): Promise<number> => {
  const result: Array<{ balance: string | number }> = await tx.$queryRaw`
    SELECT
      COALESCE(
        SUM(CASE WHEN credit_account_id = ${accountId} THEN amount ELSE 0 END), 0
      ) - COALESCE(
        SUM(CASE WHEN debit_account_id = ${accountId} THEN amount ELSE 0 END), 0
      ) AS balance
    FROM ledger_entries
    WHERE credit_account_id = ${accountId}
       OR debit_account_id = ${accountId}
  `;
  return Number(result[0]?.balance ?? 0);
};

const guardIdempotency = async (
  tx: TxClient,
  idempotencyKey: string,
): Promise<void> => {
  const existing = await tx.ledgerEntry.findUnique({
    where: { idempotencyKey },
  });
  if (existing) throw new DuplicateTransactionError(idempotencyKey, existing);
};

/**
 * Wraps a transactional operation so that a unique-constraint race
 * on idempotency_key is gracefully handled as idempotent replay.
 */
const withIdempotencyGuard = async <T>(
  prisma: PrismaClient,
  idempotencyKey: string,
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DuplicateTransactionError) throw error;

    const isUniqueViolation =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error as { code: string }).code === "P2002";
    if (isUniqueViolation) {
      const existing = await prisma.ledgerEntry.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        throw new DuplicateTransactionError(idempotencyKey, existing);
      }
    }
    throw error;
  }
};

export const createWalletService = (prisma: PrismaClient) => {
  const creditUserAccount = async (
    type: TransactionType,
    params: TransactionParams,
  ): Promise<TransactionResult> => {
    const {
      userId, assetTypeId, amount, idempotencyKey,
      referenceId, note, metadata,
    } = params;
    const money = new Money(amount);

    return withIdempotencyGuard(prisma, idempotencyKey, () =>
      prisma.$transaction(async (_tx) => {
        const tx = _tx as TxClient;
        await guardIdempotency(tx, idempotencyKey);

        const { userAccount, treasuryAccount } = await resolveAccounts(
          tx,
          userId,
          assetTypeId,
        );
        await lockAccountsInOrder(tx, treasuryAccount.id, userAccount.id);

        const entry = await tx.ledgerEntry.create({
          data: {
            debitAccountId: treasuryAccount.id,
            creditAccountId: userAccount.id,
            amount: money.value,
            type,
            idempotencyKey,
            referenceId,
            note,
            metadata: metadata ?? undefined,
          },
        });

        const newBalance = await computeBalance(tx, userAccount.id);

        return {
          transactionId: entry.id,
          type,
          amount: String(money.value),
          newBalance: String(newBalance),
          metadata: entry.metadata as Record<string, unknown> | null,
          createdAt: entry.createdAt,
        };
      }),
    );
  };

  const topUp = (params: TransactionParams) =>
    creditUserAccount(TransactionType.TOPUP, {
      ...params,
      note: params.note ?? "Wallet top-up",
    });

  const issueBonus = (params: TransactionParams) =>
    creditUserAccount(TransactionType.BONUS, {
      ...params,
      note: params.note ?? "Bonus credit",
    });

  const spend = async (params: TransactionParams): Promise<TransactionResult> => {
    const {
      userId, assetTypeId, amount, idempotencyKey,
      referenceId, note, metadata,
    } = params;
    const money = new Money(amount);

    return withIdempotencyGuard(prisma, idempotencyKey, () =>
      prisma.$transaction(async (_tx) => {
        const tx = _tx as TxClient;
        await guardIdempotency(tx, idempotencyKey);

        const { userAccount, treasuryAccount } = await resolveAccounts(
          tx,
          userId,
          assetTypeId,
        );
        await lockAccountsInOrder(tx, userAccount.id, treasuryAccount.id);

        const balance = await computeBalance(tx, userAccount.id);
        if (balance < money.value) {
          throw new InsufficientBalanceError(
            String(balance),
            String(money.value),
          );
        }

        const entry = await tx.ledgerEntry.create({
          data: {
            debitAccountId: userAccount.id,
            creditAccountId: treasuryAccount.id,
            amount: money.value,
            type: TransactionType.SPEND,
            idempotencyKey,
            referenceId,
            note: note ?? "Credit spend",
            metadata: metadata ?? undefined,
          },
        });

        return {
          transactionId: entry.id,
          type: TransactionType.SPEND,
          amount: String(money.value),
          newBalance: String(balance - money.value),
          metadata: entry.metadata as Record<string, unknown> | null,
          createdAt: entry.createdAt,
        };
      }),
    );
  };

  const getBalances = async (userId: string): Promise<AssetBalance[]> =>
    prisma.$queryRaw<AssetBalance[]>`
      SELECT
        a.id            AS "accountId",
        a.asset_type_id AS "assetTypeId",
        at.name         AS "assetName",
        at.symbol,
        (
          COALESCE(SUM(CASE WHEN le.credit_account_id = a.id THEN le.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN le.debit_account_id  = a.id THEN le.amount ELSE 0 END), 0)
        )::TEXT AS balance
      FROM accounts a
      JOIN asset_types at ON at.id = a.asset_type_id
      LEFT JOIN ledger_entries le
        ON le.credit_account_id = a.id
        OR le.debit_account_id  = a.id
      WHERE a.owner_id = ${userId}
        AND a.owner_type = 'USER'
      GROUP BY a.id, a.asset_type_id, at.name, at.symbol
    `;

  const getTransactions = async (
    userId: string,
    limit = 50,
    offset = 0,
  ) => {
    const accounts = await prisma.account.findMany({
      where: { ownerId: userId, ownerType: OwnerType.USER },
      select: { id: true },
    });
    if (accounts.length === 0) throw new AccountNotFoundError(userId);

    const accountIds = accounts.map((a: { id: string }) => a.id);

    return prisma.ledgerEntry.findMany({
      where: {
        OR: [
          { debitAccountId: { in: accountIds } },
          { creditAccountId: { in: accountIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        debitAccount: { include: { assetType: true } },
        creditAccount: { include: { assetType: true } },
      },
    });
  };

  return { topUp, issueBonus, spend, getBalances, getTransactions };
};

export type WalletService = ReturnType<typeof createWalletService>;
