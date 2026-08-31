"use client";

import { useEffect, useState } from "react";
import DateInput from "@/components/ui/DateInput";
import { Table, THead, Th, TBody, Tr, Td, TableEmpty, TableLoading } from "@/components/ui/Table";
import { AttendanceBadge } from "@/components/ui/icons";

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

  // Bumped by anything that should re-run the query. The effect never flips
  // `loading` on synchronously — the handlers below do that before the state
  // they change lands, which keeps the spinner immediate without an
  // effect-driven cascading render.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (filterDate) params.set("date", filterDate);
    if (filterAction) params.set("action", filterAction);
    if (filterStatus) params.set("status", filterStatus);

    fetch(`/api/logs?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLogs([]);
        setLoading(false);
      });

    return () => controller.abort();
    // filterDate/Action/Status are read here but intentionally only re-trigger
    // via reloadKey, so typing in a filter doesn't fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reloadKey]);

  function applyFilters() {
    setLoading(true);
    setPage(1);
    setReloadKey((k) => k + 1);
  }

  function goToPage(p: number) {
    setLoading(true);
    setPage(p);
  }

  function clearFilters() {
    setFilterDate("");
    setFilterAction("");
    setFilterStatus("");
    setLoading(true);
    setPage(1);
    setReloadKey((k) => k + 1);
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
            onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-card disabled:opacity-50 transition-colors"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
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
              <label htmlFor="logs-action" className="block text-xs font-medium text-muted mb-1.5">Action</label>
              <select id="logs-action"
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
              <label htmlFor="logs-status" className="block text-xs font-medium text-muted mb-1.5">Status</label>
              <select id="logs-status"
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

        {/* Logs table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <Table label="Your check-in and check-out history">
            <THead>
              <Th>Action</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Status</Th>
              <Th>Details</Th>
            </THead>
            <TBody>
              {loading ? (
                <TableLoading colSpan={5} />
              ) : logs.length === 0 ? (
                <TableEmpty
                  colSpan={5}
                  message="No logs found"
                  icon={
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  }
                />
              ) : (
                logs.map((log) => {
                  const at = new Date(log.executedAt);
                  return (
                    <Tr key={log.id}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <AttendanceBadge action={log.action as "CHECK_IN"} />
                          <span className="font-medium whitespace-nowrap">
                            {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                          </span>
                        </span>
                      </Td>
                      <Td className="text-muted whitespace-nowrap">
                        {at.toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </Td>
                      <Td className="text-muted whitespace-nowrap tabular-nums">
                        {at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
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
                          {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : "Skipped"}
                        </span>
                      </Td>
                      <Td className="text-xs text-muted">
                        <span className="block max-w-[240px] truncate" title={log.skipReason || log.errorMessage || ""}>
                          {log.skipReason || log.errorMessage || "—"}
                        </span>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Previous
            </button>
            <span className="text-xs text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
            >
              Next
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
