-- CreateEnum
CREATE TYPE "TranscodeStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "VideoTranscodeJob" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" "TranscodeStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "VideoTranscodeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonVideoRendition" (
    "id" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "LessonVideoRendition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoTranscodeJob_status_idx" ON "VideoTranscodeJob"("status");

-- CreateIndex
CREATE INDEX "VideoTranscodeJob_lessonId_idx" ON "VideoTranscodeJob"("lessonId");

-- CreateIndex
CREATE INDEX "LessonVideoRendition_lessonId_idx" ON "LessonVideoRendition"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonVideoRendition_lessonId_quality_key" ON "LessonVideoRendition"("lessonId", "quality");

-- AddForeignKey
ALTER TABLE "VideoTranscodeJob" ADD CONSTRAINT "VideoTranscodeJob_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonVideoRendition" ADD CONSTRAINT "LessonVideoRendition_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
