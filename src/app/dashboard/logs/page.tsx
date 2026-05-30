"use client";

import { useEffect, useState, useCallback } from "react";
import DateInput from "@/components/ui/DateInput";

interface LogEntry {
  id: string;
  action: string;
  status: string;
  executedAt: string;
  skipReason?: string;
  errorMessage?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterDate, setFilterDate] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "15" });
    if (filterDate) params.set("date", filterDate);
    if (filterAction) params.set("action", filterAction);
    if (filterStatus) params.set("status", filterStatus);

    const res = await fetch(`/api/logs?${params.toString()}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, [filterDate, filterAction, filterStatus]);

  useEffect(() => {
    fetchLogs(page);
  }, [page, fetchLogs]);

  function applyFilters() {
    setPage(1);
    fetchLogs(1);
  }

  function clearFilters() {
    setFilterDate("");
    setFilterAction("");
    setFilterStatus("");
    setPage(1);
  }

  const hasFilters = filterDate || filterAction || filterStatus;

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-3xl 2xl:max-w-5xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Activity Logs</h2>
            <p className="text-sm text-muted mt-0.5">View all check-in and check-out history</p>
          </div>
          <button
            onClick={() => fetchLogs(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-card disabled:opacity-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
              <DateInput
                value={filterDate}
                onChange={setFilterDate}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-card"
              >
                <option value="">All</option>
                <option value="CHECK_IN">Check-in</option>
                <option value="CHECK_OUT">Check-out</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-card"
              >
                <option value="">All</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="SKIPPED">Skipped</option>
              </select>
            </div>
            <button
              onClick={applyFilters}
              className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
            >
              Apply
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-xs font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/10 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Logs List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="w-10 h-10 bg-muted/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <p className="text-sm text-muted">No logs found</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
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
                    <p className="text-sm font-medium">
                      {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(log.executedAt).toLocaleString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.status === "SUCCESS"
                          ? "bg-success/10 text-success"
                          : log.status === "FAILED"
                          ? "bg-danger/10 text-danger"
                          : "bg-muted/10 text-muted"
                      }`}
                    >
                      {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : "Skipped"}
                    </span>
                    {(log.skipReason || log.errorMessage) && (
                      <p className="text-xs text-muted mt-0.5 max-w-[160px] truncate">
                        {log.skipReason || log.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Previous
            </button>
            <span className="text-xs text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
