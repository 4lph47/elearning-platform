function Star({ fill, tone }: { fill: number; tone: "auto" | "dark" }) {
  return (
    <span
      className={`relative inline-block h-4 w-4 ${
        tone === "dark" ? "text-slate-600" : "text-slate-200 dark:text-slate-600"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6z" />
      </svg>
      <span
        className={`absolute inset-0 overflow-hidden ${tone === "dark" ? "text-white" : "text-slate-800 dark:text-white"}`}
        style={{ width: `${fill * 100}%` }}
      >
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
  tone = "auto",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  tone?: "auto" | "dark";
}) {
  const stars = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, rating - i)));

  return (
    <div className={`flex items-center gap-1.5 ${size === "md" ? "text-base" : "text-sm"}`}>
      <span className={`font-semibold ${tone === "dark" ? "text-white" : "text-slate-800 dark:text-white"}`}>
        {rating.toFixed(1)}
      </span>
      <span className="flex items-center gap-0.5">
        {stars.map((fill, i) => (
          <Star key={i} fill={fill} tone={tone} />
        ))}
      </span>
      {typeof count === "number" && (
        <span className={tone === "dark" ? "text-slate-500" : "text-slate-400 dark:text-slate-500"}>
          ({count.toLocaleString("pt-PT")})
        </span>
      )}
    </div>
  );
}
