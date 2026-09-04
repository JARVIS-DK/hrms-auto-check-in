"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  /** Stretch to full width of the parent (default). */
  fullWidth?: boolean;
};

const VIEW_PAD = 12;
const GAP = 6;
const CLOSE_EVENT = "shiftsync:close-pickers";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function positionMenu(anchor: DOMRect, menuHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(anchor.width, 152), vw - VIEW_PAD * 2);
  const height = Math.min(menuHeight, vh - VIEW_PAD * 2);

  const spaceBelow = vh - anchor.bottom - VIEW_PAD;
  const spaceAbove = anchor.top - VIEW_PAD;
  const placeAbove = spaceBelow < Math.min(height, 200) && spaceAbove > spaceBelow;

  let top = placeAbove ? anchor.top - GAP - height : anchor.bottom + GAP;
  let left = anchor.left;

  left = clamp(left, VIEW_PAD, vw - VIEW_PAD - width);
  top = clamp(top, VIEW_PAD, vh - VIEW_PAD - height);

  return {
    top,
    left,
    width,
    maxHeight: Math.max(120, Math.min(280, placeAbove ? spaceAbove : spaceBelow)),
  };
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  fullWidth = true,
}: SelectProps) {
  const pickerId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const updatePosition = useCallback(() => {
    const anchor = rootRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const estimate = Math.min(280, 8 + options.length * 42);
    setCoords(positionMenu(anchor, estimate));
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

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
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
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

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  const menu =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            data-portal="select-menu"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              zIndex: 80,
              pointerEvents: "auto",
            }}
            className="overflow-y-auto overscroll-contain surface-elevated rounded-xl p-1 shadow-[var(--shadow-float)]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value === "" ? "__empty" : opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(opt.value)}
                  className={`w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-foreground hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && (
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`relative ${fullWidth ? "w-full" : "w-full sm:w-auto"} ${className}`.trim()}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`w-full min-w-[9.5rem] flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-medium text-left rounded-xl border transition-colors bg-input ${
          open
            ? "border-primary ring-2 ring-primary/30"
            : "border-border hover:border-primary/40"
        } ${selected ? "text-foreground" : "text-muted"}`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown open={open} />
      </button>
      {menu}
    </div>
  );
}
