"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import DateInput from "@/components/ui/DateInput";
import TimeInput from "@/components/ui/TimeInput";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import {
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
  TableCard,
  TableEmpty,
  TableLoading,
} from "@/components/ui/Table";
import { AttendanceBadge } from "@/components/ui/icons";

type Tab = "users" | "logs" | "leaves" | "scheduled" | "holidays" | "invites";

// Same wording the user sees on their own Leaves page.
const LEAVE_TYPE_LABELS: Record<string, string> = {
  full: "Off all day",
  first_half: "Morning off",
  second_half: "Afternoon off",
};

interface GlobalDefaults {
  checkinStart: string;
  checkinEnd: string;
  checkoutStart: string;
  checkoutEnd: string;
  halfDayCheckinStart: string;
  halfDayCheckinEnd: string;
  halfDayCheckoutStart: string;
  halfDayCheckoutEnd: string;
}

/** Drives both the summary card and the editor, so they can't drift apart. */
const WINDOWS: { start: keyof GlobalDefaults; end: keyof GlobalDefaults; label: string; hint: string }[] = [
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

interface Holiday {
  id: number;
  date: string;
  name: string;
  createdAt: string;
}

interface Invite {
  token: string;
  email: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  status: "pending" | "used" | "revoked" | "expired";
}

const INVITE_STATUS_STYLES: Record<Invite["status"], string> = {
  pending: "bg-primary/10 text-primary",
  used: "bg-success/10 text-success",
  revoked: "bg-muted/10 text-muted",
  expired: "bg-danger/10 text-danger",
};

/**
 * Module scope, not nested in AdminPage. Defining a component inside another
 * component makes React see a brand-new type on every render and remount the
 * <select>, losing its open state and focus on every keystroke elsewhere.
 */
function UserSelect({
  value,
  onChange,
  users,
}: {
  value: string;
  onChange: (v: string) => void;
  users: { id: number; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background min-w-[160px]"
    >
      <option value="">All users</option>
      {users.map((u) => (
        <option key={u.id} value={String(u.id)}>{u.name}</option>
      ))}
    </select>
  );
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  automationEnabled: boolean;
  checkinStart: string;
  checkinEnd: string;
  checkoutStart: string;
  checkoutEnd: string;
  lastActivity: string | null;
  hasSettings: boolean;
}

interface LogEntry {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  action: string;
  status: string;
  executedAt: string;
  skipReason?: string;
  errorMessage?: string;
}

interface Leave {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  date: string;
  /** Absent on records created before half-day support. */
  type?: "full" | "first_half" | "second_half";
  windowStart?: string;
  windowEnd?: string;
  reason?: string;
  createdAt: string;
}

interface ScheduledAction {
  userId: number;
  userName: string;
  userEmail: string;
  date: string;
  action: string;
  targetTime: string;
  executed: boolean;
  result: "success" | "skipped" | "failed" | "missed" | "on_leave" | "holiday" | null;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const todayISO = new Date().toISOString().split("T")[0];

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [automationFilter, setAutomationFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [globalDefaults, setGlobalDefaults] = useState<GlobalDefaults | null>(null);
  const [editingDefaults, setEditingDefaults] = useState(false);
  // One draft object rather than a useState per field — four windows means
  // eight of them, and they are always opened, edited, and saved together.
  const [draft, setDraft] = useState<GlobalDefaults | null>(null);
  const [saving, setSaving] = useState(false);

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayEndDate, setHolidayEndDate] = useState("");
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayDeleteConfirm, setHolidayDeleteConfirm] = useState<Holiday | null>(null);

  // Invites state
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSendEmail, setInviteSendEmail] = useState(true);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsUserId, setLogsUserId] = useState("");
  const [logsAction, setLogsAction] = useState("");
  const [logsStatus, setLogsStatus] = useState("");
  const [logsDate, setLogsDate] = useState("");

  // Leaves state
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leavesUserId, setLeavesUserId] = useState("");
  const [leavesStartDate, setLeavesStartDate] = useState("");
  const [leavesEndDate, setLeavesEndDate] = useState("");

  // Scheduled actions state
  const [scheduledActions, setScheduledActions] = useState<ScheduledAction[]>([]);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledTotalPages, setScheduledTotalPages] = useState(1);
  const [scheduledUserId, setScheduledUserId] = useState("");
  const [scheduledAction, setScheduledAction] = useState("");
  const [scheduledStatus, setScheduledStatus] = useState("");

  // Fetch global defaults
  const fetchGlobalDefaults = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/global-settings");
      if (res.ok) {
        const data = await res.json();
        setGlobalDefaults(data);
      }
    } catch {}
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to load users", "error");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast("Failed to load users", "error");
    }
    setLoading(false);
  }, [toast]);

  // Fetch logs
  const fetchLogs = useCallback(async (page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (logsUserId) params.set("userId", logsUserId);
      if (logsAction) params.set("action", logsAction);
      if (logsStatus) params.set("status", logsStatus);
      if (logsDate) params.set("date", logsDate);

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to load logs", "error");
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setLogsTotalPages(data.totalPages || 1);
    } catch {
      toast("Failed to load logs", "error");
    }
    setLoading(false);
  }, [logsUserId, logsAction, logsStatus, logsDate, toast]);

  // Fetch leaves
  const fetchLeaves = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (leavesUserId) params.set("userId", leavesUserId);
      if (leavesStartDate) params.set("startDate", leavesStartDate);
      if (leavesEndDate) params.set("endDate", leavesEndDate);

      const res = await fetch(`/api/admin/leaves?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to load leaves", "error");
        return;
      }
      const data = await res.json();
      setLeaves(data.leaves || []);
    } catch {
      toast("Failed to load leaves", "error");
    }
    setLoading(false);
  }, [leavesUserId, leavesStartDate, leavesEndDate, toast]);

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/holidays");
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to load holidays", "error");
        return;
      }
      setHolidays(data.holidays || []);
    } catch {
      toast("Failed to load holidays", "error");
    }
    setLoading(false);
  }, [toast]);

  // Fetch invites
  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites");
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to load invites", "error");
        return;
      }
      setInvites(data.invites || []);
    } catch {
      toast("Failed to load invites", "error");
    }
    setLoading(false);
  }, [toast]);

  // Fetch scheduled actions
  const fetchScheduled = useCallback(async (page: number) => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (scheduledUserId) params.set("userId", scheduledUserId);
      if (scheduledAction) params.set("action", scheduledAction);
      if (scheduledStatus) params.set("status", scheduledStatus);

      const res = await fetch(`/api/admin/scheduled-actions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to load scheduled actions", "error");
        return;
      }
      const data = await res.json();
      setScheduledActions(data.scheduledActions || []);
      setScheduledTotalPages(data.totalPages || 1);
    } catch {
      toast("Failed to load scheduled actions", "error");
    }
    setLoading(false);
  }, [scheduledUserId, scheduledAction, scheduledStatus, toast]);

  // Derived, not stored. This was an effect that mirrored `users` into a second
  // state variable, costing an extra render pass on every keystroke.
  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (search && !u.name.toLowerCase().includes(search) && !u.email.toLowerCase().includes(search)) {
        return false;
      }
      if (automationFilter === "enabled") return u.automationEnabled;
      if (automationFilter === "disabled") return !u.automationEnabled;
      return true;
    });
  }, [users, userSearch, automationFilter]);

  /**
   * The one place that knows how to load a tab.
   *
   * `Record<Tab, ...>` makes this exhaustive: adding a tab without a loader is
   * a compile error. It used to be an if-else chain written out twice, and the
   * two drifted — the effect had no `users` branch, so switching away from
   * Users and back set `loading` true with nothing left to turn it off, and the
   * tab span forever.
   */
  const loadTab = useCallback(
    (tab: Tab) => {
      const loaders: Record<Tab, () => void> = {
        users: () => {
          fetchUsers();
          fetchGlobalDefaults();
        },
        logs: () => fetchLogs(logsPage),
        leaves: () => fetchLeaves(),
        scheduled: () => fetchScheduled(scheduledPage),
        holidays: () => fetchHolidays(),
        invites: () => fetchInvites(),
      };
      loaders[tab]();
    },
    [
      fetchUsers,
      fetchGlobalDefaults,
      fetchLogs,
      fetchLeaves,
      fetchScheduled,
      fetchHolidays,
      fetchInvites,
      logsPage,
      scheduledPage,
    ]
  );

  // The loaders only setState after awaiting the network, so there is no
  // cascading render. The synchronous `loading` flip lives in
  // switchTab/refreshCurrentTab, not here.
  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  function switchTab(tab: Tab) {
    if (tab === activeTab) return;
    setLoading(true);
    setActiveTab(tab);
  }

  function refreshCurrentTab() {
    setLoading(true);
    loadTab(activeTab);
  }

  /** Expand an optional end date into the inclusive list of dates it covers. */
  function expandDateRange(start: string, end: string): string[] {
    if (!end || end === start) return [start];
    const dates: string[] = [];
    const cursor = new Date(start + "T00:00");
    const last = new Date(end + "T00:00");
    while (cursor <= last && dates.length < 60) {
      dates.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!holidayName.trim()) {
      toast("Enter a holiday name", "error");
      return;
    }
    if (!holidayDate) {
      toast("Pick a date", "error");
      return;
    }
    if (holidayEndDate && holidayEndDate < holidayDate) {
      toast("End date must be on or after the start date", "error");
      return;
    }

    setSavingHoliday(true);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: holidayName.trim(),
          dates: expandDateRange(holidayDate, holidayEndDate),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Failed to add holiday", "error");
        return;
      }

      const total = (data.added ?? 0) + (data.updated ?? 0);
      toast(`${total} holiday date${total === 1 ? "" : "s"} saved`, "success");
      setHolidayName("");
      setHolidayDate("");
      setHolidayEndDate("");
      fetchHolidays();
    } catch {
      toast("Failed to add holiday", "error");
    } finally {
      setSavingHoliday(false);
    }
  }

  async function removeHoliday(date: string) {
    try {
      const res = await fetch(`/api/admin/holidays?date=${encodeURIComponent(date)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to remove holiday", "error");
        return;
      }
      toast("Holiday removed", "success");
      fetchHolidays();
    } catch {
      toast("Failed to remove holiday", "error");
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast("Enter an email address", "error");
      return;
    }

    setCreatingInvite(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), sendEmail: inviteSendEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Failed to create invite", "error");
        return;
      }

      setLastInviteUrl(data.invite.url);
      setInviteEmail("");
      toast(data.emailSent ? "Invite created and emailed" : "Invite created", "success");
      fetchInvites();
    } catch {
      toast("Failed to create invite", "error");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function revokeInvite(token: string) {
    try {
      const res = await fetch(`/api/admin/invites?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to revoke invite", "error");
        return;
      }
      toast("Invite revoked", "success");
      fetchInvites();
    } catch {
      toast("Failed to revoke invite", "error");
    }
  }

  async function copyInviteUrl(token: string) {
    const url = `${window.location.origin}/register?invite=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied", "success");
    } catch {
      toast("Could not copy — select the link manually", "error");
    }
  }

  function openDefaultsEditor() {
    if (globalDefaults) setDraft({ ...globalDefaults });
    setEditingDefaults(true);
  }

  function cancelEditing() {
    setEditingDefaults(false);
    setDraft(null);
  }

  function updateDraft(key: keyof GlobalDefaults, value: string) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function saveGlobalDefaults() {
    if (!draft) return;

    for (const window of WINDOWS) {
      const start = draft[window.start];
      const end = draft[window.end];
      if (start && end && start >= end) {
        toast(`${window.label} start must be before end`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/global-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (res.ok) {
        toast("Default times updated", "success");
        setEditingDefaults(false);
        fetchGlobalDefaults();
        fetchUsers();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to update defaults", "error");
      }
    } catch {
      toast("Failed to update defaults", "error");
    }
    setSaving(false);
  }

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Admin Monitoring</h2>
            <p className="text-sm text-muted mt-0.5">Monitor all users, logs, leaves, and scheduled actions</p>
          </div>
          <button
            onClick={refreshCurrentTab}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-card disabled:opacity-50 transition-colors"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {([
            { id: "users", label: "Users", icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            { id: "logs", label: "Logs", icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
            { id: "leaves", label: "Leaves", icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { id: "scheduled", label: "Scheduled", icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { id: "holidays", label: "Holidays", icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><path d="M4.9 9.5A9 9 0 0 1 12 8a9 9 0 0 1 7.1 1.5"/><path d="M3 22V12a9 9 0 0 1 18 0v10"/><line x1="3" y1="22" x2="21" y2="22"/></svg> },
            { id: "invites", label: "Invites", icon: <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Global Defaults Card */}
            {globalDefaults && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Default Schedule</p>
                      <p className="text-xs text-muted">Applied to users without custom times</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm flex-wrap justify-end">
                    {WINDOWS.map((window) => (
                      <div key={window.label} className="text-center">
                        <p className="text-xs text-muted">{window.label}</p>
                        <p className="font-medium">
                          {globalDefaults[window.start]} – {globalDefaults[window.end]}
                        </p>
                      </div>
                    ))}
                    <button
                      onClick={openDefaultsEditor}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="admin-search" className="block text-xs font-medium text-muted mb-1.5">Search</label>
                  <input id="admin-search"
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Name or email..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="admin-automation" className="block text-xs font-medium text-muted mb-1.5">Automation</label>
                  <select id="admin-automation"
                    value={automationFilter}
                    onChange={(e) => setAutomationFilter(e.target.value as typeof automationFilter)}
                    className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  >
                    <option value="all">All</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users table */}
            <TableCard title="Users" count={filteredUsers.length}>
              <Table label="All users and their automation settings">
                <THead>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Automation</Th>
                  <Th>Check-in</Th>
                  <Th>Check-out</Th>
                  <Th>Last activity</Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={6} />
                  ) : filteredUsers.length === 0 ? (
                    <TableEmpty colSpan={6} message="No users found" />
                  ) : (
                    filteredUsers.map((user) => (
                      <Tr key={user.id}>
                        <Td>
                          <span className="block font-medium whitespace-nowrap">{user.name}</span>
                          <span className="block text-xs text-muted">{user.email}</span>
                        </Td>
                        <Td>
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted"
                          }`}>
                            {user.role}
                          </span>
                        </Td>
                        <Td>
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                            user.automationEnabled ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                          }`}>
                            {user.automationEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </Td>
                        <Td className="text-muted whitespace-nowrap tabular-nums">
                          {user.checkinStart && user.checkinEnd
                            ? `${user.checkinStart} – ${user.checkinEnd}`
                            : "Default"}
                        </Td>
                        <Td className="text-muted whitespace-nowrap tabular-nums">
                          {user.checkoutStart && user.checkoutEnd
                            ? `${user.checkoutStart} – ${user.checkoutEnd}`
                            : "Default"}
                        </Td>
                        <Td className="text-xs text-muted whitespace-nowrap">
                          {user.lastActivity
                            ? new Date(user.lastActivity).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "Never"}
                        </Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </TableCard>

            {/* Edit Global Defaults Modal */}
            <Modal
              open={editingDefaults}
              onClose={cancelEditing}
              title="Edit Default Schedule Times"
              maxWidth="md"
            >
              <div>
                <div>
                  <h3 className="text-base font-semibold mb-1">Edit Default Schedule Times</h3>
                  <p className="text-xs text-muted mb-5">
                    These defaults apply to all users who haven&apos;t set custom times.
                  </p>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    {draft &&
                      WINDOWS.map((window) => (
                        <div key={window.label}>
                          <label className="block text-xs font-medium text-muted">
                            {window.label} Window
                          </label>
                          <p className="text-[11px] text-muted/70 mb-2">{window.hint}</p>
                          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                            <div>
                              <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                              <TimeInput
                                value={draft[window.start]}
                                onChange={(v) => updateDraft(window.start, v)}
                                onClear={() => updateDraft(window.start, "")}
                              />
                            </div>
                            <span className="text-muted text-xs mt-5">—</span>
                            <div>
                              <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                              <TimeInput
                                value={draft[window.end]}
                                onChange={(v) => updateDraft(window.end, v)}
                                onClear={() => updateDraft(window.end, "")}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={cancelEditing}
                      className="flex-1 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-background transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveGlobalDefaults}
                      disabled={saving}
                      className="flex-1 py-2.5 text-white rounded-xl font-medium text-sm bg-primary hover:bg-primary-hover disabled:opacity-50 transition-all"
                    >
                      {saving ? "Saving..." : "Save Defaults"}
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">User</label>
                  <UserSelect value={logsUserId} onChange={setLogsUserId} users={users} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
                  <DateInput value={logsDate} onChange={setLogsDate} />
                </div>
                <div>
                  <label htmlFor="admin-action" className="block text-xs font-medium text-muted mb-1.5">Action</label>
                  <select id="admin-action"
                    value={logsAction}
                    onChange={(e) => setLogsAction(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  >
                    <option value="">All</option>
                    <option value="CHECK_IN">Check-in</option>
                    <option value="CHECK_OUT">Check-out</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-status" className="block text-xs font-medium text-muted mb-1.5">Status</label>
                  <select id="admin-status"
                    value={logsStatus}
                    onChange={(e) => setLogsStatus(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  >
                    <option value="">All</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILED">Failed</option>
                    <option value="SKIPPED">Skipped</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    setLogsPage(1);
                    fetchLogs(1);
                  }}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                >
                  Apply
                </button>
                {(logsUserId || logsDate || logsAction || logsStatus) && (
                  <button
                    onClick={() => {
                      setLogsUserId("");
                      setLogsDate("");
                      setLogsAction("");
                      setLogsStatus("");
                      setLogsPage(1);
                    }}
                    className="px-3 py-2 text-xs font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/10 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Logs table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <Table label="Activity logs for all users">
                <THead>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Status</Th>
                  <Th>Details</Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={6} />
                  ) : logs.length === 0 ? (
                    <TableEmpty colSpan={6} message="No logs found" />
                  ) : (
                    logs.map((log) => {
                      const at = new Date(log.executedAt);
                      return (
                        <Tr key={log.id}>
                          <Td>
                            <span className="block font-medium whitespace-nowrap">{log.userName}</span>
                            <span className="block text-xs text-muted">{log.userEmail}</span>
                          </Td>
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
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              log.status === "SUCCESS" ? "bg-success/10 text-success" : log.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                            }`}>
                              {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : "Skipped"}
                            </span>
                          </Td>
                          <Td className="text-xs text-muted">
                            <span className="block max-w-[220px] truncate" title={log.skipReason || log.errorMessage || ""}>
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
            {logsTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, logsPage - 1);
                    setLogsPage(newPage);
                    fetchLogs(newPage);
                  }}
                  disabled={logsPage <= 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Previous
                </button>
                <span className="text-xs text-muted">Page {logsPage} of {logsTotalPages}</span>
                <button
                  onClick={() => {
                    const newPage = Math.min(logsTotalPages, logsPage + 1);
                    setLogsPage(newPage);
                    fetchLogs(newPage);
                  }}
                  disabled={logsPage >= logsTotalPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
                >
                  Next
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "leaves" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">User</label>
                  <UserSelect value={leavesUserId} onChange={setLeavesUserId} users={users} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Start Date</label>
                  <DateInput value={leavesStartDate} onChange={setLeavesStartDate} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">End Date</label>
                  <DateInput value={leavesEndDate} onChange={setLeavesEndDate} />
                </div>
                <button
                  onClick={fetchLeaves}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                >
                  Apply
                </button>
                {(leavesUserId || leavesStartDate || leavesEndDate) && (
                  <button
                    onClick={() => {
                      setLeavesUserId("");
                      setLeavesStartDate("");
                      setLeavesEndDate("");
                    }}
                    className="px-3 py-2 text-xs font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/10 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Leaves table */}
            <TableCard title="Leave Records" count={leaves.length}>
              <Table label="Leave records for all users">
                <THead>
                  <Th>User</Th>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Custom times</Th>
                  <Th>Reason</Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={5} />
                  ) : leaves.length === 0 ? (
                    <TableEmpty colSpan={5} message="No leaves found" />
                  ) : (
                    leaves.map((leave) => (
                      <Tr key={leave.id} muted={leave.date < todayISO}>
                        <Td>
                          <span className="block font-medium whitespace-nowrap">{leave.userName}</span>
                          <span className="block text-xs text-muted">{leave.userEmail}</span>
                        </Td>
                        <Td className="text-muted whitespace-nowrap">
                          {new Date(leave.date + "T00:00").toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Td>
                        <Td>
                          <span
                            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              (leave.type ?? "full") === "full"
                                ? "bg-danger/10 text-danger"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {LEAVE_TYPE_LABELS[leave.type ?? "full"]}
                          </span>
                        </Td>
                        <Td className="text-muted whitespace-nowrap tabular-nums">
                          {leave.windowStart && leave.windowEnd
                            ? `${leave.windowStart}–${leave.windowEnd}`
                            : "—"}
                        </Td>
                        <Td className="text-xs text-muted">
                          <span className="block max-w-[200px] truncate" title={leave.reason || ""}>
                            {leave.reason || "—"}
                          </span>
                        </Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </TableCard>
          </div>
        )}

        {activeTab === "scheduled" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">User</label>
                  <UserSelect value={scheduledUserId} onChange={setScheduledUserId} users={users} />
                </div>
                <div>
                  <label htmlFor="admin-action-2" className="block text-xs font-medium text-muted mb-1.5">Action</label>
                  <select id="admin-action-2"
                    value={scheduledAction}
                    onChange={(e) => setScheduledAction(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  >
                    <option value="">All</option>
                    <option value="checkin">Check-in</option>
                    <option value="checkout">Check-out</option>
                    <option value="leave_notify">Leave Notify</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-status-2" className="block text-xs font-medium text-muted mb-1.5">Status</label>
                  <select id="admin-status-2"
                    value={scheduledStatus}
                    onChange={(e) => setScheduledStatus(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="executed">Executed</option>
                  </select>
                </div>
                <button
                  onClick={() => { setScheduledPage(1); fetchScheduled(1); }}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                >
                  Apply
                </button>
                {(scheduledUserId || scheduledAction || scheduledStatus) && (
                  <button
                    onClick={() => {
                      setScheduledUserId("");
                      setScheduledAction("");
                      setScheduledStatus("");
                      setScheduledPage(1);
                    }}
                    className="px-3 py-2 text-xs font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/10 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Scheduled actions table */}
            <TableCard title="Scheduled Actions" count={scheduledActions.length}>
              <Table label="Scheduled check-in and check-out actions for all users">
                <THead>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Date</Th>
                  <Th>Target</Th>
                  <Th>Result</Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={5} />
                  ) : scheduledActions.length === 0 ? (
                    <TableEmpty colSpan={5} message="No scheduled actions found" />
                  ) : (
                    scheduledActions.map((action, idx) => {
                      const isAttendance = action.action === "checkin" || action.action === "checkout";
                      return (
                        <Tr key={idx}>
                          <Td>
                            <span className="block font-medium whitespace-nowrap">{action.userName}</span>
                            <span className="block text-xs text-muted">{action.userEmail}</span>
                          </Td>
                          <Td>
                            <span className="flex items-center gap-2.5">
                              {isAttendance ? (
                                <AttendanceBadge action={action.action as "checkin"} />
                              ) : (
                                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted/10">
                                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                  </svg>
                                </span>
                              )}
                              <span className="font-medium whitespace-nowrap capitalize">
                                {action.action.replace("_", " ")}
                              </span>
                            </span>
                          </Td>
                          <Td className="text-muted whitespace-nowrap">
                            {new Date(action.date + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </Td>
                          <Td className="text-muted whitespace-nowrap tabular-nums">{action.targetTime}</Td>
                          <Td>
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              !action.executed ? "bg-muted/10 text-muted"
                                : action.result === "success" ? "bg-success/10 text-success"
                                : action.result === "skipped" ? "bg-warning/10 text-warning"
                                : action.result === "failed" ? "bg-danger/10 text-danger"
                                : action.result === "missed" ? "bg-danger/10 text-danger"
                                : action.result === "on_leave" ? "bg-primary/10 text-primary"
                                : action.result === "holiday" ? "bg-primary/10 text-primary"
                                : "bg-success/10 text-success"
                            }`}>
                              {!action.executed ? "Pending"
                                : action.result === "success" ? "Success"
                                : action.result === "skipped" ? "Skipped"
                                : action.result === "failed" ? "Failed"
                                : action.result === "missed" ? "Missed"
                                : action.result === "on_leave" ? "On Leave"
                                : action.result === "holiday" ? "Holiday"
                                : "Executed"}
                            </span>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </TableCard>

            {/* Pagination */}
            {scheduledTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, scheduledPage - 1);
                    setScheduledPage(newPage);
                    fetchScheduled(newPage);
                  }}
                  disabled={scheduledPage <= 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Previous
                </button>
                <span className="text-xs text-muted">Page {scheduledPage} of {scheduledTotalPages}</span>
                <button
                  onClick={() => {
                    const newPage = Math.min(scheduledTotalPages, scheduledPage + 1);
                    setScheduledPage(newPage);
                    fetchScheduled(newPage);
                  }}
                  disabled={scheduledPage >= scheduledTotalPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium border border-border rounded-xl disabled:opacity-40 hover:bg-card transition-colors"
                >
                  Next
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "holidays" && (
          <div className="space-y-4">
            {/* Add holiday */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold">Add a public holiday</h3>
              <p className="text-xs text-muted mt-0.5 mb-4">
                Attendance is skipped for every user on these dates, ahead of their own leave.
                Add an end date to cover a multi-day break.
              </p>

              <form onSubmit={addHoliday} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="admin-name" className="block text-xs font-medium text-muted mb-1.5">Name</label>
                  <input id="admin-name"
                    type="text"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="e.g. Diwali"
                    maxLength={100}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
                  <DateInput value={holidayDate} onChange={setHolidayDate} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    End date <span className="text-muted/60">(optional)</span>
                  </label>
                  <DateInput
                    value={holidayEndDate}
                    onChange={setHolidayEndDate}
                    min={holidayDate || undefined}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingHoliday}
                  className="px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {savingHoliday ? "Saving..." : "Add holiday"}
                </button>
              </form>
            </div>

            {/* Holiday table */}
            <TableCard title="Holidays" count={holidays.length}>
              <Table label="Public holidays">
                <THead>
                  <Th>Date</Th>
                  <Th>Holiday</Th>
                  <Th>Status</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={4} />
                  ) : holidays.length === 0 ? (
                    <TableEmpty colSpan={4} message="No holidays configured" />
                  ) : (
                    holidays.map((holiday) => {
                      const isPast = holiday.date < todayISO;
                      return (
                        <Tr key={holiday.id} muted={isPast}>
                          <Td className="text-muted whitespace-nowrap">
                            {new Date(holiday.date + "T00:00").toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </Td>
                          <Td className="font-medium">{holiday.name}</Td>
                          <Td>
                            <span
                              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                                isPast ? "bg-muted/10 text-muted" : "bg-success/10 text-success"
                              }`}
                            >
                              {isPast ? "Past" : "Upcoming"}
                            </span>
                          </Td>
                          <Td className="text-right">
                            <button
                              onClick={() => setHolidayDeleteConfirm(holiday)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                              aria-label={`Remove ${holiday.name}`}
                            >
                              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
              </Table>
            </TableCard>

            <ConfirmDialog
              open={holidayDeleteConfirm !== null}
              onCancel={() => setHolidayDeleteConfirm(null)}
              onConfirm={() => {
                const date = holidayDeleteConfirm?.date;
                setHolidayDeleteConfirm(null);
                if (date) removeHoliday(date);
              }}
              title="Remove Holiday"
              confirmLabel="Remove"
              message={
                <>
                  Attendance will resume as normal for everyone on{" "}
                  <span className="font-medium text-foreground">
                    {holidayDeleteConfirm &&
                      new Date(holidayDeleteConfirm.date + "T00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                  </span>
                  .
                </>
              }
              icon={
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              }
            />
          </div>
        )}

        {activeTab === "invites" && (
          <div className="space-y-4">
            {/* Create invite */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold">Invite a new user</h3>
              <p className="text-xs text-muted mt-0.5 mb-4">
                Registration is invite-only. The link works once, only for the address below, and
                expires in 7 days.
              </p>

              <form onSubmit={createInvite} className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[220px]">
                  <label htmlFor="admin-email-address" className="block text-xs font-medium text-muted mb-1.5">Email address</label>
                  <input id="admin-email-address"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted pb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteSendEmail}
                    onChange={(e) => setInviteSendEmail(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  Email the link
                </label>
                <button
                  type="submit"
                  disabled={creatingInvite}
                  className="px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {creatingInvite ? "Creating..." : "Create invite"}
                </button>
              </form>

              {lastInviteUrl && (
                <div className="mt-4 p-3 bg-background rounded-xl border border-border">
                  <p className="text-xs text-muted mb-1.5">Latest invite link</p>
                  <p className="text-xs font-mono break-all text-foreground">{lastInviteUrl}</p>
                </div>
              )}
            </div>

            {/* Invite table */}
            <TableCard title="Invites" count={invites.length}>
              <Table label="Registration invites">
                <THead>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Invited by</Th>
                  <Th>Expires / used</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={5} />
                  ) : invites.length === 0 ? (
                    <TableEmpty colSpan={5} message="No invites yet" />
                  ) : (
                    invites.map((invite) => (
                      <Tr key={invite.token} muted={invite.status !== "pending"}>
                        <Td className="font-medium">{invite.email}</Td>
                        <Td>
                          <span
                            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${INVITE_STATUS_STYLES[invite.status]}`}
                          >
                            {invite.status}
                          </span>
                        </Td>
                        <Td className="text-muted whitespace-nowrap">{invite.invitedByName}</Td>
                        <Td className="text-muted whitespace-nowrap">
                          {invite.usedAt
                            ? `used ${new Date(invite.usedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                            : new Date(invite.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </Td>
                        <Td className="text-right">
                          {invite.status === "pending" && (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <button
                                onClick={() => copyInviteUrl(invite.token)}
                                className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                              >
                                Copy link
                              </button>
                              <button
                                onClick={() => revokeInvite(invite.token)}
                                className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition-colors"
                              >
                                Revoke
                              </button>
                            </span>
                          )}
                        </Td>
                      </Tr>
                    ))
                  )}
                </TBody>
              </Table>
            </TableCard>
          </div>
        )}
      </div>
    </div>
  );
}
