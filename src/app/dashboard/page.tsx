"use client";

import { useEffect, useState } from "react";

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      .catch((err) => setError(err.message));

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
        setSettings({ ...settings, automationEnabled: !settings.automationEnabled });
      }
    } catch {
      setError("Failed to toggle automation");
    }
    setToggling(false);
  }

  async function manualCheckin(logType: "IN" | "OUT") {
    const isIn = logType === "IN";
    isIn ? setCheckinLoading(true) : setCheckoutLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logType }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed");
      } else {
        setMessage(`${isIn ? "Check-in" : "Check-out"} successful at ${data.time}`);
        fetchLogs();
      }
    } catch {
      setError("Network error");
    }

    isIn ? setCheckinLoading(false) : setCheckoutLoading(false);
  }

  if (error && !settings) {
    return <p className="text-danger">{error}</p>;
  }

  if (!settings) {
    return <p className="text-muted">Loading...</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      {/* Manual Check-in/Check-out */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-medium">Manual Check-in / Check-out</h3>
        <div className="flex gap-3">
          <button
            onClick={() => manualCheckin("IN")}
            disabled={checkinLoading || !settings.hasPassword}
            className="flex-1 py-3 bg-success text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {checkinLoading ? "Checking in..." : "Check In"}
          </button>
          <button
            onClick={() => manualCheckin("OUT")}
            disabled={checkoutLoading || !settings.hasPassword}
            className="flex-1 py-3 bg-danger text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {checkoutLoading ? "Checking out..." : "Check Out"}
          </button>
        </div>
        {!settings.hasPassword && (
          <p className="text-sm text-danger">
            Configure your HRMS credentials in Settings first.
          </p>
        )}
        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      {/* Automation Toggle */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Automation Status</h3>
            <p className="text-sm text-muted">
              {settings.hrmsEmail || "No HRMS email configured"}
            </p>
          </div>
          <button
            onClick={toggleAutomation}
            disabled={toggling || !settings.hasPassword}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              settings.automationEnabled
                ? "bg-success hover:bg-green-700"
                : "bg-muted hover:bg-gray-600"
            } disabled:opacity-50`}
          >
            {settings.automationEnabled ? "Active" : "Inactive"}
          </button>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Recent Activity</h3>
          <button
            onClick={fetchLogs}
            className="text-xs text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted">No activity yet</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
              >
                <span>
                  {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                </span>
                <span
                  className={
                    log.status === "SUCCESS"
                      ? "text-success"
                      : log.status === "FAILED"
                      ? "text-danger"
                      : "text-muted"
                  }
                >
                  {log.status}
                  {log.skipReason ? ` (${log.skipReason})` : ""}
                </span>
                <span className="text-muted">
                  {new Date(log.executedAt).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
