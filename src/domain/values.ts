import { InvalidAmountError } from "./errors";

/**
 * Self-validating value object representing a monetary amount.
 * Rejects non-finite, zero, and negative values at construction time.
 */
export class Money {
  public readonly value: number;

  constructor(amount: number) {
    if (!Number.isFinite(amount)) {
      throw new InvalidAmountError("must be a finite number");
    }
    if (amount <= 0) {
      throw new InvalidAmountError("must be greater than zero");
    }
    this.value = amount;
  }
}
