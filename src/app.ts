import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import prismaPlugin from "./plugins/prisma";
import errorHandlerPlugin from "./plugins/errorHandler";
import walletRoutes from "./routes/walletRoutes";

/**
 * Composition root — builds and returns a fully configured Fastify
 * instance without starting the server. This separation makes the
 * app importable for integration tests without binding to a port.
 */
export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      transport:
        process.env.ENV === "development"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  await app.register(cors);
  await app.register(helmet);
  await app.register(errorHandlerPlugin);
  await app.register(prismaPlugin);
  await app.register(walletRoutes, { prefix: "/v1" });

  app.get("/", async () => ({ message: "Home page", success: true }));

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  return app;
};
