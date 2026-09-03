import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "success";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]",
  ghost: "border border-border text-foreground hover:bg-white/[0.04]",
  danger: "bg-danger text-white hover:brightness-110",
  success: "bg-success text-[#04140f] hover:brightness-105 font-semibold",
};

const BASE =
  "inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:pointer-events-none";

export function buttonClass(variant: Variant = "primary", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${className}`.trim();
}

export default function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button className={buttonClass(variant, className)} disabled={props.disabled || loading} {...props}>
      {loading && (
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
}
