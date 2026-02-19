import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma";
import walletRoutes from "./routes/walletRoutes";

dotenv.config();

const app = Fastify({
  logger: {
    transport:
      process.env.ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

const start = async () => {
  try {
    await app.register(cors);
    await app.register(helmet);
    await app.register(prismaPlugin);
    await app.register(walletRoutes);

    app.get("/health", async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }));

    app.get("/", async () => ({ message: "Home page", success: true }));

    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
