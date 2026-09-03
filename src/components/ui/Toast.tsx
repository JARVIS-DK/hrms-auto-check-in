"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckIcon, ErrorIcon, InfoIcon } from "@/components/ui/icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className="pointer-events-auto animate-[slideUp_200ms_ease-out] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-[var(--shadow)] border text-sm font-medium max-w-sm backdrop-blur-md"
            style={{
              backgroundColor: "color-mix(in srgb, var(--card) 92%, transparent)",
              borderColor:
                t.type === "success" ? "var(--success)" : t.type === "error" ? "var(--danger)" : "var(--primary)",
              color: "var(--foreground)",
            }}
          >
            {t.type === "success" && <CheckIcon size={16} stroke="var(--success)" className="shrink-0" />}
            {t.type === "error" && <ErrorIcon size={16} stroke="var(--danger)" className="shrink-0" />}
            {t.type === "info" && <InfoIcon size={16} stroke="var(--primary)" className="shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
