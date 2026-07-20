"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LessonRow, type LessonData } from "@/components/instructor/LessonRow";
import { LessonForm } from "@/components/instructor/LessonForm";
import { QuizEditor, type QuizData } from "@/components/instructor/QuizEditor";

interface ModuleData {
  id: string;
  title: string;
  order: number;
  lessons: LessonData[];
  quiz?: QuizData | null;
}

export function ModuleSection({
  module,
  courseSlug,
  courseAuthors,
}: {
  module: ModuleData;
  courseSlug: string;
  courseAuthors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [addingLesson, setAddingLesson] = useState(false);

  async function handleDeleteModule() {
    if (!confirm(`Eliminar o módulo "${module.title}" e todas as suas aulas?`)) return;
    const res = await fetch(`/api/instructor/modules/${module.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{module.title}</h3>
        <div className="flex items-center gap-2">
          <QuizEditor scope="MODULE" parentId={module.id} label="Quiz do módulo" existingQuiz={module.quiz} />
          <Button variant="ghost" onClick={handleDeleteModule}>
            Eliminar módulo
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {module.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} courseSlug={courseSlug} courseAuthors={courseAuthors} />
        ))}
      </div>

      <div className="mt-3">
        {addingLesson ? (
          <LessonForm
            moduleId={module.id}
            nextOrder={module.lessons.length}
            courseAuthors={courseAuthors}
            onDone={() => {
              setAddingLesson(false);
              router.refresh();
            }}
            onCancel={() => setAddingLesson(false)}
          />
        ) : (
          <Button variant="outline" onClick={() => setAddingLesson(true)}>
            + Adicionar aula
          </Button>
        )}
      </div>
    </Card>
  );
}
