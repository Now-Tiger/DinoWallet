import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createWalletService } from "../services/WalletService";
import { topUpSchema, bonusSchema, spendSchema } from "../schemas/walletSchemas";
import { success, failure } from "../utils/response";

type WalletParams = { userId: string };
type TxQuery = { limit?: string; offset?: string };

const walletRoutes = async (app: FastifyInstance) => {
  const walletService = createWalletService(app.prisma);

  app.get(
    "/wallets/users",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const users = await app.prisma.account.findMany({
        select: { id: true, ownerId: true, ownerType: true },
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
      const balances = await walletService.getBalances(request.params.userId);
      return reply.send(success("Balances retrieved", balances));
    },
  );

  app.get(
    "/wallets/:userId/transactions",
    async (
      request: FastifyRequest<{ Params: WalletParams; Querystring: TxQuery }>,
      reply: FastifyReply,
    ) => {
      const limit = Math.min(
        Math.max(Number(request.query.limit) || 50, 1),
        100,
      );
      const offset = Math.max(Number(request.query.offset) || 0, 0);
      const transactions = await walletService.getTransactions(
        request.params.userId,
        limit,
        offset,
      );
      return reply.send(success("Transactions retrieved", transactions));
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
          .send(failure("Validation failed", parsed.error.message, "VALIDATION_ERROR"));
      }
      const result = await walletService.topUp({
        userId: request.params.userId,
        ...parsed.data,
      });
      return reply.status(201).send(success("Top-up successful", result));
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
          .send(failure("Validation failed", parsed.error.message, "VALIDATION_ERROR"));
      }
      const result = await walletService.issueBonus({
        userId: request.params.userId,
        ...parsed.data,
      });
      return reply.status(201).send(success("Bonus issued", result));
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
          .send(failure("Validation failed", parsed.error.message, "VALIDATION_ERROR"));
      }
      const result = await walletService.spend({
        userId: request.params.userId,
        ...parsed.data,
      });
      return reply.status(201).send(success("Spend recorded", result));
    },
  );
};

export default walletRoutes;
