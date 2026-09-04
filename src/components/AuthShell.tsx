import BrandMark from "@/components/BrandMark";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  /** Page action / intent — sits under the brand, not above it. */
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <PullToRefresh className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex items-center justify-center p-4">
      <div className="w-full max-w-sm 2xl:max-w-md animate-[slideUp_320ms_ease-out]">
        <div className="flex flex-col items-center mb-7 text-center animate-[brandIn_420ms_ease-out]">
          <div className="relative mb-5">
            <div
              className="absolute -inset-5 rounded-full bg-primary/10 blur-2xl animate-[pulseSoft_4.5s_ease-in-out_infinite]"
              aria-hidden="true"
            />
            <BrandMark size={56} className="relative brand-3d" />
          </div>
          <p className="font-display text-[1.65rem] leading-tight tracking-[-0.02em] text-foreground">
            ShiftSync
          </p>
          <p className="text-sm text-muted mt-1.5 max-w-[20rem]">
            Check in/out
          </p>
        </div>

        <div className="auth-card-3d border border-border/90 rounded-[1.25rem] p-6 backdrop-blur-md">
          <div className="mb-5">
            <h1 className="text-base font-semibold tracking-tight">{title}</h1>
            <div className="text-sm text-muted mt-1">{subtitle}</div>
          </div>
          {children}
        </div>
        {footer}
      </div>
    </PullToRefresh>
  );
}
