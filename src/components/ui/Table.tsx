/**
 * Table primitives.
 *
 * Every list in this app was a stack of flex rows, which meant nothing lined
 * up column to column and the reader had to re-find each value on every row.
 * These wrap the markup the admin users table already established so the rest
 * of the app can match it without eight copies of the same class strings.
 */

interface TableProps {
  children: React.ReactNode;
  /** Describes the table for screen readers when no visible caption fits. */
  label: string;
}

/**
 * Horizontal scroll is deliberate: a real table beats a reflowed card stack for
 * scanning, and on a narrow screen scrolling one container is better than
 * cramming six columns into 360px.
 */
export function Table({ children, label }: TableProps) {
  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <table className="w-full min-w-0" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-background border-b border-border">
      <tr>{children}</tr>
    </thead>
  );
}

// Spelled out, not interpolated: Tailwind scans source text, so a computed
// `text-${align}` would never be generated.
const ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: keyof typeof ALIGN;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 ${ALIGN[align]} text-xs font-semibold text-muted whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({
  children,
  muted = false,
  className = "",
}: {
  children: React.ReactNode;
  /** Dims rows that are historical rather than actionable. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={`hover:bg-background/50 transition-colors group ${muted ? "opacity-60" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-sm align-middle ${className}`}>{children}</td>;
}

/** Full-width message for a table with no rows. */
export function TableEmpty({
  colSpan,
  icon,
  message,
}: {
  colSpan: number;
  icon?: React.ReactNode;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center">
        {icon && (
          <div className="w-10 h-10 bg-muted/10 rounded-full flex items-center justify-center mx-auto mb-2">
            {icon}
          </div>
        )}
        <p className="text-sm text-muted">{message}</p>
      </td>
    </tr>
  );
}

/** Centred spinner sized to sit inside a table body. */
export function TableLoading({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="sr-only">Loading</span>
        </div>
      </td>
    </tr>
  );
}

/** Card shell with a heading row, matching the existing list panels. */
export function TableCard({
  title,
  subtitle,
  actions,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex flex-col gap-2 px-5 py-3.5 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:justify-end">
          {count !== undefined && <span className="text-xs text-muted">{count}</span>}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
