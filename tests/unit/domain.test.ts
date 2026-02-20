import { describe, it, expect } from "vitest";
import { Money } from "../../src/domain/values";
import {
  InvalidAmountError,
  InsufficientBalanceError,
  AccountNotFoundError,
  DuplicateTransactionError,
} from "../../src/domain/errors";

describe("Money value object", () => {
  it("accepts a positive finite number", () => {
    const money = new Money(100);
    expect(money.value).toBe(100);
  });

  it("accepts a fractional amount", () => {
    const money = new Money(0.5);
    expect(money.value).toBe(0.5);
  });

  it("rejects zero", () => {
    expect(() => new Money(0)).toThrow(InvalidAmountError);
  });

  it("rejects negative values", () => {
    expect(() => new Money(-10)).toThrow(InvalidAmountError);
  });

  it("rejects NaN", () => {
    expect(() => new Money(NaN)).toThrow(InvalidAmountError);
  });

  it("rejects Infinity", () => {
    expect(() => new Money(Infinity)).toThrow(InvalidAmountError);
  });
});

describe("Domain errors carry structured codes", () => {
  it("InsufficientBalanceError has INSUFFICIENT_FUNDS code", () => {
    const err = new InsufficientBalanceError("100", "200");
    expect(err.code).toBe("INSUFFICIENT_FUNDS");
    expect(err.currentBalance).toBe("100");
    expect(err.requestedAmount).toBe("200");
  });

  it("AccountNotFoundError has ACCOUNT_NOT_FOUND code", () => {
    const err = new AccountNotFoundError("user-1", "asset-1");
    expect(err.code).toBe("ACCOUNT_NOT_FOUND");
    expect(err.message).toContain("user-1");
  });

  it("InvalidAmountError has INVALID_AMOUNT code", () => {
    const err = new InvalidAmountError("negative");
    expect(err.code).toBe("INVALID_AMOUNT");
  });

  it("DuplicateTransactionError has DUPLICATE_TRANSACTION code", () => {
    const err = new DuplicateTransactionError("key-1", { id: "entry-1" });
    expect(err.code).toBe("DUPLICATE_TRANSACTION");
    expect(err.existingEntry).toEqual({ id: "entry-1" });
  });
});
