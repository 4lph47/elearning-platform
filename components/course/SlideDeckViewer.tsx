"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SlideDeckSlide } from "@/lib/slideDeck";

export function SlideDeckViewer({ slides }: { slides: SlideDeckSlide[] }) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h3 className="text-2xl font-bold text-slate-900">{slide.title}</h3>
        {slide.body && <p className="max-w-md text-sm text-slate-600">{slide.body}</p>}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Slide anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-slate-900" : "bg-slate-300"}`}
            />
          ))}
        </div>

        <button
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={index === slides.length - 1}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Próximo slide"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
