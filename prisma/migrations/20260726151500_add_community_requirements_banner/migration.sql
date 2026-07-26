-- AlterTable
ALTER TABLE "Community" ADD COLUMN "bannerUrl" TEXT;

-- CreateEnum
CREATE TYPE "CommunityRequirementType" AS ENUM (
  'PURCHASED_COURSE',
  'COMPLETED_COURSE',
  'MIN_ENROLLMENTS',
  'MIN_COMPLETED_COURSES',
  'MIN_REVIEWS',
  'INSTRUCTOR_ONLY',
  'STUDENT_ONLY'
);

-- CreateTable
CREATE TABLE "CommunityRequirement" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "type" "CommunityRequirementType" NOT NULL,
    "courseId" TEXT,
    "minValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityRequirement_communityId_idx" ON "CommunityRequirement"("communityId");

-- AddForeignKey
ALTER TABLE "CommunityRequirement" ADD CONSTRAINT "CommunityRequirement_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityRequirement" ADD CONSTRAINT "CommunityRequirement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
