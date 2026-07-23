"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

// Eliminar curso/aula é irreversível — em vez de um confirm() genérico,
// pede o nome exato de volta (like GitHub/Vercel), reduz clique acidental.
export function DeleteWithConfirmName({
  name,
  label,
  confirmingLabel,
  onConfirm,
}: {
  name: string;
  label: string;
  confirmingLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = typed.trim() === name.trim();

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
      <p className="text-sm text-red-700 dark:text-red-300">
        Escreve <span className="font-semibold">{name}</span> para confirmares a eliminação.
      </p>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={name}
        autoFocus
        className="w-full rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-red-300 focus:border-red-500 focus:outline-none dark:border-red-500/30 dark:bg-white/5 dark:text-white dark:placeholder-red-500/40"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          disabled={!matches || busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            setBusy(false);
          }}
        >
          {busy ? confirmingLabel : "Confirmar eliminação"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
