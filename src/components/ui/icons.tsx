/**
 * Shared attendance icons.
 *
 * Check-in and check-out used to be a bare up arrow and down arrow, repeated
 * verbatim in sixteen places. Up/down reads as "more/less", not "arrived/left";
 * the door-with-arrow pair is the metaphor people already know from sign-in and
 * sign-out buttons, and it says direction rather than magnitude.
 */

interface IconProps {
  size?: number;
  className?: string;
  /** Defaults to the surrounding text colour. */
  stroke?: string;
}

function base({ size = 16, className, stroke = "currentColor" }: IconProps) {
  return {
    "aria-hidden": true,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

/** Arrow entering a doorway. */
export function CheckInIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

/** Arrow leaving a doorway. */
export function CheckOutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** Picks the right icon from a log action or job kind. */
export function AttendanceIcon({
  action,
  ...props
}: IconProps & { action: "CHECK_IN" | "CHECK_OUT" | "checkin" | "checkout" | "IN" | "OUT" }) {
  const isIn = action === "CHECK_IN" || action === "checkin" || action === "IN";
  return isIn ? <CheckInIcon {...props} /> : <CheckOutIcon {...props} />;
}

/**
 * Ending your session, which is a different act from recording a departure —
 * the header used the same door icon that now means check-out.
 */
export function PowerIcon(props: IconProps) {
  return (
    <svg {...base({ ...props, size: props.size ?? 16 })}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

/** Circular tinted backdrop the attendance icons sit in inside tables and cards. */
export function AttendanceBadge({
  action,
  size = 32,
  iconSize = 14,
  muted = false,
}: {
  action: "CHECK_IN" | "CHECK_OUT" | "checkin" | "checkout" | "IN" | "OUT";
  size?: number;
  iconSize?: number;
  muted?: boolean;
}) {
  const isIn = action === "CHECK_IN" || action === "checkin" || action === "IN";
  const tint = muted ? "bg-muted/10" : isIn ? "bg-success/10" : "bg-danger/10";
  const stroke = muted ? "var(--muted)" : isIn ? "var(--success)" : "var(--danger)";

  return (
    <span
      className={`rounded-lg flex items-center justify-center shrink-0 ${tint}`}
      style={{ width: size, height: size }}
    >
      <AttendanceIcon action={action} size={iconSize} stroke={stroke} />
    </span>
  );
}
