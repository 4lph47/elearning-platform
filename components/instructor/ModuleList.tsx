"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
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
import { ModuleSection, type ModuleData } from "@/components/instructor/ModuleSection";

function SortableModule({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-start gap-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar módulo"
        className="mt-4 flex shrink-0 touch-none items-center justify-center rounded p-1 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical size={18} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// Módulos também são arrastáveis, tal como as aulas/quizzes dentro de cada
// módulo (ModuleSection.tsx) — mesma técnica (@dnd-kit), lista à parte (a
// ordem dos módulos não se mistura com a ordem das aulas de cada um).
export function ModuleList({
  courseId,
  courseSlug,
  modules,
}: {
  courseId: string;
  courseSlug: string;
  modules: ModuleData[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(modules);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => setItems(modules), [modules]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((m) => m.id === active.id);
    const newIndex = items.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    await fetch(`/api/instructor/courses/${courseId}/modules/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIds: reordered.map((m) => m.id) }),
    });
    router.refresh();
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {items.map((module) => (
            <SortableModule key={module.id} id={module.id}>
              <ModuleSection module={module} courseId={courseId} courseSlug={courseSlug} />
            </SortableModule>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
