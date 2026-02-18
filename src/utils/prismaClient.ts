import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  log: process.env.ENV === "development" ? ["query", "error"] : ["error"],
});

export default prisma;
