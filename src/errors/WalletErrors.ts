export class InsufficientBalanceError extends Error {
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
