-- CreateTable
CREATE TABLE "WatchEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "WatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchEvent_lessonId_idx" ON "WatchEvent"("lessonId");

-- CreateIndex
CREATE INDEX "WatchEvent_createdAt_idx" ON "WatchEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "WatchEvent" ADD CONSTRAINT "WatchEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchEvent" ADD CONSTRAINT "WatchEvent_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
