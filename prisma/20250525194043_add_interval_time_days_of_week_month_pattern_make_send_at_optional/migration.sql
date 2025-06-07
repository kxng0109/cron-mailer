-- CreateEnum
CREATE TYPE "ReminderPattern" AS ENUM ('once', 'every_n_minutes', 'hourly', 'daily', 'weekly', 'monthly', 'yearly');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "daysOfWeek" INTEGER,
ADD COLUMN     "interval" INTEGER,
ADD COLUMN     "month" INTEGER,
ADD COLUMN     "pattern" "ReminderPattern" NOT NULL DEFAULT 'once',
ADD COLUMN     "time" TEXT,
ALTER COLUMN "sendAt" DROP NOT NULL;
