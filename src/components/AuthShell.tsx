import BrandMark from "@/components/BrandMark";

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-none flex items-center justify-center p-4">
      <div className="w-full max-w-sm 2xl:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <BrandMark size={48} />
          <h1 className="text-xl font-semibold tracking-tight mt-4">{title}</h1>
          <p className="text-sm text-muted mt-1 text-center">{subtitle}</p>
        </div>
        <div className="bg-card/80 border border-border rounded-2xl p-6 shadow-[var(--shadow)] backdrop-blur-sm">
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
