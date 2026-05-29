"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

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

export default function DashboardPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [toggling, setToggling] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"IN" | "OUT" | null>(null);
  const { toast } = useToast();

  function fetchLogs() {
    fetch("/api/logs?limit=5")
      .then((r) => {
        if (!r.ok) return { logs: [] };
        return r.json();
      })
      .then((d) => setRecentLogs(d.logs || []))
      .catch(() => setRecentLogs([]));
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then(setSettings)
      .catch((err) => toast(err.message, "error"));

    fetchLogs();
  }, []);

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
        toast(next ? "Automation enabled" : "Automation disabled", "success");
      }
    } catch {
      toast("Failed to toggle automation", "error");
    }
    setToggling(false);
  }

  async function manualCheckin(logType: "IN" | "OUT") {
    const isIn = logType === "IN";
    isIn ? setCheckinLoading(true) : setCheckoutLoading(true);

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
      }
    } catch {
      toast("Network error", "error");
    }

    isIn ? setCheckinLoading(false) : setCheckoutLoading(false);
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
      <div className="w-full max-w-2xl space-y-5">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></svg>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
                  Check Out
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl p-5 bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Recent Activity</h3>
            <button
              onClick={fetchLogs}
              className="text-xs text-primary font-medium hover:underline"
            >
              Refresh
            </button>
          </div>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-2.5">
              {recentLogs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      log.action === "CHECK_IN" ? "bg-success/10" : "bg-danger/10"
                    }`}
                  >
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={log.action === "CHECK_IN" ? "var(--success)" : "var(--danger)"}
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    >
                      {log.action === "CHECK_IN" ? (
                        <><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></>
                      ) : (
                        <><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></>
                      )}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs">
                      {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {new Date(log.executedAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      log.status === "SUCCESS"
                        ? "bg-success/10 text-success"
                        : log.status === "FAILED"
                        ? "bg-danger/10 text-danger"
                        : "bg-muted/10 text-muted"
                    }`}
                  >
                    {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : log.status}
                    {log.skipReason ? ` · ${log.skipReason}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {confirmAction && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
            onClick={() => setConfirmAction(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-xl animate-[scaleIn_150ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                    confirmAction === "IN" ? "bg-success/10" : "bg-danger/10"
                  }`}
                >
                  <svg
                    width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke={confirmAction === "IN" ? "var(--success)" : "var(--danger)"}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    {confirmAction === "IN" ? (
                      <><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></>
                    ) : (
                      <><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></>
                    )}
                  </svg>
                </div>
                <h3 className="text-base font-semibold">
                  Confirm {confirmAction === "IN" ? "Check In" : "Check Out"}
                </h3>
                <p className="text-sm text-muted mt-1 mb-6">
                  This will record your {confirmAction === "IN" ? "check-in" : "check-out"} on HRMS right now.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const action = confirmAction;
                    setConfirmAction(null);
                    manualCheckin(action);
                  }}
                  className={`flex-1 py-2.5 text-white rounded-xl font-medium text-sm transition-all ${
                    confirmAction === "IN" ? "bg-success hover:bg-green-600" : "bg-danger hover:bg-red-600"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
