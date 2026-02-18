import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import dotenv from "dotenv";

dotenv.config();

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

const start = async () => {
  try {
    await app.register(cors);
    await app.register(helmet);

    app.get("/health", async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }));

    // routes registered here in Phase 5

    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
