"use client";

import { useRef, useState } from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

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

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-[var(--shadow)] p-4 w-[280px] animate-[scaleIn_100ms_ease-out]">
            {/* Header */}
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
