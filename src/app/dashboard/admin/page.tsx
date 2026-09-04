"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import DateInput from "@/components/ui/DateInput";
import TimeInput from "@/components/ui/TimeInput";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import { useRegisterPullRefresh } from "@/components/ui/PullToRefresh";
import LoadError from "@/components/ui/LoadError";
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
import {
  AttendanceBadge,
  UsersIcon,
  ActivityIcon,
  CalendarIcon,
  ClockIcon,
  HolidayIcon,
  MailIcon,
  RefreshIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  EditIcon,
  StopIcon,
  LockIcon,
} from "@/components/ui/icons";
import UserManageDialog from "@/components/admin/UserManageDialog";

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

function formatHourString(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return hhmm;
  const period = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatHourString(start)} – ${formatHourString(end)}`;
}

/**
 * Module scope, not nested in AdminPage. Defining a component inside another
 * component makes React see a brand-new type on every render and remount the
 * <select>, losing its open state and focus on every keystroke elsewhere.
 */
function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AutomationToggle({
  enabled,
  dimmed,
  busy,
  name,
  onClick,
}: {
  enabled: boolean;
  dimmed: boolean;
  busy: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={enabled}
      aria-label={`${enabled ? "Turn off" : "Turn on"} scheduler for ${name}`}
      onClick={onClick}
      className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${dimmed ? "opacity-45" : ""}`}
      style={{ backgroundColor: enabled ? "var(--success)" : "var(--border)" }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

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
      className="w-full sm:w-auto px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-input"
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
  halfDayCheckinStart: string;
  halfDayCheckinEnd: string;
  halfDayCheckoutStart: string;
  halfDayCheckoutEnd: string;
  lastActivity: string | null;
  hasSettings: boolean;
  hasPassword: boolean;
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
  const [tabError, setTabError] = useState("");
  const tabBarRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const todayISO = new Date().toISOString().split("T")[0];

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [automationFilter, setAutomationFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [credentialFilter, setCredentialFilter] = useState<"all" | "missing">("all");
  const [globalDefaults, setGlobalDefaults] = useState<GlobalDefaults | null>(null);
  const [editingDefaults, setEditingDefaults] = useState(false);
  // One draft object rather than a useState per field — four windows means
  // eight of them, and they are always opened, edited, and saved together.
  const [draft, setDraft] = useState<GlobalDefaults | null>(null);
  const [saving, setSaving] = useState(false);
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [automationConfirm, setAutomationConfirm] = useState<{ user: User; next: boolean } | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<Invite | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);

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
  const fetchUsers = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json();
        const msg = data.error || "Failed to load users";
        if (!opts?.silent) {
          setTabError(msg);
          toast(msg, "error");
        }
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      if (!opts?.silent) setTabError("");
    } catch {
      if (!opts?.silent) {
        setTabError("Failed to load users");
        toast("Failed to load users", "error");
      }
    }
    if (!opts?.silent) setLoading(false);
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
        const msg = data.error || "Failed to load logs";
        setTabError(msg);
        toast(msg, "error");
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setLogsTotalPages(data.totalPages || 1);
      setTabError("");
    } catch {
      setTabError("Failed to load logs");
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
        const msg = data.error || "Failed to load leaves";
        setTabError(msg);
        toast(msg, "error");
        return;
      }
      const data = await res.json();
      setLeaves(data.leaves || []);
      setTabError("");
    } catch {
      setTabError("Failed to load leaves");
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
        const msg = data.error || "Failed to load holidays";
        setTabError(msg);
        toast(msg, "error");
        return;
      }
      setHolidays(data.holidays || []);
      setTabError("");
    } catch {
      setTabError("Failed to load holidays");
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
        const msg = data.error || "Failed to load invites";
        setTabError(msg);
        toast(msg, "error");
        return;
      }
      setInvites(data.invites || []);
      setTabError("");
    } catch {
      setTabError("Failed to load invites");
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
        const msg = data.error || "Failed to load scheduled actions";
        setTabError(msg);
        toast(msg, "error");
        return;
      }
      const data = await res.json();
      setScheduledActions(data.scheduledActions || []);
      setScheduledTotalPages(data.totalPages || 1);
      setTabError("");
    } catch {
      setTabError("Failed to load scheduled actions");
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
      if (credentialFilter === "missing" && u.hasPassword) return false;
      if (automationFilter === "enabled") return u.automationEnabled;
      if (automationFilter === "disabled") return !u.automationEnabled;
      return true;
    });
  }, [users, userSearch, automationFilter, credentialFilter]);

  const userStats = useMemo(() => {
    const automationOn = users.filter((u) => u.automationEnabled).length;
    const missingPassword = users.filter((u) => !u.hasPassword).length;
    return {
      total: users.length,
      automationOn,
      missingPassword,
    };
  }, [users]);

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

  // Keep the user filter dropdowns populated even if you never open Users.
  useEffect(() => {
    fetchUsers({ silent: true });
  }, [fetchUsers]);

  // The loaders only setState after awaiting the network, so there is no
  // cascading render. The synchronous `loading` flip lives in
  // switchTab/refreshCurrentTab, not here.
  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  useEffect(() => {
    const root = tabBarRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTab]);

  function switchTab(tab: Tab) {
    if (tab === activeTab) return;
    setTabError("");
    setLoading(true);
    setActiveTab(tab);
  }

  function refreshCurrentTab() {
    setTabError("");
    setLoading(true);
    loadTab(activeTab);
  }

  function openUserLogs(userId: number) {
    setLogsUserId(String(userId));
    setLogsPage(1);
    setTabError("");
    setLoading(true);
    setActiveTab("logs");
  }

  useRegisterPullRefresh(() => {
    refreshCurrentTab();
  }, [activeTab, loadTab]);

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

  function requestAutomationToggle(user: User) {
    const next = !user.automationEnabled;
    if (next && !user.hasPassword) {
      toast("This user has no HRMS password saved, so the scheduler cannot be turned on", "error");
      return;
    }
    setAutomationConfirm({ user, next });
  }

  async function confirmAutomationToggle() {
    const pending = automationConfirm;
    if (!pending) return;
    setAutomationConfirm(null);
    setTogglingUserId(pending.user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: pending.user.id,
          automationEnabled: pending.next,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Failed to update scheduler", "error");
        return;
      }
      toast(
        pending.next
          ? `Scheduler turned on for ${pending.user.name}`
          : `Scheduler turned off for ${pending.user.name}`,
        "success"
      );
      fetchUsers();
    } catch {
      toast("Failed to update scheduler", "error");
    } finally {
      setTogglingUserId(null);
    }
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
    <div className="w-full max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Admin Monitoring</h2>
            <p className="text-sm text-muted mt-0.5">Monitor all users, logs, leaves, and scheduled actions</p>
          </div>
          <button
            onClick={refreshCurrentTab}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-card disabled:opacity-50 transition-colors shrink-0 self-start sm:self-auto"
          >
            <RefreshIcon size={14} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          ref={tabBarRef}
          className="flex gap-1 p-1 bg-input/80 border border-border rounded-2xl overflow-x-auto overscroll-x-contain scrollbar-thin"
        >
          {([
            { id: "users", label: "Users", icon: <UsersIcon size={16} /> },
            { id: "logs", label: "Logs", icon: <ActivityIcon size={16} /> },
            { id: "leaves", label: "Leaves", icon: <CalendarIcon size={16} /> },
            { id: "scheduled", label: "Scheduled", icon: <ClockIcon size={16} /> },
            { id: "holidays", label: "Holidays", icon: <HolidayIcon size={16} /> },
            { id: "invites", label: "Invites", icon: <MailIcon size={16} /> },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              data-active={activeTab === tab.id || undefined}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                activeTab === tab.id
                  ? "bg-card text-primary shadow-sm ring-1 ring-border"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {tabError && !loading && (
          <LoadError message={tabError} onRetry={refreshCurrentTab} />
        )}

        {/* Tab Content */}
        {!tabError && activeTab === "users" && (
          <div className="space-y-4">
            {/* Snapshot counts */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-border bg-card/80 px-3 py-3 sm:px-4 shadow-[var(--shadow)]">
                <p className="text-[11px] uppercase tracking-wider text-muted">Users</p>
                <p className="text-xl font-semibold tabular-nums mt-0.5">{userStats.total}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card/80 px-3 py-3 sm:px-4 shadow-[var(--shadow)]">
                <p className="text-[11px] uppercase tracking-wider text-muted">Scheduler on</p>
                <p className="text-xl font-semibold tabular-nums mt-0.5 text-success">{userStats.automationOn}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCredentialFilter((prev) => (prev === "missing" ? "all" : "missing"))
                }
                className={`rounded-2xl border px-3 py-3 sm:px-4 shadow-[var(--shadow)] text-left transition-colors ${
                  credentialFilter === "missing"
                    ? "border-warning/50 bg-warning/10"
                    : "border-border bg-card/80 hover:border-warning/40"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wider text-muted">No password</p>
                <p className={`text-xl font-semibold tabular-nums mt-0.5 ${userStats.missingPassword ? "text-warning" : ""}`}>
                  {userStats.missingPassword}
                </p>
              </button>
            </div>

            {/* Global Defaults Card */}
            {globalDefaults && (
              <div className="bg-card/80 border border-border rounded-2xl p-4 shadow-[var(--shadow)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
                      <ClockIcon size={16} stroke="var(--primary)" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Default Schedule</p>
                      <p className="text-xs text-muted">Applied to users without custom times</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                    {WINDOWS.map((window) => (
                      <div key={window.label} className="min-w-0 sm:text-center">
                        <p className="text-xs text-muted">{window.label}</p>
                        <p className="font-medium text-sm tabular-nums">
                          {formatTimeRange(globalDefaults[window.start], globalDefaults[window.end])}
                        </p>
                      </div>
                    ))}
                    <button
                      onClick={openDefaultsEditor}
                      className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors sm:ml-auto"
                    >
                      <EditIcon size={12} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-card/80 border border-border rounded-2xl p-4 shadow-[var(--shadow)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="w-full sm:flex-1 sm:min-w-[200px]">
                  <label htmlFor="admin-search" className="block text-xs font-medium text-muted mb-1.5">Search</label>
                  <input id="admin-search"
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Name or email..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-input"
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <label htmlFor="admin-automation" className="block text-xs font-medium text-muted mb-1.5">Automation</label>
                  <select id="admin-automation"
                    value={automationFilter}
                    onChange={(e) => setAutomationFilter(e.target.value as typeof automationFilter)}
                    className="w-full sm:w-auto px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-input"
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
              {loading ? (
                <div className="px-5 py-12 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="sr-only">Loading</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <UsersIcon size={20} stroke="var(--muted)" className="mx-auto mb-2 opacity-70" />
                  <p className="text-sm text-muted">No users match these filters</p>
                  {(userSearch || automationFilter !== "all" || credentialFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearch("");
                        setAutomationFilter("all");
                        setCredentialFilter("all");
                      }}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <ul className="md:hidden divide-y divide-border">
                    {filteredUsers.map((user) => (
                      <li key={user.id} className="px-4 py-3.5 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                            {userInitials(user.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted truncate">{user.email}</p>
                            {!user.hasPassword && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                                <LockIcon size={11} />
                                No HRMS password
                              </span>
                            )}
                          </div>
                          <span className={`shrink-0 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                            user.role === "admin" ? "bg-primary/15 text-primary" : "bg-white/8 text-foreground/80"
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 pl-[52px]">
                          <span className="text-xs text-muted">Scheduler</span>
                          <div className="flex items-center gap-3">
                            <AutomationToggle
                              enabled={user.automationEnabled}
                              dimmed={!user.hasPassword && !user.automationEnabled}
                              busy={togglingUserId === user.id}
                              name={user.name}
                              onClick={() => requestAutomationToggle(user)}
                            />
                            <button
                              type="button"
                              onClick={() => openUserLogs(user.id)}
                              className="text-xs font-medium text-muted hover:text-foreground"
                            >
                              Logs
                            </button>
                            <button
                              type="button"
                              onClick={() => setManagingUser(user)}
                              className="text-sm font-medium text-primary"
                            >
                              Manage
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="hidden md:block">
                    <Table label="All users and their automation settings">
                      <THead>
                        <Th>User</Th>
                        <Th>Role</Th>
                        <Th>Automation</Th>
                        <Th className="hidden lg:table-cell">Check-in</Th>
                        <Th className="hidden lg:table-cell">Check-out</Th>
                        <Th className="hidden lg:table-cell">Last activity</Th>
                        <Th>Manage</Th>
                      </THead>
                      <TBody>
                        {filteredUsers.map((user) => (
                          <Tr key={user.id}>
                            <Td>
                              <span className="block font-medium">{user.name}</span>
                              <span className="block text-xs text-muted">{user.email}</span>
                              {!user.hasPassword && (
                                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                                  <LockIcon size={11} />
                                  No HRMS password
                                </span>
                              )}
                            </Td>
                            <Td>
                              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                                user.role === "admin" ? "bg-primary/15 text-primary" : "bg-white/8 text-foreground/80"
                              }`}>
                                {user.role}
                              </span>
                            </Td>
                            <Td>
                              <AutomationToggle
                                enabled={user.automationEnabled}
                                dimmed={!user.hasPassword && !user.automationEnabled}
                                busy={togglingUserId === user.id}
                                name={user.name}
                                onClick={() => requestAutomationToggle(user)}
                              />
                            </Td>
                            <Td className="hidden lg:table-cell text-muted whitespace-nowrap tabular-nums">
                              {user.checkinStart && user.checkinEnd
                                ? formatTimeRange(user.checkinStart, user.checkinEnd)
                                : "Default"}
                            </Td>
                            <Td className="hidden lg:table-cell text-muted whitespace-nowrap tabular-nums">
                              {user.checkoutStart && user.checkoutEnd
                                ? formatTimeRange(user.checkoutStart, user.checkoutEnd)
                                : "Default"}
                            </Td>
                            <Td className="hidden lg:table-cell text-xs text-muted whitespace-nowrap">
                              {user.lastActivity
                                ? new Date(user.lastActivity).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
                                : "Never"}
                            </Td>
                            <Td>
                              <span className="inline-flex items-center gap-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openUserLogs(user.id)}
                                  className="text-xs font-medium text-muted hover:text-foreground"
                                >
                                  Logs
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setManagingUser(user)}
                                  className="text-sm font-medium text-primary hover:underline"
                                >
                                  Manage
                                </button>
                              </span>
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </>
              )}
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

            <UserManageDialog
              user={managingUser}
              defaults={globalDefaults}
              onClose={() => setManagingUser(null)}
              onSaved={() => {
                fetchUsers();
                fetchLeaves();
              }}
            />
            <ConfirmDialog
              open={automationConfirm !== null}
              onCancel={() => setAutomationConfirm(null)}
              onConfirm={confirmAutomationToggle}
              title={automationConfirm?.next ? "Turn scheduler on" : "Turn scheduler off"}
              confirmLabel={automationConfirm?.next ? "Turn on" : "Turn off"}
              tone={automationConfirm?.next ? "success" : "danger"}
              message={
                automationConfirm?.next ? (
                  <>
                    Auto check-in and check-out will start running for{" "}
                    <span className="font-medium text-foreground">{automationConfirm.user.name}</span>.
                  </>
                ) : (
                  <>
                    Auto check-in and check-out will stop for{" "}
                    <span className="font-medium text-foreground">{automationConfirm?.user.name}</span>.
                  </>
                )
              }
              icon={
                automationConfirm?.next ? (
                  <PlusIcon size={24} stroke="var(--success)" />
                ) : (
                  <StopIcon size={24} stroke="var(--danger)" />
                )
              }
            />
          </div>
        )}

        {!tabError && activeTab === "logs" && (
          <div className="space-y-4">
            {logsUserId && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5">
                <p className="text-xs text-primary min-w-0 truncate">
                  Showing logs for{" "}
                  <span className="font-semibold">
                    {users.find((u) => String(u.id) === logsUserId)?.name || "selected user"}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLogsUserId("");
                    setLogsPage(1);
                    setLoading(true);
                    setTabError("");
                  }}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
            {/* Filters */}
            <div className="bg-card/80 border border-border rounded-2xl p-4 shadow-[var(--shadow)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
                    setLoading(true);
                    setTabError("");
                    setLogsPage(1);
                    fetchLogs(1);
                  }}
                  className="px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
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
                      setLoading(true);
                      setTabError("");
                    }}
                    className="px-3 py-2 text-xs font-medium text-danger border border-danger/30 rounded-xl hover:bg-danger/10 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Logs table */}
            <div className="bg-card/80 border border-border rounded-2xl overflow-hidden shadow-[var(--shadow)]">
              <Table label="Activity logs for all users">
                <THead>
                  <Th>User</Th>
                  <Th className="hidden md:table-cell">Action</Th>
                  <Th>When</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">Details</Th>
                </THead>
                <TBody>
                  {loading ? (
                    <TableLoading colSpan={5} />
                  ) : logs.length === 0 ? (
                    <TableEmpty
                      colSpan={5}
                      message="No logs found"
                      icon={<ActivityIcon size={20} stroke="var(--muted)" />}
                    />
                  ) : (
                    logs.map((log) => {
                      const at = new Date(log.executedAt);
                      return (
                        <Tr key={log.id}>
                          <Td>
                            <span className="block font-medium">{log.userName}</span>
                            <span className="block text-xs text-muted break-all">{log.userEmail}</span>
                            <span className="mt-1.5 flex items-center gap-1.5 md:hidden">
                              <AttendanceBadge action={log.action as "CHECK_IN"} size={24} iconSize={12} />
                              <span className="text-xs font-medium">
                                {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                              </span>
                            </span>
                          </Td>
                          <Td className="hidden md:table-cell">
                            <span className="flex items-center gap-2.5">
                              <AttendanceBadge action={log.action as "CHECK_IN"} />
                              <span className="font-medium">
                                {log.action === "CHECK_IN" ? "Check-in" : "Check-out"}
                              </span>
                            </span>
                          </Td>
                          <Td className="text-muted">
                            <span className="block whitespace-nowrap">
                              {at.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                            <span className="block text-xs tabular-nums">
                              {at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </span>
                          </Td>
                          <Td>
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              log.status === "SUCCESS" ? "bg-success/10 text-success" : log.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                            }`}>
                              {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : "Skipped"}
                            </span>
                            {(log.skipReason || log.errorMessage) && (
                              <span className="mt-1 block text-[11px] text-muted leading-snug max-w-[200px] lg:hidden">
                                {log.skipReason || log.errorMessage}
                              </span>
                            )}
                          </Td>
                          <Td className="hidden lg:table-cell text-xs text-muted">
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
                  <ChevronLeftIcon size={14} />
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
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {!tabError && activeTab === "leaves" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card/80 border border-border rounded-2xl p-4 shadow-[var(--shadow)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
                  onClick={() => {
                    setLoading(true);
                    setTabError("");
                    fetchLeaves();
                  }}
                  className="px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
                >
                  Apply
                </button>
                {(leavesUserId || leavesStartDate || leavesEndDate) && (
                  <button
                    onClick={() => {
                      setLeavesUserId("");
                      setLeavesStartDate("");
                      setLeavesEndDate("");
                      setLoading(true);
                      setTabError("");
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
                    <TableEmpty
                      colSpan={5}
                      message="No leaves found"
                      icon={<CalendarIcon size={20} stroke="var(--muted)" />}
                    />
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
                            ? formatTimeRange(leave.windowStart, leave.windowEnd)
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

        {!tabError && activeTab === "scheduled" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card/80 border border-border rounded-2xl p-4 shadow-[var(--shadow)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
                  onClick={() => {
                    setLoading(true);
                    setTabError("");
                    setScheduledPage(1);
                    fetchScheduled(1);
                  }}
                  className="px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
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
                      setLoading(true);
                      setTabError("");
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
                    <TableEmpty
                      colSpan={5}
                      message="No scheduled actions found"
                      icon={<ClockIcon size={20} stroke="var(--muted)" />}
                    />
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
                                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-muted/10">
                                  <CalendarIcon size={14} stroke="var(--muted)" />
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
                          <Td className="text-muted whitespace-nowrap tabular-nums">{formatHourString(action.targetTime)}</Td>
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
                  <ChevronLeftIcon size={14} />
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
                  <ChevronRightIcon size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {!tabError && activeTab === "holidays" && (
          <div className="space-y-4">
            {/* Add holiday */}
            <div className="bg-card/80 border border-border rounded-2xl p-5 shadow-[var(--shadow)]">
              <h3 className="text-sm font-semibold">Add a public holiday</h3>
              <p className="text-xs text-muted mt-0.5 mb-4">
                Attendance is skipped for every user on these dates, ahead of their own leave.
                Add an end date to cover a multi-day break.
              </p>

              <form onSubmit={addHoliday} className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="w-full sm:flex-1 sm:min-w-[200px]">
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
                  className="w-full sm:w-auto px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
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
                    <TableEmpty
                      colSpan={4}
                      message="No holidays configured"
                      icon={<HolidayIcon size={20} stroke="var(--muted)" />}
                    />
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
                              className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              aria-label={`Remove ${holiday.name}`}
                            >
                              <TrashIcon size={14} />
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
              icon={<TrashIcon size={24} stroke="var(--danger)" />}
            />
          </div>
        )}

        {!tabError && activeTab === "invites" && (
          <div className="space-y-4">
            {/* Create invite */}
            <div className="bg-card/80 border border-border rounded-2xl p-5 shadow-[var(--shadow)]">
              <h3 className="text-sm font-semibold">Invite a new user</h3>
              <p className="text-xs text-muted mt-0.5 mb-4">
                Registration is invite-only. The link works once, only for the address below, and
                expires in 7 days.
              </p>

              <form onSubmit={createInvite} className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                <div className="w-full sm:flex-1 sm:min-w-[220px]">
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
                  className="w-full sm:w-auto px-4 py-2.5 text-sm bg-primary text-white rounded-xl font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
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
                    <TableEmpty
                      colSpan={5}
                      message="No invites yet"
                      icon={<MailIcon size={20} stroke="var(--muted)" />}
                    />
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                              >
                                <CopyIcon size={12} />
                                Copy link
                              </button>
                              <button
                                onClick={() => setRevokeConfirm(invite)}
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

            <ConfirmDialog
              open={revokeConfirm !== null}
              onCancel={() => setRevokeConfirm(null)}
              onConfirm={() => {
                const token = revokeConfirm?.token;
                setRevokeConfirm(null);
                if (token) revokeInvite(token);
              }}
              title="Revoke invite?"
              confirmLabel="Revoke"
              message={
                <>
                  The invite for{" "}
                  <span className="font-medium text-foreground">{revokeConfirm?.email}</span> will
                  stop working immediately.
                </>
              }
              icon={<TrashIcon size={24} stroke="var(--danger)" />}
            />
          </div>
        )}
      </div>
  );
}
