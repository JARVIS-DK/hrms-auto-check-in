"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The behaviour every dialog needs and none of the hand-rolled copies had:
 * Escape to close, a focus trap, focus restored to whatever opened it, the
 * page behind locked from scrolling, and real dialog semantics for screen
 * readers.
 */
export function useDialogBehaviour(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const focusables = useCallback(() => {
    if (!ref.current) return [] as HTMLElement[];
    return Array.from(
      ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    focusables()[0]?.focus();

    // Lock the page behind the dialog. Without this the background scrolls
    // under the overlay, which is especially confusing on touch.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends so Tab can't escape into the inert page behind.
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus();
    };
  }, [open, onClose, focusables]);

  return ref;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Announced as the dialog's name; rendered as the heading unless hidden. */
  title: string;
  children: React.ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg";
}

const WIDTHS = { xs: "max-w-xs", sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;

export default function Modal({ open, onClose, title, children, maxWidth = "xs" }: ModalProps) {
  const ref = useDialogBehaviour(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative surface-elevated rounded-2xl p-6 w-full ${WIDTHS[maxWidth]} animate-[scaleIn_150ms_ease-out] max-h-[min(85dvh,100dvh-2rem)] flex flex-col overflow-hidden`}
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  /** Body copy; pass a node when part of it needs emphasis. */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary" | "success";
  icon: React.ReactNode;
}

const TONES = {
  danger: { bubble: "bg-danger/10", button: "bg-danger hover:bg-red-600" },
  primary: { bubble: "bg-primary/10", button: "bg-primary hover:bg-primary-hover" },
  success: { bubble: "bg-success/10", button: "bg-success hover:bg-green-600" },
} as const;

/** The confirm-and-cancel shape this app repeats on four different pages. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  icon,
}: ConfirmDialogProps) {
  const tones = TONES[tone];

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="flex flex-col items-center text-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${tones.bubble}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="text-sm text-muted mt-1 mb-6">{message}</div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-background transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-2.5 text-white rounded-xl font-medium text-sm transition-all ${tones.button}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
