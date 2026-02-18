FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY src ./src

RUN npm ci
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src ./src

EXPOSE 8000

CMD ["sh", "-c", "npx prisma db push && npx tsx src/seed.ts && npx tsx src/server.ts"]
