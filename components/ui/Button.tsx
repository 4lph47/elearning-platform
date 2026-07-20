import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "light" | "accent" | "outline-dark";

const variantClasses: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-700",
  secondary: "bg-slate-700 text-white hover:bg-slate-600",
  outline: "border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-700",
  light: "bg-white text-slate-900 shadow-md hover:bg-slate-100",
  accent: "bg-blue-600 text-white hover:bg-blue-500",
  "outline-dark": "border border-slate-900/25 text-slate-900 hover:bg-slate-900/10 dark:border-white/25 dark:text-white dark:hover:bg-white/10",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
