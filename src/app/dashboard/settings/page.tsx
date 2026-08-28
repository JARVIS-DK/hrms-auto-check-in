"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import TimeInput from "@/components/ui/TimeInput";
import PasswordInput from "@/components/ui/PasswordInput";

type TimeKey =
  | "checkinStart"
  | "checkinEnd"
  | "checkoutStart"
  | "checkoutEnd"
  | "halfDayCheckinStart"
  | "halfDayCheckinEnd"
  | "halfDayCheckoutStart"
  | "halfDayCheckoutEnd";

/**
 * Drives the form, validation, and payload together — four windows as eight
 * separate useState pairs was already repetitive at two.
 */
const WINDOWS: { start: TimeKey; end: TimeKey; label: string; hint: string }[] = [
  { start: "checkinStart", end: "checkinEnd", label: "Check-in", hint: "Normal working day" },
  { start: "checkoutStart", end: "checkoutEnd", label: "Check-out", hint: "Normal working day" },
  {
    start: "halfDayCheckinStart",
    end: "halfDayCheckinEnd",
    label: "Half-day Check-in",
    hint: "Used when you're on first-half leave",
  },
  {
    start: "halfDayCheckoutStart",
    end: "halfDayCheckoutEnd",
    label: "Half-day Check-out",
    hint: "Used when you're on second-half leave",
  },
];

const TIME_KEYS = WINDOWS.flatMap((w) => [w.start, w.end]);

const EMPTY_TIMES = Object.fromEntries(TIME_KEYS.map((k) => [k, ""])) as Record<TimeKey, string>;

export default function SettingsPage() {
  const [hrmsEmail, setHrmsEmail] = useState("");
  const [hrmsPassword, setHrmsPassword] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [times, setTimes] = useState<Record<TimeKey, string>>(EMPTY_TIMES);
  const [skipSaturday, setSkipSaturday] = useState(true);
  const [skipSunday, setSkipSunday] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [defaults, setDefaults] = useState<Record<TimeKey, string> | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [locating, setLocating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHrmsEmail(data.hrmsEmail || "");
        setLatitude(data.latitude || "");
        setLongitude(data.longitude || "");
        setTimes(
          Object.fromEntries(TIME_KEYS.map((k) => [k, data[k] || ""])) as Record<TimeKey, string>
        );
        setSkipSaturday(data.skipSaturday ?? true);
        setSkipSunday(data.skipSunday ?? true);
        setAutomationEnabled(data.automationEnabled || false);
        setHasPassword(data.hasPassword || false);
      });

    fetch("/api/global-defaults")
      .then((r) => r.json())
      .then((data) => setDefaults(data))
      .catch(() => {});
  }, []);

  function getDefaultTimes() {
    const now = new Date();
    const start = new Date(now.getTime() - 60000);
    const end = new Date(now.getTime() + 30 * 60000);
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { start: fmt(start), end: fmt(end) };
  }

  function setTime(key: TimeKey, value: string) {
    setTimes((prev) => ({ ...prev, [key]: value }));
  }

  /** Prefill a blank window with a sensible span so the picker isn't empty. */
  function handleStartFocus(startKey: TimeKey, endKey: TimeKey) {
    if (times[startKey]) return;
    const { start, end } = getDefaultTimes();
    setTimes((prev) => ({
      ...prev,
      [startKey]: start,
      [endKey]: prev[endKey] || end,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    for (const window of WINDOWS) {
      const start = times[window.start];
      const end = times[window.end];
      if (start && end && start >= end) {
        toast(`${window.label} start time must be before end time`, "error");
        return;
      }
      if (Boolean(start) !== Boolean(end)) {
        toast(`${window.label}: set both times, or leave both blank`, "error");
        return;
      }
    }

    setSaving(true);

    const body: Record<string, unknown> = {
      hrmsEmail,
      latitude,
      longitude,
      ...times,
      skipSaturday,
      skipSunday,
    };
    if (hrmsPassword) body.hrmsPassword = hrmsPassword;

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast("Settings saved successfully!", "success");
        setHasPassword(true);
        setHrmsPassword("");
      } else {
        const data = await res.json();
        toast(data.error || "Failed to save settings", "error");
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(false);
  }

  async function toggleAutomation() {
    setToggling(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationEnabled: !automationEnabled }),
      });
      if (res.ok) {
        const next = !automationEnabled;
        setAutomationEnabled(next);
        toast(next ? "Automation enabled" : "Automation disabled", "success");
      }
    } catch {
      toast("Failed to toggle automation", "error");
    }
    setToggling(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast("Geolocation is not supported by your browser", "error");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toString());
        setLongitude(pos.coords.longitude.toString());
        toast("Location captured successfully", "success");
        setLocating(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            toast("Location permission denied", "error");
            break;
          case err.POSITION_UNAVAILABLE:
            toast("Location unavailable. Try again or enter manually.", "error");
            break;
          case err.TIMEOUT:
            toast("Location request timed out. Try again.", "error");
            break;
          default:
            toast("Could not get location", "error");
        }
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  return (
    <div className="flex-1 flex justify-center">
      <div className="w-full max-w-xl 2xl:max-w-3xl space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold">Settings</h2>
          <p className="text-sm text-muted mt-0.5">Configure your HRMS credentials and scheduler preferences</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Credentials */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              HRMS Credentials
            </h3>
            <div>
              <label htmlFor="settings-email" className="block text-xs font-medium text-muted mb-1.5">Email</label>
              <input id="settings-email"
                type="email"
                value={hrmsEmail}
                onChange={(e) => setHrmsEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                Password{" "}
                {hasPassword && (
                  <span className="text-muted font-normal">(leave blank to keep current)</span>
                )}
              </label>
              <PasswordInput
                value={hrmsPassword}
                onChange={setHrmsPassword}
                placeholder={hasPassword ? "••••••••" : "Enter password"}
                required={!hasPassword}
              />
            </div>
          </div>

          {/* Location */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                Location
              </h3>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                {locating ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Locating...
                  </span>
                ) : (
                  <>
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                    </svg>
                    Use current location
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-latitude" className="block text-xs font-medium text-muted mb-1.5">Latitude</label>
                <input id="settings-latitude"
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="11.0452..."
                  required
                />
              </div>
              <div>
                <label htmlFor="settings-longitude" className="block text-xs font-medium text-muted mb-1.5">Longitude</label>
                <input id="settings-longitude"
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="76.9266..."
                  required
                />
              </div>
            </div>
          </div>

          {/* Schedule Intervals */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Schedule Intervals
              </h3>
              {TIME_KEYS.some((k) => times[k]) && (
                <button
                  type="button"
                  onClick={() => setTimes(EMPTY_TIMES)}
                  className="px-2.5 py-1 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Auto Scheduler Toggle */}
            <div className="flex items-center justify-between p-3 bg-background rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${automationEnabled ? "bg-success animate-pulse" : "bg-muted"}`} />
                <div>
                  <span className="text-sm font-medium">Auto Scheduler</span>
                  <p className="text-xs text-muted">{automationEnabled ? "Running" : "Paused"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleAutomation}
                disabled={toggling || !hasPassword}
                className="relative w-12 h-7 rounded-full transition-colors disabled:opacity-50"
                style={{ backgroundColor: automationEnabled ? "var(--success)" : "var(--border)" }}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                    automationEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {WINDOWS.map((window) => (
              <div key={window.label}>
                <label className="block text-xs font-medium text-muted">{window.label} Window</label>
                <p className="text-[11px] text-muted/70 mb-2">
                  {window.hint}
                  {defaults ? ` · default ${defaults[window.start]}–${defaults[window.end]}` : ""}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">From</span>
                    <TimeInput
                      value={times[window.start]}
                      onChange={(v) => setTime(window.start, v)}
                      onFocus={() => handleStartFocus(window.start, window.end)}
                      onClear={() => setTime(window.start, "")}
                    />
                  </div>
                  <span className="text-muted text-xs mt-5">—</span>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-muted mb-1">To</span>
                    <TimeInput
                      value={times[window.end]}
                      onChange={(v) => setTime(window.end, v)}
                      onClear={() => setTime(window.end, "")}
                    />
                  </div>
                </div>
              </div>
            ))}

            <p className="text-xs text-muted">
              The scheduler randomly picks a time within each window. Leave blank to use the
              defaults shown above. Half-day windows apply on days you mark as half-day leave —
              and you can override them for a single day when adding that leave.
            </p>
          </div>

          {/* Weekend Toggles */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Skip Days
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <span className="text-sm font-medium">Saturday</span>
                <button
                  type="button"
                  onClick={() => setSkipSaturday(!skipSaturday)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: skipSaturday ? "var(--primary)" : "var(--border)" }}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      skipSaturday ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-background rounded-xl">
                <span className="text-sm font-medium">Sunday</span>
                <button
                  type="button"
                  onClick={() => setSkipSunday(!skipSunday)}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: skipSunday ? "var(--primary)" : "var(--border)" }}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      skipSunday ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">
              Toggle off to allow the scheduler to run on that day.
            </p>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 text-white rounded-xl font-medium text-sm disabled:opacity-50 transition-all bg-primary hover:bg-primary-hover"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Validating & Saving...
              </span>
            ) : (
              "Save Settings"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
