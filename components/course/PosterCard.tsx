import { CourseTile } from "@/components/course/CourseTile";
import type { CourseCardData } from "@/components/course/CourseCard";
import type { TransitionKind } from "@/components/course/CardTransitionContext";

export function PosterCard({
  course,
  href,
  progressPercent,
  hidePrice,
  destinationKind,
  cardId,
}: {
  course: CourseCardData;
  href?: string;
  progressPercent?: number;
  hidePrice?: boolean;
  destinationKind?: TransitionKind;
  cardId?: string;
}) {
  return (
    <CourseTile
      course={course}
      href={href}
      progressPercent={progressPercent}
      hidePrice={hidePrice}
      destinationKind={destinationKind}
      cardId={cardId}
      className="w-64 shrink-0 sm:w-72"
    />
  );
}
