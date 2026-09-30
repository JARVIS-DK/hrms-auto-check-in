"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterPullRefresh } from "@/components/ui/PullToRefresh";
import Modal from "@/components/ui/Modal";
import LoadError from "@/components/ui/LoadError";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckInIcon,
  CheckOutIcon,
  HolidayIcon,
  CalendarIcon,
  CloseIcon,
} from "@/components/ui/icons";

interface DayData {
  checkin: string | null;
  checkout: string | null;
  workingHours: number | null;
}

interface AttendanceData {
  days: Record<string, DayData>;
  leaves: Record<string, string>;
  holidays: Record<string, string>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatWorkingHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

type DayKind = "present-full" | "present-partial" | "absent" | "leave" | "holiday" | "weekend" | "future" | "today-empty";

function classifyDay(
  dayData: DayData | undefined,
  holiday: string | undefined,
  leave: string | undefined,
  isWeekend: boolean,
  isToday: boolean,
  isFuture: boolean,
): DayKind {
  if (holiday) return "holiday";
  if (leave) return "leave";
  if (isFuture) return "future";
  if (dayData?.checkin && dayData?.checkout) return "present-full";
  if (dayData?.checkin) return "present-partial";
  if (isWeekend) return "weekend";
  if (isToday) return "today-empty";
  return "absent";
}

const KIND_CELL_STYLES: Record<DayKind, string> = {
  "present-full":    "bg-[#0b2920] border-[#1a5c42] shadow-[inset_0_1px_0_rgba(18,232,122,0.08)]",
  "present-partial": "bg-[#0b2920]/60 border-[#1a5c42]/60",
  absent:            "bg-[#2a0f12]/50 border-[#5c1a22]/40",
  leave:             "bg-[#2a2008]/50 border-[#5c4a1a]/40",
  holiday:           "bg-[#0c1f33]/70 border-[#1a4470]/50",
  weekend:           "border-transparent",
  future:            "border-transparent opacity-25",
  "today-empty":     "border-primary/25",
};

interface DayInfo {
  ds: string;
  isWeekend: boolean;
  holiday: string | undefined;
  leave: string | undefined;
  dayData: DayData | undefined;
  isToday: boolean;
  isFuture: boolean;
  kind: DayKind;
}

function DayDetailContent({ info, dateLabel, onClose }: { info: DayInfo; dateLabel: string; onClose: () => void }) {
  const statusColor =
    info.kind === "present-full" || info.kind === "present-partial" ? "text-success"
      : info.kind === "absent" ? "text-danger"
        : info.kind === "leave" ? "text-warning"
          : info.kind === "holiday" ? "text-primary"
            : "text-muted";

  const statusLabel =
    info.kind === "present-full" ? "Present"
      : info.kind === "present-partial" ? "Checked in"
        : info.kind === "absent" ? "Absent"
          : info.kind === "leave" ? "On leave"
            : info.kind === "holiday" ? "Holiday"
              : info.kind === "weekend" ? "Weekend"
                : info.kind === "future" ? "Upcoming"
                  : "Today";

  return (
    <div className="space-y-3.5 overflow-hidden">
      {/* Header with close button */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{dateLabel}</p>
          <p className={`text-xs mt-0.5 font-medium ${statusColor}`}>{statusLabel}</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-white/[0.06] transition-colors shrink-0 -mr-2 -mt-1"
          aria-label="Close"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      {info.holiday ? (
        <div className="flex items-center gap-3 py-3.5 px-3 rounded-xl bg-primary/[0.06] border border-primary/12">
          <span className="w-9 h-9 rounded-lg bg-primary/12 flex items-center justify-center shrink-0">
            <HolidayIcon size={18} stroke="var(--primary)" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted/50 uppercase tracking-widest font-semibold">Holiday</p>
            <p className="text-sm font-semibold text-primary mt-0.5">{info.holiday}</p>
          </div>
        </div>
      ) : info.leave ? (
        <div className="flex items-center gap-3 py-3.5 px-3 rounded-xl bg-warning/[0.06] border border-warning/12">
          <span className="w-9 h-9 rounded-lg bg-warning/12 flex items-center justify-center shrink-0">
            <CalendarIcon size={18} stroke="var(--warning)" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted/50 uppercase tracking-widest font-semibold">Leave</p>
            <p className="text-sm font-semibold text-warning mt-0.5">
              {info.leave === "full"
                ? "Full-day leave"
                : info.leave === "first_half"
                  ? "First-half leave"
                  : "Second-half leave"}
            </p>
          </div>
        </div>
      ) : info.dayData?.checkin ? (
        <div className="space-y-2">
          {/* Check-in and check-out side by side */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-success/[0.05] border border-success/10">
              <span className="w-9 h-9 rounded-lg bg-success/12 flex items-center justify-center">
                <CheckInIcon size={22} />
              </span>
              <p className="text-[9px] text-muted/50 uppercase tracking-widest font-semibold">Check-in</p>
              <p className="text-sm font-bold tabular-nums leading-none">
                {formatHour(info.dayData.checkin)}
              </p>
            </div>

            {info.dayData.checkout ? (
              <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-danger/[0.05] border border-danger/10">
                <span className="w-9 h-9 rounded-lg bg-danger/12 flex items-center justify-center">
                  <CheckOutIcon size={22} />
                </span>
                <p className="text-[9px] text-muted/50 uppercase tracking-widest font-semibold">Check-out</p>
                <p className="text-sm font-bold tabular-nums leading-none">
                  {formatHour(info.dayData.checkout)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-muted/[0.04] border border-border/25">
                <span className="w-9 h-9 rounded-lg bg-muted/8 flex items-center justify-center">
                  <ClockIcon size={18} stroke="var(--muted)" />
                </span>
                <p className="text-[10px] text-muted">No check-out</p>
              </div>
            )}
          </div>

          {info.dayData.workingHours && (
            <div className="flex items-center gap-3 py-3 px-3 rounded-xl bg-primary/[0.06] border border-primary/12">
              <span className="w-9 h-9 rounded-lg bg-primary/12 flex items-center justify-center shrink-0">
                <ClockIcon size={18} stroke="var(--primary)" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted/50 uppercase tracking-widest font-semibold">Working hours</p>
                <p className="text-lg font-bold text-primary tabular-nums mt-0.5 leading-none">
                  {formatWorkingHours(info.dayData.workingHours)}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : info.isWeekend ? (
        <div className="flex items-center gap-3 py-3.5 px-3 rounded-xl bg-muted/[0.04] border border-border/25">
          <span className="w-9 h-9 rounded-lg bg-muted/8 flex items-center justify-center shrink-0">
            <CalendarIcon size={18} stroke="var(--muted)" />
          </span>
          <p className="text-sm text-muted">Weekend</p>
        </div>
      ) : info.isFuture ? (
        <div className="flex items-center gap-3 py-3.5 px-3 rounded-xl bg-muted/[0.04] border border-border/25">
          <span className="w-9 h-9 rounded-lg bg-muted/8 flex items-center justify-center shrink-0">
            <ClockIcon size={18} stroke="var(--muted)" />
          </span>
          <p className="text-sm text-muted">Upcoming</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-3.5 px-3 rounded-xl bg-danger/[0.06] border border-danger/12">
          <span className="w-9 h-9 rounded-lg bg-danger/12 flex items-center justify-center shrink-0">
            <CloseIcon size={18} stroke="var(--danger)" />
          </span>
          <p className="text-sm font-medium text-danger">No attendance recorded</p>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const now = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const currentMonthKey = monthKey(viewDate);

  const fetchData = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError("");
      fetch(`/api/attendance?month=${currentMonthKey}`)
        .then(async (res) => {
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || "Failed to load attendance");
          }
          return res.json();
        })
        .then((d) => {
          setData(d);
          setLoading(false);
        })
        .catch((err) => {
          setData(null);
          setError(err.message);
          setLoading(false);
        });
    },
    [currentMonthKey]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRegisterPullRefresh(() => {
    fetchData({ silent: true });
  }, [fetchData]);

  function prevMonth() {
    setSelectedDay(null);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setSelectedDay(null);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  function dateStr(day: number): string {
    return `${currentMonthKey}-${String(day).padStart(2, "0")}`;
  }

  function getDayInfo(day: number) {
    const ds = dateStr(day);
    const dayOfWeek = new Date(year, month, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday = data?.holidays[ds];
    const leave = data?.leaves[ds];
    const dayData = data?.days[ds];
    const isToday = ds === todayStr;
    const isFuture = ds > todayStr;
    const kind = classifyDay(dayData, holiday, leave, isWeekend, isToday, isFuture);
    return { ds, isWeekend, holiday, leave, dayData, isToday, isFuture, kind };
  }

  const selectedInfo = selectedDay ? getDayInfo(Number(selectedDay.split("-")[2])) : null;

  const stats = useMemo(() => {
    if (!data) return { present: 0, absent: 0, leaves: 0, holidays: 0, totalHours: 0, avgHours: 0 };
    let present = 0;
    let absent = 0;
    let leaves = 0;
    let holidays = 0;
    let totalHours = 0;
    let daysWithHours = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(d);
      if (ds > todayStr) continue;
      const dayOfWeek = new Date(year, month, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (data.holidays[ds]) { holidays++; continue; }
      if (data.leaves[ds]) { leaves++; continue; }
      if (isWeekend) continue;
      const dd = data.days[ds];
      if (dd?.checkin) {
        present++;
        if (dd.workingHours) { totalHours += dd.workingHours; daysWithHours++; }
      } else {
        absent++;
      }
    }
    return {
      present,
      absent,
      leaves,
      holidays,
      totalHours: Math.round(totalHours * 10) / 10,
      avgHours: daysWithHours > 0 ? Math.round((totalHours / daysWithHours) * 10) / 10 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, daysInMonth, todayStr, year, month, currentMonthKey]);

  if (error && !data) {
    return (
      <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto">
        <LoadError message={error} onRetry={() => fetchData()} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Attendance</h2>
        <p className="text-sm text-muted mt-0.5">Monthly calendar with daily working hours</p>
      </div>

      {/* Month picker + inline stats */}
      <div className="surface-3d rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/60 hover:bg-white/[0.05] active:scale-95 transition-all"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <div className="text-center">
            <h3 className="font-display text-base tracking-tight">{monthLabel(viewDate)}</h3>
          </div>
          <button
            onClick={nextMonth}
            disabled={currentMonthKey >= monthKey(now)}
            aria-label="Next month"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border/60 hover:bg-white/[0.05] active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>

        {/* Stat chips row */}
        <div className="flex items-stretch border-t border-border/40">
          {[
            { label: "Present", val: String(stats.present), accent: "text-success" },
            { label: "Absent", val: String(stats.absent), accent: "text-danger" },
            { label: "Leaves", val: String(stats.leaves), accent: "text-warning" },
            { label: "Avg hrs", val: stats.avgHours ? `${stats.avgHours}` : "—", accent: "text-primary" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`flex-1 text-center py-3 ${i > 0 ? "border-l border-border/30" : ""}`}
            >
              <p className={`text-base font-semibold tabular-nums leading-none ${s.accent}`}>{s.val}</p>
              <p className="text-[10px] text-muted mt-1 uppercase tracking-wider font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="surface-3d rounded-2xl p-3 sm:p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1.5">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className={`text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider py-2 ${
                    w === "Sun" || w === "Sat" ? "text-muted/40" : "text-muted/70"
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-[5px] sm:gap-2">
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;

                const info = getDayInfo(day);
                const isSelected = selectedDay === info.ds;
                const cellStyle = KIND_CELL_STYLES[info.kind];
                const hasHours = Boolean(info.dayData?.workingHours);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(isSelected ? null : info.ds)}
                    className={[
                      "relative flex flex-col items-center justify-center rounded-[10px] sm:rounded-xl",
                      "aspect-square sm:aspect-auto sm:min-h-[4rem]",
                      "border transition-all duration-150",
                      isSelected
                        ? "border-primary ring-2 ring-primary/25 bg-primary/10 scale-[1.04] z-10"
                        : cellStyle,
                      info.isToday && !isSelected ? "ring-[1.5px] ring-primary/50" : "",
                      !isSelected && info.kind !== "future" && info.kind !== "weekend"
                        ? "hover:brightness-125 hover:scale-[1.03] active:scale-[0.97]"
                        : "",
                    ].join(" ")}
                  >
                    {/* Today pulse ring */}
                    {info.isToday && (
                      <span className="absolute inset-0 rounded-[10px] sm:rounded-xl ring-1 ring-primary/30 animate-pulse pointer-events-none" />
                    )}

                    <span
                      className={`text-[13px] sm:text-sm tabular-nums leading-none ${
                        isSelected
                          ? "text-primary font-bold"
                          : info.isToday
                            ? "text-primary font-bold"
                            : info.kind === "weekend" || info.kind === "future"
                              ? "text-muted/35 font-medium"
                              : "text-foreground font-semibold"
                      }`}
                    >
                      {day}
                    </span>

                    {/* Working hours — shown when both check-in and check-out exist */}
                    {hasHours && (
                      <span className="text-[8px] sm:text-[10px] font-semibold tabular-nums leading-none mt-[3px] sm:mt-1 text-success">
                        {formatWorkingHours(info.dayData!.workingHours!)}
                      </span>
                    )}

                    {/* Status dot for days without hours display */}
                    {!hasHours && info.kind !== "weekend" && info.kind !== "future" && info.kind !== "today-empty" && (
                      <span
                        className={`w-[5px] h-[5px] sm:w-1.5 sm:h-1.5 rounded-full mt-[3px] sm:mt-1.5 ${
                          info.kind === "present-partial" ? "bg-success/70"
                            : info.kind === "leave" ? "bg-warning"
                              : info.kind === "holiday" ? "bg-primary"
                                : info.kind === "absent" ? "bg-danger/70"
                                  : ""
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-3.5 border-t border-border/30">
              {[
                { color: "bg-success", label: "Present" },
                { color: "bg-danger", label: "Absent" },
                { color: "bg-warning", label: "Leave" },
                { color: "bg-primary", label: "Holiday" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted/70 font-medium uppercase tracking-wide">
                  <span className={`w-[6px] h-[6px] rounded-full ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Day detail popup */}
      <Modal
        open={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? new Date(selectedDay + "T00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" }) : ""}
        maxWidth="xs"
      >
        {selectedInfo && (
          <DayDetailContent
            info={selectedInfo}
            onClose={() => setSelectedDay(null)}
            dateLabel={
              new Date(selectedDay! + "T00:00").toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            }
          />
        )}
      </Modal>
    </div>
  );
}
