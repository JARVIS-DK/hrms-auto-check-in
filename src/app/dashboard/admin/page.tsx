"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import DateInput from "@/components/ui/DateInput";
import TimeInput from "@/components/ui/TimeInput";

type Tab = "users" | "logs" | "leaves" | "scheduled";

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
  result: "success" | "skipped" | "failed" | "missed" | "on_leave" | null;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [automationFilter, setAutomationFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [globalDefaults, setGlobalDefaults] = useState<{ checkinStart: string; checkinEnd: string; checkoutStart: string; checkoutEnd: string } | null>(null);
  const [editingDefaults, setEditingDefaults] = useState(false);
  const [editCheckinStart, setEditCheckinStart] = useState("");
  const [editCheckinEnd, setEditCheckinEnd] = useState("");
  const [editCheckoutStart, setEditCheckoutStart] = useState("");
  const [editCheckoutEnd, setEditCheckoutEnd] = useState("");
  const [saving, setSaving] = useState(false);

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
    setLoading(true);
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
    setLoading(true);
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
    setLoading(true);
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

  // Fetch scheduled actions
  const fetchScheduled = useCallback(async (page: number) => {
    setLoading(true);
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

  // Filter users based on search and automation filter
  useEffect(() => {
    let filtered = users;

    if (userSearch) {
      const search = userSearch.toLowerCase();
      filtered = filtered.filter(
        (u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
      );
    }

    if (automationFilter === "enabled") {
      filtered = filtered.filter((u) => u.automationEnabled);
    } else if (automationFilter === "disabled") {
      filtered = filtered.filter((u) => !u.automationEnabled);
    }

    setFilteredUsers(filtered);
  }, [users, userSearch, automationFilter]);

  // Always fetch users and global defaults
  useEffect(() => {
    fetchUsers();
    fetchGlobalDefaults();
  }, [fetchUsers, fetchGlobalDefaults]);

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === "logs") fetchLogs(logsPage);
    else if (activeTab === "leaves") fetchLeaves();
    else if (activeTab === "scheduled") fetchScheduled(scheduledPage);
  }, [activeTab, fetchLogs, fetchLeaves, fetchScheduled, logsPage, scheduledPage]);

  function refreshCurrentTab() {
    if (activeTab === "users") fetchUsers();
    else if (activeTab === "logs") fetchLogs(logsPage);
    else if (activeTab === "leaves") fetchLeaves();
    else if (activeTab === "scheduled") fetchScheduled(scheduledPage);
  }

  function openDefaultsEditor() {
    setEditCheckinStart(globalDefaults?.checkinStart || "");
    setEditCheckinEnd(globalDefaults?.checkinEnd || "");
    setEditCheckoutStart(globalDefaults?.checkoutStart || "");
    setEditCheckoutEnd(globalDefaults?.checkoutEnd || "");
    setEditingDefaults(true);
  }

  function cancelEditing() {
    setEditingDefaults(false);
    setEditCheckinStart("");
    setEditCheckinEnd("");
    setEditCheckoutStart("");
    setEditCheckoutEnd("");
  }

  async function saveGlobalDefaults() {
    if (editCheckinStart && editCheckinEnd && editCheckinStart >= editCheckinEnd) {
      toast("Check-in start must be before end", "error");
      return;
    }
    if (editCheckoutStart && editCheckoutEnd && editCheckoutStart >= editCheckoutEnd) {
      toast("Check-out start must be before end", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/global-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkinStart: editCheckinStart,
          checkinEnd: editCheckinEnd,
          checkoutStart: editCheckoutStart,
          checkoutEnd: editCheckoutEnd,
        }),
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

  // User dropdown for filters
  function UserSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {([
            { id: "users", label: "Users", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            { id: "logs", label: "Logs", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
            { id: "leaves", label: "Leaves", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { id: "scheduled", label: "Scheduled", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Default Schedule</p>
                      <p className="text-xs text-muted">Applied to users without custom times</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-xs text-muted">Check-in</p>
                      <p className="font-medium">{globalDefaults.checkinStart} – {globalDefaults.checkinEnd}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted">Check-out</p>
                      <p className="font-medium">{globalDefaults.checkoutStart} – {globalDefaults.checkoutEnd}</p>
                    </div>
                    <button
                      onClick={openDefaultsEditor}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  <label className="block text-xs font-medium text-muted mb-1.5">Search</label>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Name or email..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Automation</label>
                  <select
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

            {/* Users Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-muted">No users found</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-background border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">User</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Automation</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Check-in</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Check-out</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-background/50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted">{user.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                              user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted/10 text-muted"
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                              user.automationEnabled ? "bg-success/10 text-success" : "bg-muted/10 text-muted"
                            }`}>
                              {user.automationEnabled ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted">
                            {user.checkinStart && user.checkinEnd
                              ? `${user.checkinStart} - ${user.checkinEnd}`
                              : "Default"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted">
                            {user.checkoutStart && user.checkoutEnd
                              ? `${user.checkoutStart} - ${user.checkoutEnd}`
                              : "Default"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {user.lastActivity ? new Date(user.lastActivity).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Edit Global Defaults Modal */}
            {editingDefaults && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
                onClick={cancelEditing}
              >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl animate-[scaleIn_150ms_ease-out]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-base font-semibold mb-1">Edit Default Schedule Times</h3>
                  <p className="text-xs text-muted mb-5">
                    These defaults apply to all users who haven&apos;t set custom times.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-muted mb-2">Check-in Window</label>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                          <TimeInput
                            value={editCheckinStart}
                            onChange={setEditCheckinStart}
                            onClear={() => setEditCheckinStart("")}
                          />
                        </div>
                        <span className="text-muted text-xs mt-5">—</span>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                          <TimeInput
                            value={editCheckinEnd}
                            onChange={setEditCheckinEnd}
                            onClear={() => setEditCheckinEnd("")}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted mb-2">Check-out Window</label>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                          <TimeInput
                            value={editCheckoutStart}
                            onChange={setEditCheckoutStart}
                            onClear={() => setEditCheckoutStart("")}
                          />
                        </div>
                        <span className="text-muted text-xs mt-5">—</span>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                          <TimeInput
                            value={editCheckoutEnd}
                            onChange={setEditCheckoutEnd}
                            onClear={() => setEditCheckoutEnd("")}
                          />
                        </div>
                      </div>
                    </div>
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
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">User</label>
                  <UserSelect value={logsUserId} onChange={setLogsUserId} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Date</label>
                  <DateInput value={logsDate} onChange={setLogsDate} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Action</label>
                  <select
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
                  <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
                  <select
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

            {/* Logs List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-muted">No logs found</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="divide-y divide-border">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-background/50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        log.action === "CHECK_IN" ? "bg-success/10" : "bg-danger/10"
                      }`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={log.action === "CHECK_IN" ? "var(--success)" : "var(--danger)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {log.action === "CHECK_IN" ? (
                            <><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></>
                          ) : (
                            <><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></>
                          )}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{log.userName}</p>
                        <p className="text-xs text-muted">{log.userEmail}</p>
                      </div>
                      <div className="text-center shrink-0">
                        <p className="text-sm font-medium">{log.action === "CHECK_IN" ? "Check-in" : "Check-out"}</p>
                        <p className="text-xs text-muted">{new Date(log.executedAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.status === "SUCCESS" ? "bg-success/10 text-success" : log.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-muted/10 text-muted"
                        }`}>
                          {log.status === "SUCCESS" ? "Done" : log.status === "FAILED" ? "Failed" : "Skipped"}
                        </span>
                        {(log.skipReason || log.errorMessage) && (
                          <p className="text-xs text-muted mt-0.5 max-w-[160px] truncate">{log.skipReason || log.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
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
                  <UserSelect value={leavesUserId} onChange={setLeavesUserId} />
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

            {/* Leaves List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leaves.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-muted">No leaves found</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted px-2">
                  {leaves.length} {leaves.length === 1 ? "leave" : "leaves"} scheduled
                </div>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="divide-y divide-border">
                    {leaves.map((leave) => (
                      <div key={leave.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-background/50 transition-colors">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted/10">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{leave.userName}</p>
                          <p className="text-xs text-muted">{leave.userEmail}</p>
                        </div>
                        <div className="text-center shrink-0">
                          <p className="text-sm font-medium">{new Date(leave.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                          {leave.reason && <p className="text-xs text-muted">{leave.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "scheduled" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">User</label>
                  <UserSelect value={scheduledUserId} onChange={setScheduledUserId} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Action</label>
                  <select
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
                  <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
                  <select
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

            {/* Scheduled Actions List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : scheduledActions.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-sm text-muted">No scheduled actions found</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-muted px-2">
                  {scheduledActions.length} {scheduledActions.length === 1 ? "action" : "actions"}
                </div>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="divide-y divide-border">
                    {scheduledActions.map((action, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-5 py-3.5 hover:bg-background/50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          action.action === "checkin" ? "bg-success/10" : action.action === "checkout" ? "bg-danger/10" : "bg-muted/10"
                        }`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={action.action === "checkin" ? "var(--success)" : action.action === "checkout" ? "var(--danger)" : "var(--muted)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {action.action === "checkin" ? (
                              <><polyline points="17 11 12 6 7 11"/><line x1="12" y1="18" x2="12" y2="6"/></>
                            ) : action.action === "checkout" ? (
                              <><polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/></>
                            ) : (
                              <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>
                            )}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{action.userName}</p>
                          <p className="text-xs text-muted">{action.userEmail}</p>
                        </div>
                        <div className="text-center shrink-0">
                          <p className="text-sm font-medium capitalize">{action.action.replace("_", " ")}</p>
                          <p className="text-xs text-muted">{new Date(action.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at {action.targetTime}</p>
                        </div>
                        <div className="shrink-0">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                            !action.executed ? "bg-muted/10 text-muted"
                              : action.result === "success" ? "bg-success/10 text-success"
                              : action.result === "skipped" ? "bg-warning/10 text-warning"
                              : action.result === "failed" ? "bg-danger/10 text-danger"
                              : action.result === "missed" ? "bg-danger/10 text-danger"
                              : action.result === "on_leave" ? "bg-primary/10 text-primary"
                              : "bg-success/10 text-success"
                          }`}>
                            {!action.executed ? "Pending"
                              : action.result === "success" ? "Success"
                              : action.result === "skipped" ? "Skipped"
                              : action.result === "failed" ? "Failed"
                              : action.result === "missed" ? "Missed"
                              : action.result === "on_leave" ? "On Leave"
                              : "Executed"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
