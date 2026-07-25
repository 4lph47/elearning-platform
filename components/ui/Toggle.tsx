export function Toggle({
  checked,
  onChange,
  label,
  id,
  labelPosition = "right",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  id?: string;
  labelPosition?: "left" | "right";
}) {
  const switchButton = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (labelPosition === "left") {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300"
      >
        {label}
        {switchButton}
      </label>
    );
  }

  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      {switchButton}
      {label}
    </label>
  );
}
