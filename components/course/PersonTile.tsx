"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import type { PersonResult } from "@/components/course/SearchExtras";
import {
  boxFromRect,
  findScrollAncestor,
  textBoxFromElement,
  useCardTransition,
} from "@/components/course/CardTransitionContext";

const ROLE_LABEL: Record<PersonResult["role"], string> = {
  STUDENT: "Aluno",
  INSTRUCTOR: "Instrutor",
  ADMIN: "Admin",
};

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

// Mesma estrutura dos cards de curso (média em cima, texto em baixo) e o
// mesmo voo até ao alvo real (CardTransitionContext/Overlay) — reaproveita
// o sistema do CourseTile por inteiro: "video" carrega o avatar, "title" o
// nome, destinationKind "profile" só muda a forma no overlay (círculo, não
// retângulo). Perfis (InstructorProfileHero/StudentProfileHero) chamam
// arrive() com a posição real do avatar/nome ao montar.
export function PersonTile({ person, className = "" }: { person: PersonResult; className?: string }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const avatarBoxRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const { state, start } = useCardTransition();
  const id = useId();
  const isTransitioning = state?.cardId === id && !state.arrived;
  const href = person.role === "STUDENT" ? `/students/${person.id}` : `/instructors/${person.id}`;

  function handleClick() {
    if (!avatarBoxRef.current) return;
    const avatarBox = boxFromRect(avatarBoxRef.current.getBoundingClientRect());
    const nameBox = nameRef.current ? textBoxFromElement(nameRef.current) : null;
    const scrollOriginEl = findScrollAncestor(avatarBoxRef.current);

    start({
      cardId: id,
      slug: person.id,
      destinationKind: "profile",
      videoRawBox: avatarBox,
      titleRawBox: nameBox,
      categoryRawBox: null,
      instructorRawBox: null,
      ratingRawBox: null,
      videoBox: avatarBox,
      titleBox: nameBox,
      categoryBox: null,
      instructorBox: null,
      ratingBox: null,
      title: person.name,
      category: "",
      instructorName: "",
      lessonCount: 0,
      rating: 0,
      ratingCount: 0,
      thumbnailUrl: person.image,
      videoUrl: null,
      youtubeId: null,
      videoTime: 0,
      capturedAt: Date.now(),
      scrollOriginEl,
      scrollOriginLeft: scrollOriginEl?.scrollLeft ?? 0,
      scrollOriginTop: scrollOriginEl?.scrollTop ?? 0,
    });
  }

  return (
    <Link
      ref={linkRef}
      href={href}
      prefetch
      className={`group relative flex flex-col items-center text-center ${isTransitioning ? "pointer-events-none opacity-0" : ""} ${className}`}
      onClick={handleClick}
    >
      <div
        ref={avatarBoxRef}
        className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 dark:group-hover:ring-white/40"
      >
        {person.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-slate-400">{initials(person.name)}</span>
        )}
      </div>
      <div className="mt-2.5 min-w-0 max-w-[9rem]">
        <span
          ref={nameRef}
          className="block truncate font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400"
        >
          {person.name}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {person.username ? `@${person.username} · ` : ""}
          {ROLE_LABEL[person.role]}
        </span>
      </div>
    </Link>
  );
}
