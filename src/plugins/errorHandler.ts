import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { success, failure } from "../utils/response";
import {
  InsufficientBalanceError,
  AccountNotFoundError,
  InvalidAmountError,
  DuplicateTransactionError,
} from "../domain/errors";

type DomainError =
  | InsufficientBalanceError
  | AccountNotFoundError
  | InvalidAmountError
  | DuplicateTransactionError;

const STATUS_MAP: Record<string, number> = {
  DUPLICATE_TRANSACTION: 200,
  VALIDATION_ERROR: 400,
  INVALID_AMOUNT: 400,
  ACCOUNT_NOT_FOUND: 404,
  INSUFFICIENT_FUNDS: 422,
};

const MESSAGE_MAP: Record<string, string> = {
  DUPLICATE_TRANSACTION: "Transaction already processed",
  VALIDATION_ERROR: "Validation failed",
  INVALID_AMOUNT: "Invalid amount",
  ACCOUNT_NOT_FOUND: "Not found",
  INSUFFICIENT_FUNDS: "Insufficient balance",
};

const isDomainError = (error: unknown): error is DomainError =>
  error instanceof InsufficientBalanceError ||
  error instanceof AccountNotFoundError ||
  error instanceof InvalidAmountError ||
  error instanceof DuplicateTransactionError;

const handleDomainError = (error: DomainError, reply: FastifyReply) => {
  const status = STATUS_MAP[error.code] ?? 500;
  const message = MESSAGE_MAP[error.code] ?? "Internal error";

  if (error instanceof DuplicateTransactionError) {
    return reply.status(status).send(success(message, error.existingEntry));
  }
  return reply.status(status).send(failure(message, error.message, error.code));
};

const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler(
    (error: unknown, _request: FastifyRequest, reply: FastifyReply) => {
      if (isDomainError(error)) return handleDomainError(error, reply);

      const statusCode =
        (error as { statusCode?: number }).statusCode ?? 500;
      const msg =
        (error as { message?: string }).message ?? "Internal Server Error";

      app.log.error(error);
      return reply.status(statusCode).send(failure("Internal error", msg));
    },
  );
});

export default errorHandlerPlugin;
