"use client";

import { useEffect, useState, useCallback } from "react";

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

  // Filters
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

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Activity Logs</h2>
        <button
          onClick={() => fetchLogs(page)}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-card disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Date</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Action</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All</option>
            <option value="CHECK_IN">Check-in</option>
            <option value="CHECK_OUT">Check-out</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover"
        >
          Filter
        </button>
        {(filterDate || filterAction || filterStatus) && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted text-sm">No logs found.</p>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date & Time</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted">
                      {new Date(log.executedAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-green-100 text-success"
                            : log.status === "FAILED"
                            ? "bg-red-100 text-danger"
                            : "bg-gray-100 text-muted"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {log.skipReason || log.errorMessage || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
