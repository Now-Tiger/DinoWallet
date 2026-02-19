import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createWalletService } from "../services/WalletService";
import { topUpSchema, bonusSchema, spendSchema } from "../schemas/walletSchemas";
import { success, failure } from "../utils/response";
import { InsufficientBalanceError, AccountNotFoundError } from "../errors/WalletErrors";


type WalletParams = { userId: string };
type TxQuery = { limit?: string; offset?: string };

const handleWalletError = (error: unknown, reply: FastifyReply) => {
  if (error instanceof AccountNotFoundError) {
    return reply.status(404).send(failure("Not found", error.message));
  }
  if (error instanceof InsufficientBalanceError) {
    return reply
      .status(422)
      .send(failure("Insufficient balance", error.message));
  }
  throw error;
};

const walletRoutes = async (app: FastifyInstance) => {
  const walletService = createWalletService(app.prisma);

  app.get(
    "/wallets/users",
    async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const users = await app.prisma.account.findMany({
        select: {
          id: true,
          ownerId: true,
          ownerType: true,
        }
      });
      return reply.send(success("Users retrieved", users));
    },
  );

  app.get(
    "/wallets/:userId/balance",
    async (
      request: FastifyRequest<{ Params: WalletParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const { userId } = request.params;
        const balances = await walletService.getBalances(userId);
        return reply.send(success("Balances retrieved", balances));
      } catch (error) {
        return handleWalletError(error, reply);
      }
    },
  );

  app.get(
    "/wallets/:userId/transactions",
    async (
      request: FastifyRequest<{ Params: WalletParams; Querystring: TxQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { userId } = request.params;
        const limit = Math.min(
          Math.max(Number(request.query.limit) || 50, 1),
          100,
        );
        const offset = Math.max(Number(request.query.offset) || 0, 0);

        const transactions = await walletService.getTransactions(
          userId,
          limit,
          offset,
        );
        return reply.send(success("Transactions retrieved", transactions));
      } catch (error) {
        return handleWalletError(error, reply);
      }
    },
  );

  app.post(
    "/wallets/:userId/topup",
    async (
      request: FastifyRequest<{ Params: WalletParams }>,
      reply: FastifyReply,
    ) => {
      const parsed = topUpSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(failure("Validation failed", parsed.error.message));
      }

      try {
        const { userId } = request.params;
        const entry = await walletService.topUp({
          userId,
          ...parsed.data,
        });
        return reply.status(201).send(success("Top-up successful", entry));
      } catch (error) {
        return handleWalletError(error, reply);
      }
    },
  );

  app.post(
    "/wallets/:userId/bonus",
    async (
      request: FastifyRequest<{ Params: WalletParams }>,
      reply: FastifyReply,
    ) => {
      const parsed = bonusSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(failure("Validation failed", parsed.error.message));
      }

      try {
        const { userId } = request.params;
        const entry = await walletService.issueBonus({
          userId,
          ...parsed.data,
        });
        return reply.status(201).send(success("Bonus issued", entry));
      } catch (error) {
        return handleWalletError(error, reply);
      }
    },
  );

  app.post(
    "/wallets/:userId/spend",
    async (
      request: FastifyRequest<{ Params: WalletParams }>,
      reply: FastifyReply,
    ) => {
      const parsed = spendSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send(failure("Validation failed", parsed.error.message));
      }

      try {
        const { userId } = request.params;
        const entry = await walletService.spend({
          userId,
          ...parsed.data,
        });
        return reply.status(201).send(success("Spend recorded", entry));
      } catch (error) {
        return handleWalletError(error, reply);
      }
    },
  );
};

export default walletRoutes;
