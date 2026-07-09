import Link from "next/link";
import { Card, Badge } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";

export interface CourseCardData {
  slug: string;
  title: string;
  description: string;
  category: string;
  level: string;
  thumbnailUrl: string | null;
  instructorName: string;
  lessonCount: number;
  price: number;
  rating: number;
  ratingCount: number;
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

const LEVEL_TONE: Record<string, "info" | "warning" | "danger"> = {
  beginner: "info",
  intermediate: "warning",
  advanced: "danger",
};

export function CourseCard({ course }: { course: CourseCardData }) {
  return (
    <Link href={`/courses/${course.slug}`} className="group block h-full">
      <Card className="h-full overflow-hidden transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
        <div className="flex h-36 items-center justify-center overflow-hidden bg-slate-200 text-3xl font-bold text-slate-500">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            course.title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex items-center gap-2">
            <Badge>{course.category}</Badge>
            <Badge tone={LEVEL_TONE[course.level] ?? "default"}>{LEVEL_LABEL[course.level] ?? course.level}</Badge>
          </div>
          <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:underline">
            {course.title}
          </h3>
          <p className="text-xs text-slate-500">{course.instructorName}</p>
          {course.ratingCount > 0 ? (
            <StarRating rating={course.rating} count={course.ratingCount} />
          ) : (
            <span className="text-xs text-slate-400">Ainda sem avaliações</span>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-base font-bold text-slate-900">
              {course.price === 0 ? "Grátis" : `${course.price.toFixed(2)}€`}
            </span>
            <span className="text-xs text-slate-400">{course.lessonCount} aulas</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
