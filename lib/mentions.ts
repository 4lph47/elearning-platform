// Formato inline do token de menção dentro do content de um comentário:
// "@[Nome Completo](userId)" — mesma ideia do link markdown, só que o
// "texto" é o nome a mostrar e o "href" é o id do utilizador. Escrito pelo
// MentionInput ao escolher uma sugestão, nunca digitado à mão pelo autor.
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

export function extractMentionIds(content: string): string[] {
  const ids = new Set<string>();
  Array.from(content.matchAll(MENTION_TOKEN_RE)).forEach((m) => ids.add(m[2]));
  return Array.from(ids);
}

// Content em bruto ("@[Nome](id) resto") -> texto editável ("@Nome resto")
// + a lista de menções na ordem em que aparecem — usado para pré-preencher
// a caixa de edição de um comentário já existente, incluindo re-semear o
// mapeamento nome→id do MentionInput (ver seedMentions).
export function decodeMentionContent(content: string): { display: string; mentions: { name: string; id: string }[] } {
  const parts = splitMentionContent(content);
  const mentions: { name: string; id: string }[] = [];
  const display = parts
    .map((p) => {
      if (p.type === "mention") {
        mentions.push({ name: p.name, id: p.userId });
        return `@${p.name}`;
      }
      return p.text;
    })
    .join("");
  return { display, mentions };
}

export type ContentPart = { type: "text"; text: string } | { type: "mention"; name: string; userId: string };

export function splitMentionContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  let lastIndex = 0;
  Array.from(content.matchAll(MENTION_TOKEN_RE)).forEach((m) => {
    const idx = m.index ?? 0;
    if (idx > lastIndex) parts.push({ type: "text", text: content.slice(lastIndex, idx) });
    parts.push({ type: "mention", name: m[1], userId: m[2] });
    lastIndex = idx + m[0].length;
  });
  if (lastIndex < content.length) parts.push({ type: "text", text: content.slice(lastIndex) });
  return parts;
}
