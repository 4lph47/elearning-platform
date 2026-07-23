-- DropIndex
DROP INDEX "Quiz_moduleId_key";

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Quiz_moduleId_idx" ON "Quiz"("moduleId");
