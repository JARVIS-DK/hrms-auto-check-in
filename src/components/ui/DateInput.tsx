"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 320;
const VIEW_PAD = 12;
const GAP = 6;
const CLOSE_EVENT = "shiftsync:close-pickers";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function positionPanel(anchor: DOMRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, vw - VIEW_PAD * 2);
  const height = Math.min(PANEL_HEIGHT, vh - VIEW_PAD * 2);

  const spaceBelow = vh - anchor.bottom - VIEW_PAD;
  const spaceAbove = anchor.top - VIEW_PAD;
  const placeAbove = spaceBelow < height && spaceAbove > spaceBelow;

  let top = placeAbove ? anchor.top - GAP - height : anchor.bottom + GAP;
  let left = anchor.left;

  if (left + width > vw - VIEW_PAD) left = anchor.right - width;
  left = clamp(left, VIEW_PAD, vw - VIEW_PAD - width);
  top = clamp(top, VIEW_PAD, vh - VIEW_PAD - height);

  return { top, left, width };
}

export default function DateInput({ value, onChange, min }: DateInputProps) {
  const pickerId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = value ? new Date(value + "T00:00") : null;
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());

  const minDate = min ? new Date(min + "T00:00") : null;

  const updatePosition = useCallback(() => {
    const anchor = rootRef.current?.getBoundingClientRect();
    if (!anchor) return;
    setCoords(positionPanel(anchor));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, viewMonth, viewYear]);

  useEffect(() => {
    if (!open) return;

    const onCloseOthers = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== pickerId) setOpen(false);
    };
    window.addEventListener(CLOSE_EVENT, onCloseOthers);
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: pickerId }));

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Capture so we close even if something underneath stops propagation.
    document.addEventListener("pointerdown", onPointerDown, true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener(CLOSE_EVENT, onCloseOthers);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, pickerId, updatePosition]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function selectDate(day: number) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  }

  function isDisabled(day: number) {
    if (!minDate) return false;
    return new Date(viewYear, viewMonth, day) < minDate;
  }

  function isSelected(day: number) {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getFullYear() === viewYear
    );
  }

  function isToday(day: number) {
    return (
      today.getDate() === day &&
      today.getMonth() === viewMonth &&
      today.getFullYear() === viewYear
    );
  }

  function formatDisplay() {
    if (!value || !selectedDate) return "";
    return selectedDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const panel =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-[70] bg-black/20"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              data-portal="date-backdrop"
            />
            <div
              ref={panelRef}
              data-portal="date-picker"
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 80,
                pointerEvents: "auto",
              }}
              className="surface-elevated rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Previous month"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
                >
                  <ChevronLeftIcon size={14} strokeWidth={2.5} />
                </button>
                <span className="text-sm font-semibold">
                  {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
                >
                  <ChevronRightIcon size={14} strokeWidth={2.5} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {DAYS.map((d) => (
                  <span
                    key={d}
                    className="text-center text-[10px] uppercase tracking-wider text-muted py-1"
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <span key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const disabled = isDisabled(day);
                  const selected = isSelected(day);
                  const todayMark = isToday(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !disabled && selectDate(day)}
                      disabled={disabled}
                      className={`w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-xs transition-colors ${
                        selected
                          ? "bg-primary text-white font-semibold"
                          : todayMark
                            ? "bg-primary/10 text-primary font-semibold"
                            : disabled
                              ? "text-muted/40 cursor-not-allowed"
                              : "hover:bg-background text-foreground"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end mt-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    const m = String(today.getMonth() + 1).padStart(2, "0");
                    const d = String(today.getDate()).padStart(2, "0");
                    onChange(`${today.getFullYear()}-${m}-${d}`);
                    setOpen(false);
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Today
                </button>
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3.5 py-3 border rounded-xl text-sm font-medium text-left transition-colors bg-input ${
          open
            ? "border-primary ring-2 ring-primary/30"
            : "border-border hover:border-primary/40"
        } ${value ? "text-foreground" : "text-muted"}`}
      >
        <span className="flex items-center gap-2">
          <CalendarIcon size={14} className="shrink-0 text-muted" />
          {formatDisplay() || "Select date"}
        </span>
      </button>
      {panel}
    </div>
  );
}
