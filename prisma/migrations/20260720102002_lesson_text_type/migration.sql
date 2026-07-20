-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('VIDEO', 'TEXT');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "textContent" TEXT,
ADD COLUMN     "type" "LessonType" NOT NULL DEFAULT 'VIDEO',
ALTER COLUMN "contentUrl" DROP NOT NULL;
