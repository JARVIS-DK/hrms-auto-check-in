"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshIcon } from "@/components/ui/icons";

const THRESHOLD = 68;
const MAX_PULL = 104;

/**
 * Restores swipe-down reload inside app-shell scrollers.
 * Native pull-to-refresh cannot fire when body scroll is locked
 * (`overflow: hidden` + nested overflow), so we handle the gesture here.
 */
export default function PullToRefresh({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
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

      if (offsetRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        window.setTimeout(() => {
          window.location.reload();
        }, 120);
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
  }, [refreshing]);

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
