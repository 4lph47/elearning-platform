"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { CourseChatbot } from "@/components/course/CourseChatbot";
import { ChatOpenProvider, SidebarCollapsedProvider } from "@/components/course/ChatOpenContext";

export function LessonLayoutShell({
  courseSlug,
  courseTitle,
  sidebar,
  chat,
  children,
}: {
  courseSlug: string;
  courseTitle: string;
  sidebar: React.ReactNode;
  chat?: { courseId: string; lessonId: string; courseTitle: string };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const effectiveChatOpen = chat ? chatOpen : false;

  return (
    <div
      className={`min-h-screen bg-white transition-[padding] duration-200 dark:bg-black ${effectiveChatOpen ? "lg:pr-[440px]" : ""}`}
    >
      <div className="mx-auto max-w-[1600px] px-4 pt-6">
        <Link
          href={`/courses/${courseSlug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
        >
          <ArrowLeft size={15} /> {courseTitle}
        </Link>
      </div>

      <div
        className={`mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-4 py-6 ${
          collapsed ? "" : "lg:grid-cols-[300px_1fr]"
        }`}
      >
        <div className={`hidden ${collapsed ? "lg:hidden" : "lg:block"}`}>{sidebar}</div>

        <div className={collapsed ? "lg:pl-10" : ""}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="mb-3 hidden items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5 lg:inline-flex"
          >
            {collapsed ? (
              <>
                <PanelLeftOpen size={14} /> Mostrar progresso
              </>
            ) : (
              <>
                <PanelLeftClose size={14} /> Expandir conteúdo
              </>
            )}
          </button>
          <SidebarCollapsedProvider collapsed={collapsed}>
            <ChatOpenProvider open={effectiveChatOpen}>{children}</ChatOpenProvider>
          </SidebarCollapsedProvider>
        </div>
      </div>

      {chat && (
        <CourseChatbot
          courseId={chat.courseId}
          lessonId={chat.lessonId}
          courseTitle={chat.courseTitle}
          open={chatOpen}
          onOpenChange={setChatOpen}
        />
      )}
    </div>
  );
}
