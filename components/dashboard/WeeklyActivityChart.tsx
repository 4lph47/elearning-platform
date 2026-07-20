const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function WeeklyActivityChart({ data }: { data: { date: Date; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div>
      <div className="flex h-28 items-end gap-2.5">
        {data.map((d, i) => {
          const heightPercent = (d.count / max) * 100;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-sm bg-[#3987e5] transition-all"
                  style={{ height: d.count > 0 ? `${Math.max(6, heightPercent)}%` : "2px" }}
                  title={`${d.count} aula${d.count !== 1 ? "s" : ""} concluída${d.count !== 1 ? "s" : ""}`}
                />
              </div>
              <span className="text-[10px] text-slate-500">{DAY_LABELS[d.date.getDay()]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
