export default function BrandMark({ size = 32 }: { size?: number }) {
  const icon = Math.round(size * 0.56);
  return (
    <div
      className="rounded-xl flex items-center justify-center bg-primary/15 ring-1 ring-primary/20"
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    </div>
  );
}
