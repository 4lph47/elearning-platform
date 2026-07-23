"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Video, Type as TypeIcon, HelpCircle } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LessonRow, type LessonData } from "@/components/instructor/LessonRow";
import { QuizRow, type ModuleQuizData } from "@/components/instructor/QuizRow";

export interface ModuleData {
  id: string;
  title: string;
  order: number;
  lessons: LessonData[];
  quizzes: ModuleQuizData[];
}

// Aulas e quizzes do módulo partilham a mesma lista arrastável, ordenada por
// `order` — um quiz pode ficar em qualquer posição entre aulas (ver
// app/api/instructor/modules/[moduleId]/reorder/route.ts).
type MergedItem =
  | { id: string; kind: "lesson"; order: number; lesson: LessonData }
  | { id: string; kind: "quiz"; order: number; quiz: ModuleQuizData };

function mergeItems(module: ModuleData): MergedItem[] {
  return [
    ...module.lessons.map((l) => ({ id: `lesson-${l.id}`, kind: "lesson" as const, order: l.order, lesson: l })),
    ...module.quizzes.map((q) => ({ id: `quiz-${q.id}`, kind: "quiz" as const, order: q.order, quiz: q })),
  ].sort((a, b) => a.order - b.order);
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-1.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        className="flex shrink-0 touch-none items-center justify-center rounded p-1 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ModuleSection({
  module,
  courseId,
  courseSlug,
}: {
  module: ModuleData;
  courseId: string;
  courseSlug: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(() => mergeItems(module));
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // module vem de novo do servidor após router.refresh() (guardar/eliminar/
  // adicionar) — ressincroniza a lista local com a ordem/itens reais.
  useEffect(() => setItems(mergeItems(module)), [module]);

  async function handleDeleteModule() {
    if (!confirm(`Eliminar o módulo "${module.title}" e todas as suas aulas?`)) return;
    const res = await fetch(`/api/instructor/modules/${module.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    await fetch(`/api/instructor/modules/${module.id}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: reordered.map((it) => ({
          id: it.kind === "lesson" ? it.lesson.id : it.quiz.id,
          kind: it.kind,
        })),
      }),
    });
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{module.title}</h3>
        <Button variant="ghost" onClick={handleDeleteModule}>
          Eliminar módulo
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableRow key={item.id} id={item.id}>
                {item.kind === "lesson" ? (
                  <LessonRow lesson={item.lesson} courseId={courseId} moduleId={module.id} courseSlug={courseSlug} />
                ) : (
                  <QuizRow quiz={item.quiz} courseId={courseId} moduleId={module.id} />
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="relative mt-3">
        {addChoiceOpen ? (
          <div className="flex flex-wrap gap-2">
            <FadeLink
              href={`/instructor/courses/${courseId}/modules/${module.id}/lessons/new?type=VIDEO`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              <Video size={14} /> Aula de vídeo
            </FadeLink>
            <FadeLink
              href={`/instructor/courses/${courseId}/modules/${module.id}/lessons/new?type=TEXT`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              <TypeIcon size={14} /> Aula de texto
            </FadeLink>
            <FadeLink
              href={`/instructor/courses/${courseId}/modules/${module.id}/quizzes/new`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              <HelpCircle size={14} /> Quiz
            </FadeLink>
            <Button variant="ghost" onClick={() => setAddChoiceOpen(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAddChoiceOpen(true)}>
            + Adicionar
          </Button>
        )}
      </div>
    </Card>
  );
}
