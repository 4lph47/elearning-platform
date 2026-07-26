"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";

// Botão fixo no canto superior direito do ecrã — só aparece a ver o perfil
// público de OUTRA pessoa (nunca o próprio), e só a quem tem sessão iniciada
// (conversar exige um remetente identificado). Auto-suficiente (lê a sessão
// sozinho) para as páginas de perfil só terem de o montar sempre, sem if.
export function ChatButton({
  otherUserId,
  otherUserName,
  otherUserImage,
}: {
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
}) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status !== "authenticated" || session.user.id === otherUserId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 top-20 z-30 flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-500"
      >
        <MessageCircle size={15} /> Conversar
      </button>

      {open && (
        <ChatWindow
          otherUserId={otherUserId}
          otherUserName={otherUserName}
          otherUserImage={otherUserImage}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
