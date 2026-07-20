-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetAudience" TEXT[] DEFAULT ARRAY[]::TEXT[];
