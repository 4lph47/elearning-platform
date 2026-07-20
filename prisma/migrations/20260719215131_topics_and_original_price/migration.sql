-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "originalPrice" DOUBLE PRECISION,
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];
