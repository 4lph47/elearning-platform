export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export type BadgeTone = "default" | "success" | "warning" | "info" | "danger";

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: BadgeTone }) {
  const toneClasses: Record<BadgeTone, string> = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-slate-800 text-white",
    warning: "border border-slate-300 text-slate-600",
    info: "bg-slate-200 text-slate-700",
    danger: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
