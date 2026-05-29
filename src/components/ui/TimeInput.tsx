"use client";

import { useRef, useState } from "react";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
}

export default function TimeInput({ value, onChange, onFocus, onClear }: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selHour, selMin] = value ? value.split(":") : ["", ""];
  const hour24 = selHour ? parseInt(selHour) : -1;
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;

  function buildTime(h12: number, minute: string, pm: boolean) {
    let h24 = h12;
    if (pm && h12 !== 12) h24 = h12 + 12;
    if (!pm && h12 === 12) h24 = 0;
    onChange(`${String(h24).padStart(2, "0")}:${minute}`);
  }

  function handleHourChange(h: string) {
    const min = selMin || "00";
    buildTime(parseInt(h), min, isPM);
  }

  function handleMinChange(m: string) {
    const h = hour12 > 0 ? hour12 : 9;
    buildTime(h, m, isPM);
  }

  function handlePeriodChange(pm: boolean) {
    const h = hour12 > 0 ? hour12 : 12;
    const min = selMin || "00";
    buildTime(h, min, pm);
  }

  function handleOpen() {
    if (!open && onFocus) onFocus();
    setOpen(true);
  }

  function formatDisplay() {
    if (!value) return "";
    return `${hour12}:${selMin} ${isPM ? "PM" : "AM"}`;
  }

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full px-3.5 py-3 border rounded-xl text-sm font-medium text-left transition-all flex items-center gap-2 ${
          open
            ? "border-primary ring-2 ring-primary/20 shadow-sm"
            : "border-border hover:border-primary/40"
        } ${value ? "text-foreground" : "text-muted"}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        {formatDisplay() || "Select time"}
      </button>

      {value && onClear && (
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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-lg p-3 animate-[scaleIn_100ms_ease-out]">
            <div className="flex gap-1.5">
              {/* Hour */}
              <div className="w-[52px]">
                <span className="block text-[9px] uppercase tracking-wider text-muted mb-1 text-center">Hr</span>
                <div className="h-[160px] overflow-y-auto scrollbar-thin">
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourChange(String(h))}
                      className={`w-full py-1.5 text-center text-xs rounded-md transition-colors ${
                        hour12 === h
                          ? "bg-primary text-white font-semibold"
                          : "hover:bg-primary/5 text-foreground"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute */}
              <div className="w-[52px]">
                <span className="block text-[9px] uppercase tracking-wider text-muted mb-1 text-center">Min</span>
                <div className="h-[160px] overflow-y-auto scrollbar-thin">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinChange(m)}
                      className={`w-full py-1.5 text-center text-xs rounded-md transition-colors ${
                        selMin === m
                          ? "bg-primary text-white font-semibold"
                          : "hover:bg-primary/5 text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* AM/PM */}
              <div className="w-[44px] flex flex-col gap-1 justify-center">
                <button
                  type="button"
                  onClick={() => handlePeriodChange(false)}
                  className={`py-2 text-center text-xs rounded-md font-medium transition-colors ${
                    !isPM && value
                      ? "bg-primary text-white"
                      : "bg-background hover:bg-primary/5 text-muted"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange(true)}
                  className={`py-2 text-center text-xs rounded-md font-medium transition-colors ${
                    isPM && value
                      ? "bg-primary text-white"
                      : "bg-background hover:bg-primary/5 text-muted"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full mt-2.5 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}
