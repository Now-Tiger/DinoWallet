export type OwnerType = "USER" | "SYSTEM";

export type TransactionType = "TOPUP" | "BONUS" | "SPEND";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface TopUpBody {
  amount: number;
  assetTypeId: string;
  idempotencyKey: string;
  referenceId?: string;
}

export interface BonusBody {
  amount: number;
  assetTypeId: string;
  idempotencyKey: string;
  note?: string;
}

export interface SpendBody {
  amount: number;
  assetTypeId: string;
  idempotencyKey: string;
  referenceId?: string;
  note?: string;
}
