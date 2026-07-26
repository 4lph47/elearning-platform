"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Edit, Trash2, X, Save, BookOpen, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  lessonId: string;
  lesson: {
    title: string;
    module: {
      title: string;
    };
  };
}

export function LessonNotes({ lessonId }: { lessonId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCurrentLesson, setFilterCurrentLesson] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function loadNotes() {
    setLoading(true);
    const res = await fetch(`/api/lessons/${lessonId}/notes`);
    if (res.ok) {
      const data = await res.json();
      setNotes(data.notes ?? []);
      setCurrentLessonId(data.currentLessonId ?? "");
    }
    setLoading(false);
  }

  async function saveNote() {
    setError(null);
    if (!noteContent.trim()) {
      setError("O conteúdo não pode estar vazio");
      return;
    }

    setSaving(true);
    const body = { title: noteTitle.trim() || undefined, content: noteContent.trim() };
    const res = editingNote
      ? await fetch(`/api/lessons/${lessonId}/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch(`/api/lessons/${lessonId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar nota");
      return;
    }

    const savedNote = await res.json();
    if (editingNote) {
      setNotes((prev) => prev.map((n) => (n.id === savedNote.id ? savedNote : n)));
    } else {
      setNotes((prev) => [savedNote, ...prev]);
    }

    closeEditor();
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Tens certeza que queres remover esta nota?")) return;

    const res = await fetch(`/api/lessons/${lessonId}/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  }

  function openEditor(note?: Note) {
    if (note) {
      setEditingNote(note);
      setNoteTitle(note.title);
      setNoteContent(note.content);
      setIsCreating(false);
    } else {
      setEditingNote(null);
      setNoteTitle("");
      setNoteContent("");
      setIsCreating(true);
    }
    setError(null);
  }

  function closeEditor() {
    setEditingNote(null);
    setIsCreating(false);
    setNoteTitle("");
    setNoteContent("");
    setError(null);
  }

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.lesson.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = !filterCurrentLesson || n.lessonId === currentLessonId;
    
    return matchesSearch && matchesFilter;
  });

  const currentLessonNotes = notes.filter((n) => n.lessonId === currentLessonId);

  if (isCreating || editingNote) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {editingNote ? "Editar nota" : "Nova nota"}
          </h3>
          <button
            onClick={closeEditor}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Título (opcional - se vazio, será gerado automaticamente)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
          />

          <textarea
            placeholder="Escreve aqui as tuas notas..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={12}
            maxLength={50000}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
          />

          <div className="flex items-center gap-2">
            <Button onClick={saveNote} disabled={saving}>
              <Save size={14} className="mr-1.5" />
              {saving ? "A guardar..." : "Guardar"}
            </Button>
            <button
              onClick={closeEditor}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Procurar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterCurrentLesson(!filterCurrentLesson)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              filterCurrentLesson
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            <Filter size={14} />
            Só desta aula
          </button>
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 sm:text-sm"
          >
            <Plus size={14} />
            Adicionar
          </button>
        </div>
      </div>

      {!filterCurrentLesson && currentLessonNotes.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-900/50 dark:bg-blue-900/20">
          <p className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
            <BookOpen size={13} />
            {currentLessonNotes.length} nota{currentLessonNotes.length !== 1 ? "s" : ""} desta aula
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">A carregar notas...</p>
      ) : filteredNotes.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {searchQuery
            ? "Nenhuma nota encontrada com esse termo."
            : filterCurrentLesson
              ? "Ainda não tens notas para esta aula."
              : "Ainda não tens notas para este curso."}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => {
            const isFromCurrentLesson = note.lessonId === currentLessonId;
            return (
              <div
                key={note.id}
                className={`group relative flex items-start gap-4 rounded-lg border bg-white p-4 hover:shadow-md dark:bg-white/5 ${
                  isFromCurrentLesson
                    ? "border-blue-300 ring-2 ring-blue-100 dark:border-blue-700 dark:ring-blue-900/50"
                    : "border-slate-200 dark:border-white/10"
                }`}
              >
                {isFromCurrentLesson && (
                  <div className="absolute right-3 top-3 rounded bg-blue-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    Aula atual
                  </div>
                )}
                
                {/* Coluna esquerda - Ícone */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10">
                  <BookOpen size={24} className="text-slate-600 dark:text-slate-300" />
                </div>

                {/* Coluna central - Conteúdo */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h4 className="line-clamp-1 pr-20 text-base font-semibold text-slate-900 dark:text-white">
                      {note.title}
                    </h4>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">
                        {note.lesson.module.title} → {note.lesson.title}
                      </span>
                    </p>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{note.content}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Editada {new Date(note.updatedAt).toLocaleDateString("pt-PT", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Coluna direita - Ações */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => openEditor(note)}
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Edit size={14} />
                    Editar
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
