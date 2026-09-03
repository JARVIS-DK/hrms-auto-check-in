"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import TimeInput from "@/components/ui/TimeInput";
import DateInput from "@/components/ui/DateInput";
import { useToast } from "@/components/ui/Toast";

type TimeKey =
  | "checkinStart"
  | "checkinEnd"
  | "checkoutStart"
  | "checkoutEnd"
  | "halfDayCheckinStart"
  | "halfDayCheckinEnd"
  | "halfDayCheckoutStart"
  | "halfDayCheckoutEnd";

type LeaveType = "full" | "first_half" | "second_half";
type ManageTab = "windows" | "leave";

export interface ManageableUser {
  id: number;
  name: string;
  email: string;
  checkinStart: string;
  checkinEnd: string;
  checkoutStart: string;
  checkoutEnd: string;
  halfDayCheckinStart: string;
  halfDayCheckinEnd: string;
  halfDayCheckoutStart: string;
  halfDayCheckoutEnd: string;
}

const WINDOWS: { start: TimeKey; end: TimeKey; label: string; hint: string }[] = [
  { start: "checkinStart", end: "checkinEnd", label: "Check-in", hint: "Normal working day" },
  { start: "checkoutStart", end: "checkoutEnd", label: "Check-out", hint: "Normal working day" },
  {
    start: "halfDayCheckinStart",
    end: "halfDayCheckinEnd",
    label: "Half-day check-in",
    hint: "Arrival on a first-half leave day",
  },
  {
    start: "halfDayCheckoutStart",
    end: "halfDayCheckoutEnd",
    label: "Half-day check-out",
    hint: "Departure on a second-half leave day",
  },
];

const TIME_KEYS = WINDOWS.flatMap((w) => [w.start, w.end]);

const TYPE_OPTIONS: { value: LeaveType; label: string; summary: string }[] = [
  { value: "full", label: "Off all day", summary: "Not coming in at all" },
  { value: "first_half", label: "Morning off", summary: "Coming in after lunch" },
  { value: "second_half", label: "Afternoon off", summary: "Leaving after lunch" },
];

function timesFromUser(user: ManageableUser): Record<TimeKey, string> {
  return Object.fromEntries(TIME_KEYS.map((k) => [k, user[k] || ""])) as Record<TimeKey, string>;
}

export default function UserManageDialog({
  user,
  defaults,
  onClose,
  onSaved,
}: {
  user: ManageableUser | null;
  defaults: Record<TimeKey, string> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ManageTab>("windows");
  const [times, setTimes] = useState<Record<TimeKey, string>>(
    Object.fromEntries(TIME_KEYS.map((k) => [k, ""])) as Record<TimeKey, string>
  );
  const [saving, setSaving] = useState(false);
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("full");
  const [leaveReason, setLeaveReason] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [addingLeave, setAddingLeave] = useState(false);
  const todayISO = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!user) return;
    setTab("windows");
    setTimes(timesFromUser(user));
    setLeaveDate("");
    setLeaveType("full");
    setLeaveReason("");
    setWindowStart("");
    setWindowEnd("");
  }, [user]);

  function updateTime(key: TimeKey, value: string) {
    setTimes((prev) => ({ ...prev, [key]: value }));
  }

  async function saveWindows() {
    if (!user) return;

    for (const window of WINDOWS) {
      const start = times[window.start];
      const end = times[window.end];
      if (Boolean(start) !== Boolean(end)) {
        toast(`Set both ${window.label} times, or leave both blank`, "error");
        return;
      }
      if (start && end && start >= end) {
        toast(`${window.label} start must be before end`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...times }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Failed to save", "error");
        setSaving(false);
        return;
      }
      toast("Saved check-in / check-out windows", "success");
      onSaved();
    } catch {
      toast("Network error", "error");
    }
    setSaving(false);
  }

  async function addLeave() {
    if (!user) return;
    if (!leaveDate) {
      toast("Select a leave date", "error");
      return;
    }
    if (leaveType !== "full" && Boolean(windowStart) !== Boolean(windowEnd)) {
      toast("Set both a start and an end time, or leave both blank", "error");
      return;
    }
    if (windowStart && windowEnd && windowStart >= windowEnd) {
      toast("Start time must be before end time", "error");
      return;
    }

    setAddingLeave(true);
    try {
      const res = await fetch("/api/admin/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          dates: [leaveDate],
          type: leaveType,
          reason: leaveReason || undefined,
          windowStart: leaveType === "full" ? "" : windowStart,
          windowEnd: leaveType === "full" ? "" : windowEnd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Failed to add leave", "error");
        setAddingLeave(false);
        return;
      }
      toast("Leave added", "success");
      setLeaveDate("");
      setLeaveType("full");
      setLeaveReason("");
      setWindowStart("");
      setWindowEnd("");
      onSaved();
    } catch {
      toast("Network error", "error");
    }
    setAddingLeave(false);
  }

  return (
    <Modal open={!!user} onClose={onClose} title={user ? `Manage ${user.name}` : "Manage user"} maxWidth="lg">
      {user && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">{user.name}</h3>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>

          <div className="flex gap-1 p-1 bg-input/80 border border-border rounded-xl">
            {([
              { id: "windows" as const, label: "Windows" },
              { id: "leave" as const, label: "Leave" },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tab === item.id
                    ? "bg-card text-primary shadow-sm ring-1 ring-border"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "windows" && (
            <div className="space-y-4">
              <p className="text-xs text-muted">
                Leave a pair blank to use the org default
                {defaults
                  ? ` (${defaults.checkinStart || "—"}–${defaults.checkinEnd || "—"} in, ${defaults.checkoutStart || "—"}–${defaults.checkoutEnd || "—"} out)`
                  : ""}
                .
              </p>
              {WINDOWS.map((window) => (
                <div key={window.label}>
                  <label className="block text-xs font-medium text-muted">{window.label}</label>
                  <p className="text-[11px] text-muted/70 mb-2">{window.hint}</p>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                      <TimeInput
                        value={times[window.start]}
                        onChange={(v) => updateTime(window.start, v)}
                        onClear={() => updateTime(window.start, "")}
                      />
                    </div>
                    <span className="text-muted text-xs mt-5">—</span>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                      <TimeInput
                        value={times[window.end]}
                        onChange={(v) => updateTime(window.end, v)}
                        onClear={() => updateTime(window.end, "")}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-background transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={saveWindows}
                  disabled={saving}
                  className="flex-1 py-2.5 text-white rounded-xl font-medium text-sm bg-primary hover:bg-primary-hover disabled:opacity-50 transition-all"
                >
                  {saving ? "Saving..." : "Save windows"}
                </button>
              </div>
            </div>
          )}

          {tab === "leave" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
                <DateInput value={leaveDate} onChange={setLeaveDate} min={todayISO} />
              </div>
              <div className="grid gap-2">
                {TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 cursor-pointer ${
                      leaveType === option.value ? "border-primary bg-primary/8" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-leave-type"
                      className="mt-0.5"
                      checked={leaveType === option.value}
                      onChange={() => setLeaveType(option.value)}
                    />
                    <span>
                      <span className="block text-sm">{option.label}</span>
                      <span className="block text-[11px] text-muted">{option.summary}</span>
                    </span>
                  </label>
                ))}
              </div>
              {leaveType !== "full" && (
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                    <TimeInput value={windowStart} onChange={setWindowStart} onClear={() => setWindowStart("")} />
                  </div>
                  <span className="text-muted text-xs mt-5">—</span>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                    <TimeInput value={windowEnd} onChange={setWindowEnd} onClear={() => setWindowEnd("")} />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="admin-leave-reason" className="block text-xs font-medium text-muted mb-1.5">
                  Reason (optional)
                </label>
                <input
                  id="admin-leave-reason"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  maxLength={200}
                  className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-input focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-background transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={addLeave}
                  disabled={addingLeave}
                  className="flex-1 py-2.5 text-white rounded-xl font-medium text-sm bg-primary hover:bg-primary-hover disabled:opacity-50 transition-all"
                >
                  {addingLeave ? "Adding..." : "Add leave"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
