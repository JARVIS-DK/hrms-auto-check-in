"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import DateInput from "@/components/ui/DateInput";

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<{ date: string; reason?: string }[]>([]);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  async function fetchLeaves() {
    try {
      const res = await fetch("/api/leaves");
      if (!res.ok) {
        toast("Failed to load leaves", "error");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLeaves(Array.isArray(data) ? data : []);
    } catch {
      toast("Network error", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLeaves();
  }, []);

  async function addLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) {
      toast("Please select a date", "error");
      return;
    }
    setAdding(true);

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [newDate], reason: reason || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to add leave", "error");
        setAdding(false);
        return;
      }

      toast("Leave added successfully", "success");
      setNewDate("");
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
            Add dates when you&apos;re on leave. The scheduler will skip check-in/out on these days.
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
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>
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
            <h3 className="text-sm font-semibold">Scheduled Leaves</h3>
            <span className="text-xs text-muted">{leaves.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 bg-muted/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm text-muted">No leave dates configured</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.map((leave) => (
                <div
                  key={leave.date}
                  className="flex items-center justify-between p-3 bg-background rounded-xl group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {new Date(leave.date + "T00:00").getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(leave.date + "T00:00").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      {leave.reason && (
                        <p className="text-xs text-muted mt-0.5">{leave.reason}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(leave.date)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Remove leave"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
