-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "_CourseCollaborators" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CourseCollaborators_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_LessonContributors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LessonContributors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CourseCollaborators_B_index" ON "_CourseCollaborators"("B");

-- CreateIndex
CREATE INDEX "_LessonContributors_B_index" ON "_LessonContributors"("B");

-- AddForeignKey
ALTER TABLE "_CourseCollaborators" ADD CONSTRAINT "_CourseCollaborators_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseCollaborators" ADD CONSTRAINT "_CourseCollaborators_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LessonContributors" ADD CONSTRAINT "_LessonContributors_A_fkey" FOREIGN KEY ("A") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LessonContributors" ADD CONSTRAINT "_LessonContributors_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
