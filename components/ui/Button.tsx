import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "light" | "accent" | "outline-dark" | "premium";

const variantClasses: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "bg-slate-700 text-white hover:bg-slate-600",
  outline: "border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-700",
  light: "bg-white text-slate-900 shadow-md hover:bg-slate-100",
  // Cor de destaque escolhida em Definições > Aparência (--accent, default
  // blue-600) — ver app/globals.css e components/layout/AppearanceEffects.
  accent: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
  "outline-dark": "border border-slate-900/25 text-slate-900 hover:bg-slate-900/10 dark:border-white/25 dark:text-white dark:hover:bg-white/10",
  premium: "bg-[var(--accent)] text-white shadow-md shadow-blue-600/30 hover:bg-[var(--accent-hover)] active:scale-95",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", type = "button", ...props }, ref) => {
    // Nativo defaulta pra "submit" sem isto — qualquer <Button> dentro dum
    // <form> sem type explícito submetia-o sozinho ao ser clicado. Quem
    // precisa mesmo de submeter (ex.: "Guardar") já passa type="submit"
    // explicitamente.
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
