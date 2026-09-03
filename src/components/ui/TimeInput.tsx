"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClockIcon } from "@/components/ui/icons";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
}

type Mode = "hour" | "minute";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 430;
const VIEW_PAD = 12;
const GAP = 6;

function parseValue(value: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return { hour12: 9, minute: 0, isPM: false, hasValue: false };
  }
  const [hStr, mStr] = value.split(":");
  const hour24 = parseInt(hStr, 10);
  const minuteRaw = parseInt(mStr, 10);
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const minute = Number.isNaN(minuteRaw)
    ? 0
    : Math.min(55, Math.round(minuteRaw / 5) * 5);
  return { hour12, minute, isPM, hasValue: true };
}

function toValue(hour12: number, minute: number, isPM: boolean) {
  let hour24 = hour12;
  if (isPM && hour12 !== 12) hour24 = hour12 + 12;
  if (!isPM && hour12 === 12) hour24 = 0;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Angle in degrees from 12 o'clock, clockwise. */
function angleFromPointer(clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function hourFromAngle(deg: number) {
  const idx = Math.round(deg / 30) % 12;
  return HOURS[idx];
}

function minuteFromAngle(deg: number) {
  const idx = Math.round(deg / 30) % 12;
  return MINUTES[idx];
}

function dialPoint(index: number, radius: number) {
  const angle = ((index * 30 - 90) * Math.PI) / 180;
  return {
    x: 120 + radius * Math.cos(angle),
    y: 120 + radius * Math.sin(angle),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function positionPanel(anchor: DOMRect, panelHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, vw - VIEW_PAD * 2);
  const height = Math.min(panelHeight || PANEL_HEIGHT, vh - VIEW_PAD * 2);

  const spaceBelow = vh - anchor.bottom - VIEW_PAD;
  const spaceAbove = anchor.top - VIEW_PAD;
  const placeAbove = spaceBelow < height && spaceAbove > spaceBelow;

  let top = placeAbove ? anchor.top - GAP - height : anchor.bottom + GAP;
  let left = anchor.left;

  // Prefer aligning to the trigger; flip/clamp if it would overflow horizontally.
  if (left + width > vw - VIEW_PAD) left = anchor.right - width;
  left = clamp(left, VIEW_PAD, vw - VIEW_PAD - width);
  top = clamp(top, VIEW_PAD, vh - VIEW_PAD - height);

  return { top, left, width };
}

export default function TimeInput({ value, onChange, onFocus, onClear }: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("hour");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const snapshot = useRef(value);

  const parsed = parseValue(value);
  const hour12 = parsed.hour12;
  const minute = parsed.minute;
  const isPM = parsed.isPM;
  const hasValue = parsed.hasValue;

  const commit = useCallback(
    (nextHour: number, nextMin: number, nextPM: boolean) => {
      onChange(toValue(nextHour, nextMin, nextPM));
    },
    [onChange]
  );

  const updatePosition = useCallback(() => {
    const anchor = rootRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const measured = panelRef.current?.offsetHeight ?? PANEL_HEIGHT;
    setCoords(positionPanel(anchor, measured));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    // Remeasure after paint so height clamp uses the real panel size.
    const id = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    // Capture scroll from nested dashboard panels too.
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  function handleOpen() {
    if (!open) {
      snapshot.current = value;
      onFocus?.();
      if (!hasValue) commit(9, 0, false);
      setMode("hour");
    }
    setOpen(true);
  }

  function handleCancel() {
    onChange(snapshot.current);
    setOpen(false);
  }

  function applyFromEvent(clientX: number, clientY: number, advance: boolean) {
    const el = dialRef.current;
    if (!el) return;
    const deg = angleFromPointer(clientX, clientY, el.getBoundingClientRect());
    if (mode === "hour") {
      const h = hourFromAngle(deg);
      commit(h, minute, isPM);
      if (advance) setMode("minute");
    } else {
      commit(hour12, minuteFromAngle(deg), isPM);
    }
  }

  function onDialPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    applyFromEvent(e.clientX, e.clientY, false);
  }

  function onDialPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    applyFromEvent(e.clientX, e.clientY, false);
  }

  function onDialPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    applyFromEvent(e.clientX, e.clientY, mode === "hour");
  }

  const selectedIndex = mode === "hour" ? HOURS.indexOf(hour12) : MINUTES.indexOf(minute);
  const hand = dialPoint(selectedIndex < 0 ? 0 : selectedIndex, 78);
  const labels = mode === "hour" ? HOURS : MINUTES.map((m) => String(m).padStart(2, "0"));

  function formatDisplay() {
    if (!hasValue) return "";
    return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full px-3.5 py-3 border rounded-xl text-sm font-medium text-left transition-all flex items-center gap-2 bg-input ${
          open
            ? "border-primary ring-2 ring-primary/20 shadow-sm"
            : "border-border hover:border-primary/40"
        } ${hasValue ? "text-foreground" : "text-muted"} ${onClear && hasValue ? "pr-9" : ""}`}
      >
        <ClockIcon size={14} className="shrink-0 opacity-50" />
        <span className="font-mono tabular-nums tracking-wide">
          {formatDisplay() || "Select time"}
        </span>
      </button>

      {hasValue && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
            setOpen(false);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-white hover:bg-danger/80 transition-colors text-xs z-10"
          aria-label="Clear"
        >
          &#x2715;
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleCancel} />
          <div
            ref={panelRef}
            style={
              coords
                ? { top: coords.top, left: coords.left, width: coords.width }
                : { top: -9999, left: -9999, width: PANEL_WIDTH, visibility: "hidden" }
            }
            className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto bg-card border border-border rounded-2xl shadow-[var(--shadow)] p-4 animate-[scaleIn_100ms_ease-out]"
          >
            <p className="text-xs font-medium text-muted mb-3">Select time</p>

            <div className="flex items-stretch gap-3 mb-4">
              <div className="flex flex-1 items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setMode("hour")}
                  className={`flex-1 py-3 rounded-xl text-center font-mono text-3xl font-semibold tabular-nums tracking-tight transition-colors ${
                    mode === "hour"
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "bg-input text-foreground hover:bg-primary/10"
                  }`}
                >
                  {String(hour12).padStart(2, "0")}
                </button>
                <span className="text-3xl font-semibold text-muted pb-0.5">:</span>
                <button
                  type="button"
                  onClick={() => setMode("minute")}
                  className={`flex-1 py-3 rounded-xl text-center font-mono text-3xl font-semibold tabular-nums tracking-tight transition-colors ${
                    mode === "minute"
                      ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                      : "bg-input text-foreground hover:bg-primary/10"
                  }`}
                >
                  {String(minute).padStart(2, "0")}
                </button>
              </div>

              <div className="flex flex-col w-14 rounded-xl border border-border overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => commit(hour12, minute, false)}
                  className={`flex-1 text-xs font-bold tracking-wide transition-colors ${
                    !isPM
                      ? "bg-primary/20 text-primary"
                      : "bg-input text-muted hover:text-foreground hover:bg-primary/10"
                  }`}
                >
                  AM
                </button>
                <div className="h-px bg-border" />
                <button
                  type="button"
                  onClick={() => commit(hour12, minute, true)}
                  className={`flex-1 text-xs font-bold tracking-wide transition-colors ${
                    isPM
                      ? "bg-primary/20 text-primary"
                      : "bg-input text-muted hover:text-foreground hover:bg-primary/10"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            <div className="rounded-full bg-input/80 p-2">
              <svg
                ref={dialRef}
                viewBox="0 0 240 240"
                className="w-full touch-none select-none cursor-pointer"
                onPointerDown={onDialPointerDown}
                onPointerMove={onDialPointerMove}
                onPointerUp={onDialPointerUp}
                onPointerCancel={() => {
                  dragging.current = false;
                }}
              >
                <circle cx="120" cy="120" r="112" fill="transparent" />

                <line
                  x1="120"
                  y1="120"
                  x2={hand.x}
                  y2={hand.y}
                  stroke="var(--primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="120" cy="120" r="5" fill="var(--primary)" />
                <circle cx={hand.x} cy={hand.y} r="22" fill="var(--primary)" />

                {labels.map((label, i) => {
                  const p = dialPoint(i, 78);
                  const selected = i === selectedIndex;
                  return (
                    <text
                      key={`${mode}-${label}`}
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="pointer-events-none"
                      fill={selected ? "#fff" : "var(--foreground)"}
                      fontSize={mode === "minute" ? 13 : 15}
                      fontWeight={selected ? 600 : 500}
                      fontFamily="var(--font-sans), ui-sans-serif, sans-serif"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div className="flex justify-end gap-1 mt-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground rounded-lg hover:bg-background transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
