-- CreateTable
CREATE TABLE "CourseComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "CourseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCommentLike" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CourseCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseComment_courseId_idx" ON "CourseComment"("courseId");

-- CreateIndex
CREATE INDEX "CourseComment_parentId_idx" ON "CourseComment"("parentId");

-- CreateIndex
CREATE INDEX "CourseCommentLike_commentId_idx" ON "CourseCommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCommentLike_userId_commentId_key" ON "CourseCommentLike"("userId", "commentId");

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseComment" ADD CONSTRAINT "CourseComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentLike" ADD CONSTRAINT "CourseCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CourseComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCommentLike" ADD CONSTRAINT "CourseCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
