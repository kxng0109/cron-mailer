/*
  Warnings:

  - Made the column `subject` on table `Reminder` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Reminder" ALTER COLUMN "subject" SET NOT NULL;
