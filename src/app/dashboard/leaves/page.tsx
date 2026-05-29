"use client";

import { useEffect, useState } from "react";

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<{ date: string; reason?: string }[]>([]);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchLeaves() {
    try {
      const res = await fetch("/api/leaves");
      if (!res.ok) {
        setError("Failed to load leaves");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setLeaves(data);
      } else {
        setLeaves([]);
      }
      setError("");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLeaves();
  }, []);

  async function addLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) return;
    setError("");

    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [newDate], reason: reason || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add leave");
        return;
      }

      setNewDate("");
      setReason("");
      fetchLeaves();
    } catch {
      setError("Network error");
    }
  }

  async function removeLeave(date: string) {
    try {
      const res = await fetch(`/api/leaves?date=${date}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove leave");
        return;
      }
      fetchLeaves();
    } catch {
      setError("Network error");
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-6">Leave Dates</h2>
      <p className="text-sm text-muted mb-4">
        Add weekday dates when you&apos;re on leave. The scheduler will skip
        check-in/out on these dates.
      </p>

      <form onSubmit={addLeave} className="flex gap-2 mb-6">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover"
        >
          Add
        </button>
      </form>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : leaves.length === 0 ? (
        <p className="text-muted text-sm">No leave dates configured</p>
      ) : (
        <div className="space-y-2">
          {leaves.map((leave) => (
            <div
              key={leave.date}
              className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3"
            >
              <div>
                <span className="font-medium">{leave.date}</span>
                {leave.reason && (
                  <span className="text-muted text-sm ml-2">
                    — {leave.reason}
                  </span>
                )}
              </div>
              <button
                onClick={() => removeLeave(leave.date)}
                className="text-danger text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
