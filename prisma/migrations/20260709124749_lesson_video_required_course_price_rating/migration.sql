/*
  Warnings:

  - You are about to drop the column `contentType` on the `Lesson` table. All the data in the column will be lost.
  - You are about to drop the column `textContent` on the `Lesson` table. All the data in the column will be lost.
  - Made the column `contentUrl` on table `Lesson` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "contentType",
DROP COLUMN "textContent",
ALTER COLUMN "contentUrl" SET NOT NULL;

-- DropEnum
DROP TYPE "LessonContentType";
