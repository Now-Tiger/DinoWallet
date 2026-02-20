import dotenv from "dotenv";
import { buildApp } from "./app";

dotenv.config();

const start = async () => {
  const app = await buildApp();
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
