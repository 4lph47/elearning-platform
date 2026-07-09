"use client";

import { createContext, useContext } from "react";

const ChatOpenContext = createContext(false);

export function ChatOpenProvider({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <ChatOpenContext.Provider value={open}>{children}</ChatOpenContext.Provider>;
}

export function useChatOpen() {
  return useContext(ChatOpenContext);
}

const SidebarCollapsedContext = createContext(false);

export function SidebarCollapsedProvider({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return <SidebarCollapsedContext.Provider value={collapsed}>{children}</SidebarCollapsedContext.Provider>;
}

export function useSidebarCollapsed() {
  return useContext(SidebarCollapsedContext);
}
