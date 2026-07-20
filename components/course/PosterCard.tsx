import { CourseTile } from "@/components/course/CourseTile";
import type { CourseCardData } from "@/components/course/CourseCard";

export function PosterCard({
  course,
  href,
  progressPercent,
  hidePrice,
}: {
  course: CourseCardData;
  href?: string;
  progressPercent?: number;
  hidePrice?: boolean;
}) {
  return (
    <CourseTile
      course={course}
      href={href}
      progressPercent={progressPercent}
      hidePrice={hidePrice}
      className="w-64 shrink-0 sm:w-72"
    />
  );
}
