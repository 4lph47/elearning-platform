-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoplayNextLesson" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultResaleMinCommission" DOUBLE PRECISION;
