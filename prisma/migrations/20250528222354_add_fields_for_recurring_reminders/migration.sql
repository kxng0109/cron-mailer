-- CreateEnum
CREATE TYPE "Pattern" AS ENUM ('once', 'every_n_minutes', 'hourly', 'daily', 'weekly', 'monthly', 'yearly');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "dayOfMonth" INTEGER,
ADD COLUMN     "daysOfWeek" JSONB,
ADD COLUMN     "interval" INTEGER,
ADD COLUMN     "pattern" "Pattern" NOT NULL DEFAULT 'once',
ADD COLUMN     "time" TEXT,
ALTER COLUMN "sendAt" DROP NOT NULL;
