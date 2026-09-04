"use client";

import { useId } from "react";

/**
 * App mark: a filled tile with a clock dial and a check — “on-time attendance”.
 * Drawn as one SVG so it stays sharp from favicon size up to the auth hero.
 */
export default function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={`shrink-0 drop-shadow-[0_8px_18px_rgba(77,176,255,0.35)] ${className}`}
    >
      <defs>
        <linearGradient id={`${uid}-tile`} x1="8" y1="4" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6bc0ff" />
          <stop offset="0.55" stopColor="#4db0ff" />
          <stop offset="1" stopColor="#12e87a" />
        </linearGradient>
        <linearGradient id={`${uid}-face`} x1="12" y1="10" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="12" fill={`url(#${uid}-tile)`} />

      <rect
        x="1.25"
        y="1.25"
        width="37.5"
        height="37.5"
        rx="10.75"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
      />

      <circle cx="20" cy="19.5" r="11.25" fill={`url(#${uid}-face)`} />
      <circle
        cx="20"
        cy="19.5"
        r="11.25"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.75"
      />

      <g stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M20 10.4v2.1" />
        <path d="M20 26.5v2.1" />
        <path d="M11.15 19.5h2.1" />
        <path d="M26.75 19.5h2.1" />
      </g>

      <g stroke="#fff" strokeWidth="1.85" strokeLinecap="round">
        <path d="M20 19.5V13.6" />
        <path d="M20 19.5l5.1 2.2" />
      </g>
      <circle cx="20" cy="19.5" r="1.55" fill="#fff" />

      <circle cx="29.2" cy="29.2" r="6.4" fill="#0a1620" />
      <circle cx="29.2" cy="29.2" r="5.35" fill="#12e87a" />
      <path
        d="M26.55 29.25l1.7 1.7 3.55-3.7"
        fill="none"
        stroke="#04140f"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
