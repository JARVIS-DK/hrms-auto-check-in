"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RefreshIcon } from "@/components/ui/icons";

const THRESHOLD = 68;
const MAX_PULL = 104;

type RefreshFn = () => void | Promise<void>;

type PullRefreshApi = {
  register: (fn: RefreshFn | null) => void;
  setBlocked: (blocked: boolean) => void;
  getHandler: () => RefreshFn | null;
  isBlocked: () => boolean;
};

const PullRefreshContext = createContext<PullRefreshApi | null>(null);

export function PullRefreshProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<RefreshFn | null>(null);
  const blockedRef = useRef(false);

  const api = useMemo<PullRefreshApi>(
    () => ({
      register: (fn) => {
        handlerRef.current = fn;
      },
      setBlocked: (blocked) => {
        blockedRef.current = blocked;
      },
      getHandler: () => handlerRef.current,
      isBlocked: () => blockedRef.current,
    }),
    []
  );

  return <PullRefreshContext.Provider value={api}>{children}</PullRefreshContext.Provider>;
}

/** Register a soft refresh for the current page (replaces full reload). */
export function useRegisterPullRefresh(fn: RefreshFn, deps: unknown[] = []) {
  const api = useContext(PullRefreshContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useCallback(fn, deps);

  useEffect(() => {
    if (!api) return;
    api.register(stable);
    return () => api.register(null);
  }, [api, stable]);
}

/** Block pull-to-refresh while a form has unsaved edits. */
export function useBlockPullRefresh(blocked: boolean) {
  const api = useContext(PullRefreshContext);
  useEffect(() => {
    if (!api) return;
    api.setBlocked(blocked);
    return () => api.setBlocked(false);
  }, [api, blocked]);
}

/**
 * Restores swipe-down reload inside app-shell scrollers.
 * Prefers a page-registered soft refresh; falls back to full reload.
 */
export default function PullToRefresh({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const api = useContext(PullRefreshContext);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const setPull = (next: number) => {
      offsetRef.current = next;
      setOffset(next);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      } else {
        pulling.current = false;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      if (api?.isBlocked()) {
        pulling.current = false;
        setPull(0);
        return;
      }
      if (el.scrollTop > 0) {
        pulling.current = false;
        setPull(0);
        return;
      }

      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }

      const resisted = Math.min(MAX_PULL, dy * 0.42);
      setPull(resisted);
      if (resisted > 10) e.preventDefault();
    };

    const onEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;

      if (api?.isBlocked()) {
        setPull(0);
        return;
      }

      if (offsetRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        const run = async () => {
          try {
            const handler = api?.getHandler();
            if (handler) await handler();
            else window.location.reload();
          } finally {
            setRefreshing(false);
            setPull(0);
          }
        };
        void run();
        return;
      }
      setPull(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [api, refreshing]);

  const visible = offset > 10 || refreshing;
  const armed = offset >= THRESHOLD || refreshing;
  const indicatorY = Math.max(offset, refreshing ? THRESHOLD : 0);

  return (
    <div ref={scrollerRef} className={className}>
      <div className="pointer-events-none sticky top-0 z-20 h-0 overflow-visible flex justify-center" aria-hidden="true">
        <div
          className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-[var(--shadow)] transition-[opacity,transform] duration-150"
          style={{
            opacity: visible ? 1 : 0,
            transform: `translateY(${indicatorY * 0.55}px) rotate(${refreshing ? 0 : offset * 2.2}deg)`,
            color: armed ? "var(--primary)" : "var(--muted)",
          }}
        >
          <RefreshIcon size={16} className={refreshing ? "animate-spin" : ""} />
        </div>
      </div>
      {children}
    </div>
  );
}
