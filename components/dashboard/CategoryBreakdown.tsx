// Ordem validada (skill dataviz): maximiza a distância de cor entre vizinhos,
// incluindo para daltonismo — não trocar a ordem sem revalidar.
const SLOT_COLORS = ["#3987e5", "#008300", "#d55181", "#c98500"];

export function CategoryBreakdown({ data }: { data: { category: string; count: number }[] }) {
  const top = data.slice(0, 4);
  const rest = data.slice(4);
  const restCount = rest.reduce((sum, d) => sum + d.count, 0);
  const rows = restCount > 0 ? [...top, { category: "Outros", count: restCount }] : top;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <ul className="space-y-2.5">
      {rows.map((row, i) => (
        <li key={row.category} className="flex items-center gap-2.5 text-xs">
          <span className="w-24 shrink-0 truncate text-slate-400">{row.category}</span>
          <div className="h-2 flex-1 rounded-full bg-white/5">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(row.count / max) * 100}%`,
                backgroundColor: i < SLOT_COLORS.length ? SLOT_COLORS[i] : "#6b7280",
              }}
            />
          </div>
          <span className="w-4 shrink-0 text-right font-medium text-slate-300">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}
