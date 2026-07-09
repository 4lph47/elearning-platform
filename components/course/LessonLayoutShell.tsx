"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { CourseChatbot } from "@/components/course/CourseChatbot";
import { ChatOpenProvider, SidebarCollapsedProvider } from "@/components/course/ChatOpenContext";

export function LessonLayoutShell({
  sidebar,
  chat,
  children,
}: {
  sidebar: React.ReactNode;
  chat?: { courseId: string; lessonId: string; courseTitle: string };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const effectiveChatOpen = chat ? chatOpen : false;

  return (
    <div className={`transition-[padding] duration-200 ${effectiveChatOpen ? "lg:pr-[440px]" : ""}`}>
      <div
        className={`mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-4 py-6 ${
          collapsed ? "" : "lg:grid-cols-[300px_1fr]"
        }`}
      >
        {!collapsed && <div>{sidebar}</div>}

        <div className={collapsed ? "lg:pl-10" : ""}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="mb-3 hidden items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 lg:inline-flex"
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
