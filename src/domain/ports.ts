/**
 * Repository port interfaces — define what the domain needs from
 * infrastructure without coupling to Prisma or any specific ORM.
 * Implementations live in the infrastructure layer.
 * These are consumed by use cases and can be mocked in unit tests.
 */

export interface AccountEntity {
  id: string;
  ownerId: string | null;
  ownerType: "USER" | "SYSTEM";
  assetTypeId: string;
}

export interface LedgerEntryEntity {
  id: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number | string;
  type: "TOPUP" | "BONUS" | "SPEND";
  idempotencyKey: string;
  referenceId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface AccountRepository {
  findByOwnerAndAsset(
    ownerId: string,
    assetTypeId: string,
  ): Promise<AccountEntity | null>;

  findAllByOwner(
    ownerId: string,
    ownerType: "USER" | "SYSTEM",
  ): Promise<AccountEntity[]>;
}

export interface LedgerRepository {
  findByIdempotencyKey(key: string): Promise<LedgerEntryEntity | null>;
  getBalance(accountId: string): Promise<number>;
}
