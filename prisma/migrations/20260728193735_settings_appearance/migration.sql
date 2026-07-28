-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT 'blue',
ADD COLUMN     "fontSize" TEXT NOT NULL DEFAULT 'md',
ADD COLUMN     "reduceMotion" BOOLEAN NOT NULL DEFAULT false;
