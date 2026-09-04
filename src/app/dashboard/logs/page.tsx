"use client";

import { useCallback, useEffect, useState } from "react";
import DateInput from "@/components/ui/DateInput";
import LoadError from "@/components/ui/LoadError";
import { useRegisterPullRefresh } from "@/components/ui/PullToRefresh";
import { Table, THead, Th, TBody, Tr, Td, TableEmpty, TableLoading } from "@/components/ui/Table";
import { AttendanceBadge, RefreshIcon, ChevronLeftIcon, ChevronRightIcon, ActivityIcon } from "@/components/ui/icons";

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
  const [error, setError] = useState("");

  const [filterDate, setFilterDate] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  const bumpReload = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((k) => k + 1);
  }, []);

  useRegisterPullRefresh(() => {
    bumpReload();
  }, [bumpReload]);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (filterDate) params.set("date", filterDate);
    if (filterAction) params.set("action", filterAction);
    if (filterStatus) params.set("status", filterStatus);

    fetch(`/api/logs?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Couldn’t load logs");
        }
        return res.json();
      })
      .then((data) => {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setError("");
        setLoading(false);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return;
        setLogs([]);
        setError(err.message || "Couldn’t load logs");
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reloadKey]);

  function applyFilters() {
    setLoading(true);
    setError("");
    setPage(1);
    setReloadKey((k) => k + 1);
  }

  function goToPage(p: number) {
    setLoading(true);
    setError("");
    setPage(p);
  }

  function clearFilters() {
    setFilterDate("");
    setFilterAction("");
    setFilterStatus("");
    setLoading(true);
    setError("");
    setPage(1);
    setReloadKey((k) => k + 1);
  }

  const hasFilters = filterDate || filterAction || filterStatus;

  return (
    <div className="w-full max-w-3xl 2xl:max-w-5xl mx-auto space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Activity Logs</h2>
            <p className="text-sm text-muted mt-0.5">View all check-in and check-out history</p>
          </div>
          <button
            onClick={bumpReload}
            disabled={loading}
            className="self-start flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-card disabled:opacity-50 transition-colors"
          >
            <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="bg-card/80 border border-border rounded-2xl p-4 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-auto min-w-0">
              <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
              <DateInput
                value={filterDate}
                onChange={setFilterDate}
              />
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="logs-action" className="block text-xs font-medium text-muted mb-1.5">Action</label>
              <select id="logs-action"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-input"
              >
                <option value="">All</option>
                <option value="CHECK_IN">Check-in</option>
                <option value="CHECK_OUT">Check-out</option>
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="logs-status" className="block text-xs font-medium text-muted mb-1.5">Status</label>
              <select id="logs-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-input"
              >
                <option value="">All</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="SKIPPED">Skipped</option>
              </select>
            </div>
            <button
              onClick={applyFilters}
              className="w-full sm:w-auto px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
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

        {error && !loading ? (
          <LoadError message={error} onRetry={bumpReload} />
        ) : (
          <div className="bg-card/80 border border-border rounded-2xl overflow-hidden shadow-[var(--shadow)]">
            <Table label="Your check-in and check-out history">
              <THead>
                <Th>Action</Th>
                <Th>When</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Details</Th>
              </THead>
              <TBody>
                {loading ? (
                  <TableLoading colSpan={4} />
                ) : logs.length === 0 ? (
                  <TableEmpty
                    colSpan={4}
                    message="No logs found"
                    icon={<ActivityIcon size={20} stroke="var(--muted)" />}
                  />
                ) : (
                  logs.map((log) => {
                    const at = new Date(log.executedAt);
                    const detail = log.skipReason || log.errorMessage || "";
                    return (
                      <Tr key={log.id}>
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
                            {at.toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
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
                            {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : "Skipped"}
                          </span>
                          {detail && (
                            <span className="mt-1 block text-[11px] text-muted leading-snug max-w-[200px] md:hidden">
                              {detail}
                            </span>
                          )}
                        </Td>
                        <Td className="hidden md:table-cell text-xs text-muted">
                          <span className="block max-w-[240px] truncate" title={detail}>
                            {detail || "—"}
                          </span>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && !error && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
            >
              <ChevronLeftIcon size={14} />
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
              <ChevronRightIcon size={14} />
            </button>
          </div>
        )}
    </div>
  );
}
