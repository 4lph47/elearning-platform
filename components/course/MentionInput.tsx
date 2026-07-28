"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface MentionInputHandle {
  encode: () => string;
  focus: () => void;
}

interface MentionUser {
  id: string;
  name: string;
  username: string;
  image: string | null;
}

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

function detectTrigger(text: string, caret: number): { start: number; query: string } | null {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (/\s/.test(query)) return null;
  return { start: at, query };
}

export const MentionInput = forwardRef<
  MentionInputHandle,
  {
    mentionUrl: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className: string;
    autoFocus?: boolean;
    seedMentions?: { tag: string; id: string }[];
    onKeyDownCapture?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  }
>(function MentionInput(
  { mentionUrl, value, onChange, placeholder, className, autoFocus, seedMentions, onKeyDownCapture },
  ref
) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [triggerStart, setTriggerStart] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionQueueRef = useRef<{ tag: string; id: string }[]>(seedMentions ? [...seedMentions] : []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    if (value === "") mentionQueueRef.current = [];
  }, [value]);

  useEffect(() => {
    if (suggestions.length === 0) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setTriggerStart(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [suggestions.length]);

  useImperativeHandle(ref, () => ({
    encode() {
      let result = value;
      for (const m of mentionQueueRef.current) {
        const token = `@${m.tag}`;
        const idx = result.indexOf(token);
        if (idx === -1) continue;
        result = result.slice(0, idx) + `@[${m.tag}](${m.id})` + result.slice(idx + token.length);
      }
      return result;
    },
    focus() {
      inputRef.current?.focus();
    },
  }));

  function scheduleSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`${mentionUrl}?q=${encodeURIComponent(query)}`);
      if (res.ok && seq === searchSeqRef.current) {
        const data = await res.json();
        setSuggestions(data.users);
        setActiveIndex(0);
      }
    }, 50);
  }

  function syncTrigger(v: string, caret: number) {
    const trig = detectTrigger(v, caret);
    if (trig) {
      setTriggerStart(trig.start);
      scheduleSearch(trig.query);
    } else {
      setTriggerStart(null);
      setSuggestions([]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    syncTrigger(v, e.target.selectionStart ?? v.length);
  }

  function handleSelect(e: React.SyntheticEvent<HTMLInputElement>) {
    const caret = e.currentTarget.selectionStart ?? value.length;
    syncTrigger(value, caret);
  }

  function pick(user: MentionUser) {
    if (triggerStart === null) return;
    const caret = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, triggerStart);
    const after = value.slice(caret);
    const inserted = `@${user.username} `;
    mentionQueueRef.current.push({ tag: user.username, id: user.id });
    onChange(before + inserted + after);
    setSuggestions([]);
    setTriggerStart(null);
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setSuggestions([]);
        return;
      }
    }
    onKeyDownCapture?.(e);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setSuggestions([]);
          setTriggerStart(null);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
      />
      {suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 max-w-[80vw] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(u);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                i === activeIndex ? "bg-slate-100 dark:bg-white/10" : ""
              }`}
            >
              {u.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {initials(u.name)}
                </span>
              )}
              <span className="min-w-0 truncate">
                <span className="text-slate-800 dark:text-slate-100">{u.name}</span>{" "}
                <span className="text-slate-400 dark:text-slate-500">@{u.username}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
