"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import DateInput from "@/components/ui/DateInput";
import TimeInput from "@/components/ui/TimeInput";

type LeaveType = "full" | "first_half" | "second_half";

interface Leave {
  date: string;
  type: LeaveType;
  windowStart?: string;
  windowEnd?: string;
  reason?: string;
}

interface Holiday {
  date: string;
  name: string;
}

/** The four windows the leave page needs, already resolved against defaults. */
interface Effective {
  checkinStart: string;
  checkinEnd: string;
  checkoutStart: string;
  checkoutEnd: string;
  halfDayCheckinStart: string;
  halfDayCheckinEnd: string;
  halfDayCheckoutStart: string;
  halfDayCheckoutEnd: string;
}

/**
 * Named for what the person is doing, not for HR's taxonomy. "First half" made
 * the reader translate a category into a consequence; "Morning off" is the
 * thing they already have in mind.
 */
const TYPE_OPTIONS: { value: LeaveType; label: string; summary: string }[] = [
  { value: "full", label: "Off all day", summary: "Not coming in at all" },
  { value: "first_half", label: "Morning off", summary: "Coming in after lunch" },
  { value: "second_half", label: "Afternoon off", summary: "Leaving after lunch" },
];

const TYPE_LABELS: Record<LeaveType, string> = {
  full: "Off all day",
  first_half: "Morning off",
  second_half: "Afternoon off",
};

const TYPE_STYLES: Record<LeaveType, string> = {
  full: "bg-danger/10 text-danger",
  first_half: "bg-primary/10 text-primary",
  second_half: "bg-primary/10 text-primary",
};

/** Which action a half day moves — the other one runs at its usual time. */
const SHIFTED_ACTION: Record<Exclude<LeaveType, "full">, "checkin" | "checkout"> = {
  first_half: "checkin",
  second_half: "checkout",
};

function formatLeaveDate(date: string) {
  return new Date(date + "T00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "14:00" -> "2:00 PM". The time picker is 12-hour, so readouts match it. */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [effective, setEffective] = useState<Effective | null>(null);
  const [newDate, setNewDate] = useState("");
  const [type, setType] = useState<LeaveType>("full");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const holidayOn = useMemo(
    () => new Map(holidays.map((h) => [h.date, h.name])),
    [holidays]
  );

  // Past leaves are read-only history and pile up at the top of an ascending
  // sort; the list defaults to what's still ahead.
  const { upcoming, past } = useMemo(() => {
    const sorted = [...leaves].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcoming: sorted.filter((l) => l.date >= today),
      past: sorted.filter((l) => l.date < today).reverse(),
    };
  }, [leaves, today]);

  const visibleLeaves = showPast ? past : upcoming;

  /** The half-day window that applies before any per-day override. */
  const halfDayDefault = useMemo(() => {
    if (!effective || type === "full") return null;
    return SHIFTED_ACTION[type] === "checkin"
      ? { start: effective.halfDayCheckinStart, end: effective.halfDayCheckinEnd }
      : { start: effective.halfDayCheckoutStart, end: effective.halfDayCheckoutEnd };
  }, [effective, type]);

  /**
   * What the scheduler will actually do on the selected day. Mirrors
   * resolveWindow() on the server, using the already-resolved windows so the
   * fallback chain isn't reimplemented here.
   */
  const preview = useMemo(() => {
    if (!effective) return null;

    const normal = {
      checkin: { start: effective.checkinStart, end: effective.checkinEnd },
      checkout: { start: effective.checkoutStart, end: effective.checkoutEnd },
    };

    if (type === "full") {
      return {
        checkin: { window: null, shifted: false },
        checkout: { window: null, shifted: false },
      };
    }

    const shiftedAction = SHIFTED_ACTION[type];
    const override =
      windowStart && windowEnd ? { start: windowStart, end: windowEnd } : halfDayDefault;

    return {
      checkin: {
        window: shiftedAction === "checkin" ? override : normal.checkin,
        shifted: shiftedAction === "checkin",
      },
      checkout: {
        window: shiftedAction === "checkout" ? override : normal.checkout,
        shifted: shiftedAction === "checkout",
      },
    };
  }, [effective, type, windowStart, windowEnd, halfDayDefault]);

  // Bumped after add/remove to refetch. The request lives inside the effect so
  // every state update happens in a callback rather than synchronously in the
  // effect body, which is what react-hooks/set-state-in-effect asks for.
  const [reloadKey, setReloadKey] = useState(0);
  const fetchLeaves = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/leaves", { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Failed to load leaves");
        return res.json();
      }),
      // Holidays and schedule windows are advisory here — a failure in either
      // shouldn't block the leave list.
      fetch("/api/holidays", { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
      fetch("/api/settings", { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([leaveData, holidayData, settingsData]) => {
        setLeaves(Array.isArray(leaveData) ? leaveData : []);
        setHolidays(Array.isArray(holidayData) ? holidayData : []);
        setEffective(settingsData?.effective ?? null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        toast(err.message === "Failed to load leaves" ? err.message : "Network error", "error");
        setLoading(false);
      });

    return () => controller.abort();
  }, [reloadKey, toast]);

  async function addLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) {
      toast("Please select a date", "error");
      return;
    }
    if (type !== "full" && Boolean(windowStart) !== Boolean(windowEnd)) {
      toast("Set both a start and an end time, or leave both blank", "error");
      return;
    }
    if (windowStart && windowEnd && windowStart >= windowEnd) {
      toast("Start time must be before end time", "error");
      return;
    }

    setAdding(true);

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: [newDate],
          type,
          reason: reason || undefined,
          // Only meaningful on a half day; the API rejects it on a full day.
          windowStart: type === "full" ? "" : windowStart,
          windowEnd: type === "full" ? "" : windowEnd,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to add leave", "error");
        setAdding(false);
        return;
      }

      toast("Leave added successfully", "success");
      setNewDate("");
      setType("full");
      setWindowStart("");
      setWindowEnd("");
      setReason("");
      fetchLeaves();
    } catch {
      toast("Network error", "error");
    }
    setAdding(false);
  }

  async function removeLeave(date: string) {
    try {
      const res = await fetch(`/api/leaves?date=${date}`, { method: "DELETE" });
      if (!res.ok) {
        toast("Failed to remove leave", "error");
        return;
      }
      toast("Leave removed", "success");
      fetchLeaves();
    } catch {
      toast("Network error", "error");
    }
  }

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-xl 2xl:max-w-3xl space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold">Leave Dates</h2>
          <p className="text-sm text-muted mt-0.5">
            Tell the scheduler which days you&apos;re away. A full day is skipped entirely; a half
            day still records the part you work, just at a later or earlier time.
          </p>
        </div>

        {/* Add Leave Form */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Add New Leave</h3>
          <form onSubmit={addLeave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
                <DateInput
                  value={newDate}
                  onChange={setNewDate}
                  min={today}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Reason (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Sick leave"
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                How much of the day are you off?
              </label>
              <div className="space-y-2" role="radiogroup">
                {TYPE_OPTIONS.map((option) => {
                  const selected = type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setType(option.value);
                        // Custom times are meaningless on a full day — drop them
                        // rather than silently keeping values the API will reject.
                        if (option.value === "full") {
                          setWindowStart("");
                          setWindowEnd("");
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors ${
                        selected ? "border-primary bg-primary/10" : "border-border hover:bg-background"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          selected ? "border-primary" : "border-border"
                        }`}
                      >
                        {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-semibold ${
                            selected ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {option.label}
                        </span>
                        <span className="block text-xs text-muted mt-0.5">{option.summary}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* What the scheduler will actually do. The category alone never
                told anyone which action moves and which stays put. */}
            {preview && (
              <div className="p-3.5 bg-background rounded-xl border border-border">
                <p className="text-xs font-medium mb-2.5">
                  {newDate ? `On ${formatLeaveDate(newDate)}` : "On that day"}, the scheduler will:
                </p>
                <div className="space-y-2">
                  {([
                    { key: "checkin", label: "Check in", plan: preview.checkin },
                    { key: "checkout", label: "Check out", plan: preview.checkout },
                  ] as const).map(({ key, label, plan }) => (
                    <div key={key} className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                          plan.window
                            ? key === "checkin"
                              ? "bg-success/10"
                              : "bg-danger/10"
                            : "bg-muted/10"
                        }`}
                      >
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke={
                            !plan.window
                              ? "var(--muted)"
                              : key === "checkin"
                                ? "var(--success)"
                                : "var(--danger)"
                          }
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          {key === "checkin" ? (
                            <><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></>
                          ) : (
                            <><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></>
                          )}
                        </svg>
                      </span>
                      <span className="text-xs flex-1 min-w-0">
                        {plan.window ? (
                          <>
                            <span className="font-medium">{label}</span>
                            <span className="text-muted">
                              {" "}
                              between {formatRange(plan.window.start, plan.window.end)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">
                            <span className="font-medium text-foreground">Not {label.toLowerCase()}</span>
                            {" "}at all
                          </span>
                        )}
                      </span>
                      {plan.window && (
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                            plan.shifted ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted"
                          }`}
                        >
                          {plan.shifted ? "moved" : "as usual"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-day window override, only meaningful on a half day */}
            {type !== "full" && halfDayDefault && (
              <div className="p-3.5 bg-background rounded-xl border border-border">
                <label className="block text-xs font-medium">
                  Need a different time just for this day?
                </label>
                <p className="text-[11px] text-muted mt-0.5 mb-2.5">
                  {windowStart && windowEnd ? (
                    <>
                      Using your custom time. Clear both to go back to{" "}
                      {formatRange(halfDayDefault.start, halfDayDefault.end)}.
                    </>
                  ) : (
                    <>
                      Leave blank to use your usual half-day time,{" "}
                      {formatRange(halfDayDefault.start, halfDayDefault.end)}.
                    </>
                  )}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                    <TimeInput
                      value={windowStart}
                      onChange={setWindowStart}
                      onClear={() => setWindowStart("")}
                    />
                  </div>
                  <span className="text-muted text-xs mt-5">—</span>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                    <TimeInput
                      value={windowEnd}
                      onChange={setWindowEnd}
                      onClear={() => setWindowEnd("")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* The scheduler already skips holidays for everyone, so booking
                leave on one achieves nothing. */}
            {newDate && holidayOn.has(newDate) && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p className="text-xs text-primary">
                  {holidayOn.get(newDate)} is already a public holiday — attendance is skipped for
                  everyone that day.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={adding}
              className="w-full py-2.5 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-all bg-primary hover:bg-primary-hover"
            >
              {adding ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Leave
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Leaves List */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {showPast ? "Past Leaves" : "Upcoming Leaves"}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{visibleLeaves.length}</span>
              {past.length > 0 && (
                <button
                  onClick={() => setShowPast((v) => !v)}
                  className="px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  {showPast ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleLeaves.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 bg-muted/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm text-muted">
                {showPast ? "No past leave dates" : "No upcoming leave dates"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleLeaves.map((leave) => {
                const type = leave.type ?? "full";
                const isPast = leave.date < today;
                return (
                  <div
                    key={leave.date}
                    className={`flex items-center justify-between p-3 bg-background rounded-xl group ${
                      isPast ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {new Date(leave.date + "T00:00").getDate()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{formatLeaveDate(leave.date)}</p>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TYPE_STYLES[type]}`}
                          >
                            {TYPE_LABELS[type]}
                          </span>
                          {holidayOn.has(leave.date) && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                              Also a holiday
                            </span>
                          )}
                        </div>
                        {/* Spell out the consequence on the row too — the badge
                            alone doesn't say which action moved. */}
                        {type !== "full" && (
                          <p className="text-xs text-muted mt-0.5">
                            {type === "first_half" ? "Checks in" : "Checks out"}
                            {leave.windowStart && leave.windowEnd
                              ? ` ${formatRange(leave.windowStart, leave.windowEnd)}`
                              : " at your usual half-day time"}
                          </p>
                        )}
                        {leave.reason && (
                          <p className="text-xs text-muted mt-0.5 truncate">{leave.reason}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm(leave.date)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                      aria-label={`Remove leave on ${formatLeaveDate(leave.date)}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Public Holidays — read-only, managed by admins */}
        {holidays.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Upcoming Public Holidays</h3>
                <p className="text-xs text-muted mt-0.5">
                  Attendance is skipped for everyone on these days. No leave needed.
                </p>
              </div>
              <span className="text-xs text-muted shrink-0 ml-3">{holidays.length}</span>
            </div>
            <div className="space-y-2">
              {holidays.map((holiday) => (
                <div
                  key={holiday.date}
                  className="flex items-center gap-3 p-3 bg-background rounded-xl"
                >
                  <div className="w-9 h-9 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-success">
                      {new Date(holiday.date + "T00:00").getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{holiday.name}</p>
                    <p className="text-xs text-muted mt-0.5">{formatLeaveDate(holiday.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
            onClick={() => setDeleteConfirm(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-xl animate-[scaleIn_150ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-danger/10">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </div>
                <h3 className="text-base font-semibold">Remove Leave</h3>
                <p className="text-sm text-muted mt-1 mb-6">
                  Remove leave on{" "}
                  <span className="font-medium text-foreground">
                    {new Date(deleteConfirm + "T00:00").toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  ?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const date = deleteConfirm;
                    setDeleteConfirm(null);
                    removeLeave(date);
                  }}
                  className="flex-1 py-2.5 text-white rounded-xl font-medium text-sm transition-all bg-danger hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
