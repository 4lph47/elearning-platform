-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RESALE_COMMISSION_CHANGE';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "resaleCourseTitle" TEXT,
ADD COLUMN     "resaleNewCommission" DOUBLE PRECISION,
ADD COLUMN     "resaleNewPrice" DOUBLE PRECISION,
ADD COLUMN     "resaleOldCommission" DOUBLE PRECISION,
ADD COLUMN     "resaleOldPrice" DOUBLE PRECISION,
ALTER COLUMN "commentId" DROP NOT NULL,
ALTER COLUMN "courseSlug" DROP NOT NULL,
ALTER COLUMN "lessonId" DROP NOT NULL;
