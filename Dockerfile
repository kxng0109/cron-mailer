FROM node:22-slim AS builder
WORKDIR /usr/src/app

COPY package*.json .
COPY tsconfig.json .
COPY prisma ./prisma

RUN npm install && npx prisma generate

COPY . .
RUN npm run build


FROM node:22-slim
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/generated ./generated

COPY prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main"]