"use client";

import { useRef, useState } from "react";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DateInput({ value, onChange, min }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = value ? new Date(value + "T00:00") : null;
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());

  const minDate = min ? new Date(min + "T00:00") : null;

  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

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
    const date = new Date(viewYear, viewMonth, day);
    return date < minDate;
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

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-3.5 py-3 border rounded-xl text-sm font-medium text-left transition-colors ${
          open
            ? "border-primary ring-2 ring-primary/30"
            : "border-border hover:border-primary/40"
        } ${value ? "text-foreground" : "text-muted"}`}
      >
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {formatDisplay() || "Select date"}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-lg p-4 w-[280px] animate-[scaleIn_100ms_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-sm font-semibold">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <span key={d} className="text-center text-[10px] uppercase tracking-wider text-muted py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Days grid */}
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

            {/* Today shortcut */}
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
        </>
      )}
    </div>
  );
}
