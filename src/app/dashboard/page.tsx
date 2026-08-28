"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Table, THead, Th, TBody, Tr, Td, TableCard, TableEmpty } from "@/components/ui/Table";
import { AttendanceBadge, AttendanceIcon, CheckInIcon, CheckOutIcon } from "@/components/ui/icons";

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

/** Turns the raw plan into the one line a person actually wants to read. */
function planStatus(plan: ActionPlan | null, paused: boolean) {
  if (!plan) return { label: "—", detail: "Not configured", style: "bg-muted/10 text-muted" };
  if (plan.result) {
    return {
      label: RESULT_LABELS[plan.result] ?? plan.result,
      detail: plan.targetTime && plan.result === "success" ? `at ${plan.targetTime}` : "",
      style: RESULT_STYLES[plan.result] ?? "bg-muted/10 text-muted",
    };
  }
  if (paused) return { label: "Paused", detail: "", style: "bg-muted/10 text-muted" };
  if (plan.targetTime) {
    return { label: "Scheduled", detail: `at ${plan.targetTime}`, style: "bg-primary/10 text-primary" };
  }
  if (plan.window) {
    // Before the day's row exists the exact minute hasn't been drawn yet.
    return {
      label: "Pending",
      detail: `between ${plan.window.start}–${plan.window.end}`,
      style: "bg-muted/10 text-muted",
    };
  }
  return { label: "—", detail: "", style: "bg-muted/10 text-muted" };
}

export default function DashboardPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [toggling, setToggling] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"IN" | "OUT" | null>(null);
  const { toast } = useToast();

  const fetchLogs = useCallback(() => {
    fetch("/api/logs?limit=5")
      .then((r) => {
        if (!r.ok) return { logs: [] };
        return r.json();
      })
      .then((d) => setRecentLogs(d.logs || []))
      .catch(() => setRecentLogs([]));
  }, []);

  const fetchToday = useCallback(() => {
    fetch("/api/today")
      .then((r) => (r.ok ? r.json() : null))
      .then(setToday)
      .catch(() => setToday(null));
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then(setSettings)
      .catch((err) => toast(err.message, "error"));

    fetchLogs();
    fetchToday();
  }, [fetchLogs, fetchToday, toast]);

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
        // Today's card reads the toggle, so it has to refresh with it.
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
        fetchLogs();
        fetchToday();
      }
    } catch {
      toast("Network error", "error");
    }

    setLoading(false);
  }

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-2xl 2xl:max-w-4xl space-y-5">
        {/* Automation Toggle Card */}
        <div className="rounded-2xl p-5 bg-card border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${settings.automationEnabled ? "bg-success animate-pulse" : "bg-muted"}`} />
              <div>
                <h3 className="font-semibold text-sm">Auto Scheduler</h3>
                <p className="text-xs text-muted mt-0.5">
                  {settings.hrmsEmail || "No HRMS email configured"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleAutomation}
              disabled={toggling || !settings.hasPassword}
              className="relative w-12 h-7 rounded-full transition-colors disabled:opacity-50"
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

        {/* Today's plan — the randomly-picked time used to be invisible */}
        {today && (
          <div className="rounded-2xl p-5 bg-card border border-border">
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
                    <div className="flex items-center gap-2 px-3 py-2.5 mb-3 bg-background rounded-xl">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <p className="text-xs text-muted">{pausedReason}</p>
                    </div>
                  )}

                  {today.leave && today.leave.type !== "full" && (
                    <div className="flex items-center gap-2 px-3 py-2.5 mb-3 bg-primary/10 rounded-xl">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
                        <div key={key} className="flex items-center gap-3">
                          {/* Muted when nothing will run — the row shouldn't
                              look active on a day the scheduler sits out. */}
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

        {/* Manual Check-in/Check-out */}
        <div className="rounded-2xl p-5 space-y-4 bg-card border border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Manual Action</h3>
            {!settings.hasPassword && (
              <span className="text-xs text-danger">Credentials required</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmAction("IN")}
              disabled={checkinLoading || !settings.hasPassword}
              className="flex-1 py-3 bg-success/10 text-success border border-success/20 rounded-xl font-semibold text-sm hover:bg-success hover:text-white hover:border-success/40 hover:shadow-[0_4px_16px_rgba(34,197,94,0.3)] disabled:opacity-40 disabled:hover:bg-success/10 disabled:hover:text-success disabled:hover:shadow-none transition-all"
            >
              {checkinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Checking in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <CheckInIcon />
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
                <span className="flex items-center justify-center gap-1.5">
                  <CheckOutIcon />
                  Check Out
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <TableCard
          title="Recent Activity"
          actions={
            <button
              onClick={fetchLogs}
              className="text-xs text-primary font-medium hover:underline"
            >
              Refresh
            </button>
          }
        >
          <Table label="Your most recent check-ins and check-outs">
            <THead>
              <Th>Action</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {recentLogs.length === 0 ? (
                <TableEmpty colSpan={4} message="No activity yet" />
              ) : (
                recentLogs.map((log, i) => {
                  const at = new Date(log.executedAt);
                  return (
                    <Tr key={i}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <AttendanceBadge action={log.action as "CHECK_IN"} />
                          <span className="font-medium whitespace-nowrap">
                            {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                          </span>
                        </span>
                      </Td>
                      <Td className="text-muted whitespace-nowrap">
                        {at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </Td>
                      <Td className="text-muted whitespace-nowrap tabular-nums">
                        {at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
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
                          title={log.skipReason || ""}
                        >
                          {log.status === "SUCCESS"
                            ? "Done"
                            : log.status === "FAILED"
                              ? "Failed"
                              : "Skipped"}
                        </span>
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
            <AttendanceIcon
              action={confirmAction ?? "IN"}
              size={24}
              stroke={confirmAction === "IN" ? "var(--success)" : "var(--danger)"}
            />
          }
        />
      </div>
    </div>
  );
}
