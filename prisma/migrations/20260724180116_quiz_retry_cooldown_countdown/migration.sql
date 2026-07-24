-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "retryAfterHours" INTEGER,
ADD COLUMN     "showCountdown" BOOLEAN NOT NULL DEFAULT false;
