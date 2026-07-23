"use client";

import type { ReactNode } from "react";
import { useSidebar } from "@/components/layout/SidebarContext";

export function SidebarMainShell({ children }: { children: ReactNode }) {
  const { state } = useSidebar();

  const marginClass = state === "full" ? "md:ml-60" : state === "mini" ? "md:ml-16" : "";

  return <main className={`min-h-screen pt-16 transition-[margin] duration-200 ${marginClass}`}>{children}</main>;
}
