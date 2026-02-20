export class InsufficientBalanceError extends Error {
  public readonly code = "INSUFFICIENT_FUNDS" as const;

  constructor(
    public readonly currentBalance: string,
    public readonly requestedAmount: string,
  ) {
    super(
      `Insufficient balance: available ${currentBalance}, requested ${requestedAmount}`,
    );
    this.name = "InsufficientBalanceError";
  }
}

export class AccountNotFoundError extends Error {
  public readonly code = "ACCOUNT_NOT_FOUND" as const;

  constructor(
    public readonly ownerId: string,
    public readonly assetTypeId?: string,
  ) {
    const detail = assetTypeId
      ? `owner=${ownerId}, asset=${assetTypeId}`
      : `owner=${ownerId}`;
    super(`Account not found: ${detail}`);
    this.name = "AccountNotFoundError";
  }
}

export class InvalidAmountError extends Error {
  public readonly code = "INVALID_AMOUNT" as const;

  constructor(reason: string) {
    super(`Invalid amount: ${reason}`);
    this.name = "InvalidAmountError";
  }
}

export class DuplicateTransactionError extends Error {
  public readonly code = "DUPLICATE_TRANSACTION" as const;

  constructor(
    public readonly idempotencyKey: string,
    public readonly existingEntry: unknown,
  ) {
    super(
      `Transaction already processed: idempotency key ${idempotencyKey}`,
    );
    this.name = "DuplicateTransactionError";
  }
}
