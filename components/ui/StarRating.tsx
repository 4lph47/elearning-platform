function Star({ fill }: { fill: number }) {
  return (
    <span className="relative inline-block h-4 w-4 text-slate-200">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6z" />
      </svg>
      <span className="absolute inset-0 overflow-hidden text-slate-800" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6z" />
        </svg>
      </span>
    </span>
  );
}

export function StarRating({
  rating,
  count,
  size = "sm",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const stars = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, rating - i)));

  return (
    <div className={`flex items-center gap-1.5 ${size === "md" ? "text-base" : "text-sm"}`}>
      <span className="font-semibold text-slate-800">{rating.toFixed(1)}</span>
      <span className="flex items-center gap-0.5">
        {stars.map((fill, i) => (
          <Star key={i} fill={fill} />
        ))}
      </span>
      {typeof count === "number" && <span className="text-slate-400">({count.toLocaleString("pt-PT")})</span>}
    </div>
  );
}
