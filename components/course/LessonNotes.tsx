"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Plus, Edit, Trash2, X, Save, Filter } from "lucide-react";

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
  const searchBarRef = useRef<HTMLDivElement>(null);

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

  function handleSearchFocus() {
    // Scroll suave para o searchbar quando focado (mobile)
    if (searchBarRef.current && window.innerWidth < 768) {
      setTimeout(() => {
        searchBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.lesson.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = !filterCurrentLesson || n.lessonId === currentLessonId;
    
    return matchesSearch && matchesFilter;
  });

  // Modo de edição/criação em tela cheia no mobile
  if (isCreating || editingNote) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-neutral-900 md:static md:z-auto md:block md:bg-transparent">
        {/* Header - apenas mobile */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-900 md:hidden">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {editingNote ? "Editar nota" : "Nova nota"}
          </h3>
          <button
            onClick={closeEditor}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Header - apenas desktop */}
        <div className="hidden items-center justify-between pb-3 md:flex">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {editingNote ? "Editar nota" : "Nova nota"}
          </h3>
          <button
            onClick={closeEditor}
            className="flex h-auto w-auto items-center justify-center rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="mx-4 mt-3 shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 md:mx-0 md:mt-0 md:mb-3">
            {error}
          </div>
        )}

        {/* Conteúdo - mobile: flex-1 para ocupar espaço, desktop: auto */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:flex-none md:space-y-3 md:p-0">
          {/* Input de título */}
          <input
            type="text"
            placeholder="Título (opcional)"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            maxLength={200}
            className="w-full shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 md:rounded-lg md:px-3 md:py-2"
          />

          {/* Textarea - mobile: flex-1, desktop: altura fixa maior */}
          <textarea
            placeholder="Escreve aqui as tuas notas..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            maxLength={50000}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 flex-1 min-h-0 md:flex-none md:h-80 md:rounded-lg md:px-3 md:py-2"
          />

          {/* Botões de ação */}
          <div className="flex shrink-0 items-center gap-2 pt-1 md:pt-0">
            <button
              onClick={saveNote}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 md:flex-none md:gap-1.5 md:rounded-full md:px-4 md:py-2"
            >
              <Save size={16} className="md:h-3.5 md:w-3.5" />
              {saving ? "A guardar..." : "Guardar"}
            </button>
            <button
              onClick={closeEditor}
              className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 md:flex-none md:rounded-full md:bg-transparent md:hover:bg-slate-100 md:dark:hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 min-w-0">
      {/* Botão de adicionar no topo */}
      <div className="flex justify-end">
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>

      {/* Searchbar e filtro */}
      <div ref={searchBarRef} className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Procurar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleSearchFocus}
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/10"
          />
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          onClick={() => setFilterCurrentLesson(!filterCurrentLesson)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
            filterCurrentLesson
              ? "bg-blue-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
        >
          <Filter size={16} />
          Desta aula
        </button>
      </div>

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
        <div className="space-y-2 min-w-0">
          {filteredNotes.map((note) => {
            const isFromCurrentLesson = note.lessonId === currentLessonId;
            return (
              <div
                key={note.id}
                onClick={() => openEditor(note)}
                className={`group relative cursor-pointer rounded-xl border bg-white p-3 transition-all hover:shadow-md dark:bg-white/5 overflow-hidden min-w-0 ${
                  isFromCurrentLesson
                    ? "border-blue-200 dark:border-blue-800/50"
                    : "border-slate-200 dark:border-white/10"
                }`}
              >
                {isFromCurrentLesson && (
                  <div className="absolute right-2 top-2 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white z-10">
                    Atual
                  </div>
                )}
                
                <div className="space-y-1.5 min-w-0 w-full">
                  <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white pr-16 min-w-0">
                    {note.title}
                  </h4>
                  <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300 break-words overflow-hidden pr-16 min-w-0 overflow-wrap-anywhere">
                    {note.content}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pr-16 min-w-0">
                    {new Date(note.updatedAt).toLocaleDateString("pt-PT", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="absolute bottom-3 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor(note);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Editar"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/10"
                    aria-label="Remover"
                  >
                    <Trash2 size={12} />
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
