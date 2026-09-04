"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Modal";
import LoadError from "@/components/ui/LoadError";
import { useRegisterPullRefresh } from "@/components/ui/PullToRefresh";
import { Table, THead, Th, TBody, Tr, Td, TableCard, TableEmpty } from "@/components/ui/Table";
import {
  AttendanceBadge,
  AttendanceIcon,
  CheckInIcon,
  CheckOutIcon,
  InfoIcon,
  ClockIcon,
  RefreshIcon,
} from "@/components/ui/icons";

interface Settings {
  hrmsEmail: string;
  automationEnabled: boolean;
  hasPassword: boolean;
}

interface LogEntry {
  action: string;
  status: string;
  executedAt: string;
  skipReason?: string;
  errorMessage?: string;
}

interface ActionPlan {
  window: { start: string; end: string } | null;
  targetTime: string | null;
  executed: boolean;
  result: string | null;
}

interface Today {
  date: string;
  automationEnabled: boolean;
  holiday: { name: string } | null;
  leave: { type: string; reason: string | null } | null;
  weekendSkip: string | null;
  checkin: ActionPlan | null;
  checkout: ActionPlan | null;
}

const RESULT_STYLES: Record<string, string> = {
  success: "bg-success/10 text-success",
  skipped: "bg-muted/10 text-muted",
  on_leave: "bg-primary/10 text-primary",
  holiday: "bg-primary/10 text-primary",
  failed: "bg-danger/10 text-danger",
  missed: "bg-danger/10 text-danger",
};

const RESULT_LABELS: Record<string, string> = {
  success: "Done",
  skipped: "Skipped",
  on_leave: "On leave",
  holiday: "Holiday",
  failed: "Failed",
  missed: "Missed",
};

function formatHourString(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return hhmm;
  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatHourString(start)} – ${formatHourString(end)}`;
}

/** Turns the raw plan into the one line a person actually wants to read. */
function planStatus(plan: ActionPlan | null, paused: boolean) {
  if (!plan) return { label: "—", detail: "Not configured", style: "bg-muted/10 text-muted" };
  if (plan.result) {
    return {
      label: RESULT_LABELS[plan.result] ?? plan.result,
      detail: plan.targetTime && plan.result === "success" ? `at ${formatHourString(plan.targetTime)}` : "",
      style: RESULT_STYLES[plan.result] ?? "bg-muted/10 text-muted",
    };
  }
  if (paused) return { label: "Paused", detail: "", style: "bg-muted/10 text-muted" };
  if (plan.targetTime) {
    return { label: "Scheduled", detail: `at ${formatHourString(plan.targetTime)}`, style: "bg-primary/10 text-primary" };
  }
  if (plan.window) {
    return {
      label: "Pending",
      detail: `between ${formatTimeRange(plan.window.start, plan.window.end)}`,
      style: "bg-muted/10 text-muted",
    };
  }
  return { label: "—", detail: "", style: "bg-muted/10 text-muted" };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [today, setToday] = useState<Today | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [toggling, setToggling] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"IN" | "OUT" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [logsRefreshing, setLogsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchLogs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLogsRefreshing(true);
    try {
      const r = await fetch("/api/logs?limit=6");
      const d = r.ok ? await r.json() : { logs: [] };
      setRecentLogs(d.logs || []);
    } catch {
      setRecentLogs([]);
    } finally {
      if (!opts?.silent) setLogsRefreshing(false);
    }
  }, []);

  const fetchToday = useCallback(() => {
    fetch("/api/today")
      .then((r) => (r.ok ? r.json() : null))
      .then(setToday)
      .catch(() => setToday(null));
  }, []);

  const refreshAll = useCallback(() => {
    setLoadError("");
    setSettings(null);
    setReloadKey((k) => k + 1);
  }, []);

  useRegisterPullRefresh(() => {
    fetchLogs({ silent: true });
    fetchToday();
    return fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then(setSettings)
      .catch(() => {
        /* keep existing settings on soft refresh failure */
      });
  }, [fetchLogs, fetchToday]);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setSettings(null);
          setLoadError(err.message || "Failed to load settings");
          toast(err.message || "Failed to load settings", "error");
        }
      });

    fetchLogs({ silent: true });
    fetchToday();
    return () => {
      cancelled = true;
    };
  }, [fetchLogs, fetchToday, toast, reloadKey]);

  async function toggleAutomation() {
    if (!settings) return;
    setToggling(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationEnabled: !settings.automationEnabled }),
      });
      if (res.ok) {
        const next = !settings.automationEnabled;
        setSettings({ ...settings, automationEnabled: next });
        fetchToday();
        toast(next ? "Automation enabled" : "Automation disabled", "success");
      }
    } catch {
      toast("Failed to toggle automation", "error");
    }
    setToggling(false);
  }

  async function manualCheckin(logType: "IN" | "OUT") {
    const isIn = logType === "IN";
    const setLoading = isIn ? setCheckinLoading : setCheckoutLoading;
    setLoading(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logType }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Action failed", "error");
      } else {
        toast(`${isIn ? "Check-in" : "Check-out"} successful at ${data.time}`, "success");
        fetchLogs({ silent: true });
        fetchToday();
      }
    } catch {
      toast("Network error", "error");
    }

    setLoading(false);
  }

  if (loadError && !settings) {
    return (
      <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto">
        <LoadError message={loadError} onRetry={refreshAll} />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(/\s+/)[0] ?? "";

  return (
    <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="text-sm text-muted mt-0.5">Today&apos;s schedule and a shortcut if you need to punch in by hand.</p>
        </div>

        {!settings.hasPassword && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-warning">Add your HRMS credentials</p>
              <p className="text-xs text-muted mt-0.5">
                Automation and manual check-in stay off until your email and password are saved.
              </p>
            </div>
            <Link
              href="/dashboard/settings"
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        )}

        <div className="surface-3d rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${settings.automationEnabled ? "bg-success animate-pulse" : "bg-muted"}`} />
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">Auto Scheduler</h3>
                <p className="text-xs text-muted mt-0.5 truncate" id="automation-hint">
                  {!settings.hasPassword
                    ? "Credentials required — open Settings to continue"
                    : settings.hrmsEmail || "No HRMS email configured"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleAutomation}
              disabled={toggling || !settings.hasPassword}
              aria-pressed={settings.automationEnabled}
              aria-label={settings.automationEnabled ? "Disable automation" : "Enable automation"}
              aria-describedby="automation-hint"
              className="relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 shrink-0"
              style={{ backgroundColor: settings.automationEnabled ? "var(--success)" : "var(--border)" }}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  settings.automationEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {today && (
          <div className="surface-3d rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Today</h3>
              <span className="text-xs text-muted">
                {new Date(today.date + "T00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            {(() => {
              const pausedReason = today.holiday
                ? `Public holiday — ${today.holiday.name}`
                : today.weekendSkip
                  ? `${today.weekendSkip} — automation skipped`
                  : today.leave?.type === "full"
                    ? "On full-day leave"
                    : !today.automationEnabled
                      ? "Auto scheduler is off"
                      : null;

              return (
                <>
                  {pausedReason && (
                    <div className="flex items-center gap-2 px-3 py-2.5 mb-3 bg-input rounded-xl">
                      <InfoIcon size={14} stroke="var(--muted)" className="shrink-0" />
                      <p className="text-xs text-muted">{pausedReason}</p>
                    </div>
                  )}

                  {today.leave && today.leave.type !== "full" && (
                    <div className="flex items-center gap-2 px-3 py-2.5 mb-3 bg-primary/10 rounded-xl">
                      <ClockIcon size={14} stroke="var(--primary)" className="shrink-0" />
                      <p className="text-xs text-primary">
                        {today.leave.type === "first_half" ? "First-half" : "Second-half"} leave —
                        times shifted below
                      </p>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {([
                      { key: "checkin", label: "Check-in", plan: today.checkin },
                      { key: "checkout", label: "Check-out", plan: today.checkout },
                    ] as const).map(({ key, label, plan }) => {
                      const status = planStatus(plan, Boolean(pausedReason));
                      return (
                        <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-input/60">
                          <AttendanceBadge action={key} muted={!plan?.window} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs">{label}</p>
                            {status.detail && (
                              <p className="text-xs text-muted truncate">{status.detail}</p>
                            )}
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${status.style}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <div className="surface-3d rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-sm">Manual Action</h3>
            {!settings.hasPassword && (
              <Link href="/dashboard/settings" className="text-xs text-primary font-medium hover:underline">
                Add credentials
              </Link>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setConfirmAction("IN")}
              disabled={checkinLoading || !settings.hasPassword}
              className="flex-1 py-3 bg-success/10 text-success border border-success/25 rounded-xl font-semibold text-sm hover:bg-success hover:text-[#04140f] hover:border-success/50 hover:shadow-[0_4px_18px_rgba(18,232,122,0.35)] disabled:opacity-40 disabled:hover:bg-success/10 disabled:hover:text-success disabled:hover:shadow-none transition-all"
            >
              {checkinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Checking in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2.5">
                  <CheckInIcon size={28} />
                  Check In
                </span>
              )}
            </button>
            <button
              onClick={() => setConfirmAction("OUT")}
              disabled={checkoutLoading || !settings.hasPassword}
              className="flex-1 py-3 bg-danger/10 text-danger border border-danger/20 rounded-xl font-semibold text-sm hover:bg-danger hover:text-white hover:border-danger/40 hover:shadow-[0_4px_16px_rgba(239,68,68,0.3)] disabled:opacity-40 disabled:hover:bg-danger/10 disabled:hover:text-danger disabled:hover:shadow-none transition-all"
            >
              {checkoutLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Checking out...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2.5">
                  <CheckOutIcon size={28} />
                  Check Out
                </span>
              )}
            </button>
          </div>
        </div>

        <TableCard
          title="Recent Activity"
          actions={
            <button
              type="button"
              onClick={() => fetchLogs()}
              disabled={logsRefreshing}
              aria-label={logsRefreshing ? "Refreshing activity" : "Refresh activity"}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-muted border border-border/80 bg-white/[0.03] hover:text-foreground hover:bg-white/[0.06] hover:border-border disabled:opacity-50 transition-colors"
            >
              <RefreshIcon size={14} className={logsRefreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{logsRefreshing ? "Refreshing" : "Refresh"}</span>
            </button>
          }
        >
          <Table label="Your most recent check-ins and check-outs">
            <THead>
              <Th>Action</Th>
              <Th>When</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {recentLogs.length === 0 ? (
                <TableEmpty
                  colSpan={3}
                  message="No activity yet"
                  icon={<ClockIcon size={20} stroke="var(--muted)" />}
                />
              ) : (
                recentLogs.map((log, i) => {
                  const at = new Date(log.executedAt);
                  const detail = log.skipReason || log.errorMessage || "";
                  return (
                    <Tr key={i}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <AttendanceBadge action={log.action as "CHECK_IN"} />
                          <span className="font-medium">
                            {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                          </span>
                        </span>
                      </Td>
                      <Td className="text-muted">
                        <span className="block whitespace-nowrap">
                          {at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        <span className="block text-xs tabular-nums">
                          {at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                            log.status === "SUCCESS"
                              ? "bg-success/10 text-success"
                              : log.status === "FAILED"
                                ? "bg-danger/10 text-danger"
                                : "bg-warning/10 text-warning"
                          }`}
                        >
                          {log.status === "SUCCESS"
                            ? "Done"
                            : log.status === "FAILED"
                              ? "Failed"
                              : "Skipped"}
                        </span>
                        {detail && log.status !== "SUCCESS" && (
                          <span className="block text-[11px] text-muted mt-1 max-w-[180px] leading-snug">
                            {detail}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </TableCard>

        <ConfirmDialog
          open={confirmAction !== null}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            if (action) manualCheckin(action);
          }}
          title={`Confirm ${confirmAction === "IN" ? "Check In" : "Check Out"}`}
          message={`This will record your ${
            confirmAction === "IN" ? "check-in" : "check-out"
          } on HRMS right now.`}
          tone={confirmAction === "IN" ? "success" : "danger"}
          icon={
            <AttendanceIcon action={confirmAction ?? "IN"} size={40} />
          }
        />
    </div>
  );
}
