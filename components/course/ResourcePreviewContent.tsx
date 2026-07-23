import type { LessonResourceData } from "@/components/course/LessonTabs";
import { SlideDeckViewer } from "@/components/course/SlideDeckViewer";
import { buildSlideDeck } from "@/lib/slideDeck";
import { SpreadsheetPreviewViewer } from "@/components/course/SpreadsheetPreviewViewer";
import { buildSpreadsheetPreview } from "@/lib/spreadsheetPreview";

// Partilhado entre o visualizador de recursos do aluno (LessonBody.tsx) e a
// pré-visualização (maior, ao clicar) de recursos no editor do instrutor
// (LessonResourcesCard.tsx) — mesma lógica de "que viewer usar por tipo".
export function ResourcePreviewContent({ resource }: { resource: LessonResourceData }) {
  if (resource.type === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resource.url} alt={resource.name} className="h-full w-full object-contain" />;
  }
  if (resource.type === "VIDEO") {
    return <video controls src={resource.url} className="h-full w-full bg-black" />;
  }
  if (resource.type === "SLIDES") {
    return <SlideDeckViewer slides={buildSlideDeck(resource.name)} />;
  }
  if (resource.type === "OTHER" && /\.xlsx?$/i.test(resource.name)) {
    return <SpreadsheetPreviewViewer preview={buildSpreadsheetPreview(resource.name)} />;
  }
  return (
    <iframe
      src={`${resource.url}#toolbar=0&navpanes=0&scrollbar=0`}
      className="h-full w-full border-0"
      title={resource.name}
    />
  );
}
