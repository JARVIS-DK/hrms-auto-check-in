"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/Modal";
import LoadError from "@/components/ui/LoadError";
import { useBlockPullRefresh, useRegisterPullRefresh } from "@/components/ui/PullToRefresh";
import TimeInput from "@/components/ui/TimeInput";
import PasswordInput from "@/components/ui/PasswordInput";
import { LockIcon, MapPinIcon, CrosshairIcon, ClockIcon, CalendarIcon, TrashIcon } from "@/components/ui/icons";

type TimeKey =
  | "checkinStart"
  | "checkinEnd"
  | "checkoutStart"
  | "checkoutEnd"
  | "halfDayCheckinStart"
  | "halfDayCheckinEnd"
  | "halfDayCheckoutStart"
  | "halfDayCheckoutEnd";

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
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [windowErrors, setWindowErrors] = useState<Partial<Record<string, string>>>({});
  const [clearConfirm, setClearConfirm] = useState(false);
  const snapshotRef = useRef("");
  const windowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadError("");

    Promise.all([
      fetch("/api/settings").then(async (r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      }),
      fetch("/api/global-defaults")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([data, defaultsData]) => {
        if (cancelled) return;
        const nextTimes = Object.fromEntries(
          TIME_KEYS.map((k) => [k, data[k] || ""])
        ) as Record<TimeKey, string>;
        setHrmsEmail(data.hrmsEmail || "");
        setLatitude(data.latitude || "");
        setLongitude(data.longitude || "");
        setTimes(nextTimes);
        setSkipSaturday(data.skipSaturday ?? true);
        setSkipSunday(data.skipSunday ?? true);
        setAutomationEnabled(data.automationEnabled || false);
        setHasPassword(data.hasPassword || false);
        setHrmsPassword("");
        if (defaultsData) setDefaults(defaultsData);
        snapshotRef.current = JSON.stringify({
          hrmsEmail: data.hrmsEmail || "",
          latitude: data.latitude || "",
          longitude: data.longitude || "",
          times: nextTimes,
          skipSaturday: data.skipSaturday ?? true,
          skipSunday: data.skipSunday ?? true,
          hrmsPassword: "",
        });
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoadError(err.message || "Failed to load settings");
        setLoaded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const dirty = useMemo(() => {
    if (!loaded) return false;
    return (
      JSON.stringify({
        hrmsEmail,
        latitude,
        longitude,
        times,
        skipSaturday,
        skipSunday,
        hrmsPassword,
      }) !== snapshotRef.current
    );
  }, [loaded, hrmsEmail, latitude, longitude, times, skipSaturday, skipSunday, hrmsPassword]);

  useBlockPullRefresh(dirty);
  useRegisterPullRefresh(() => {
    if (dirty) return;
    setReloadKey((k) => k + 1);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function getDefaultTimes() {
    const now = new Date();
    const start = new Date(now.getTime() - 60000);
    const end = new Date(now.getTime() + 30 * 60000);
    const fmt = (d: Date) =>
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { start: fmt(start), end: fmt(end) };
  }

  function setTime(key: TimeKey, value: string) {
    setTimes((prev) => ({ ...prev, [key]: value }));
    setWindowErrors((prev) => {
      const next = { ...prev };
      for (const w of WINDOWS) {
        if (w.start === key || w.end === key) delete next[w.label];
      }
      return next;
    });
  }

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
    if (!loaded) return;

    const errors: Partial<Record<string, string>> = {};
    for (const window of WINDOWS) {
      const start = times[window.start];
      const end = times[window.end];
      if (start && end && start >= end) {
        errors[window.label] = "Start time must be before end time";
      } else if (Boolean(start) !== Boolean(end)) {
        errors[window.label] = "Set both times, or leave both blank";
      }
    }
    setWindowErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.keys(errors)[0];
      windowRefs.current[first]?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(errors[first] || "Fix the highlighted windows", "error");
      return;
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
        snapshotRef.current = JSON.stringify({
          hrmsEmail,
          latitude,
          longitude,
          times,
          skipSaturday,
          skipSunday,
          hrmsPassword: "",
        });
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

  if (loadError && !loaded) {
    return (
      <div className="w-full max-w-xl 2xl:max-w-3xl mx-auto">
        <LoadError message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl 2xl:max-w-3xl mx-auto space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted mt-0.5">Configure your HRMS credentials and scheduler preferences</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-card/80 border border-border rounded-2xl p-5 space-y-4 shadow-[var(--shadow)]">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <LockIcon size={16} />
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

          <div className="bg-card/80 border border-border rounded-2xl p-5 space-y-4 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPinIcon size={16} />
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
                    <CrosshairIcon size={12} />
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
                  inputMode="decimal"
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
                  inputMode="decimal"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder="76.9266..."
                  required
                />
              </div>
            </div>
          </div>

          <div className="bg-card/80 border border-border rounded-2xl p-5 space-y-4 shadow-[var(--shadow)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ClockIcon size={16} />
                Schedule Intervals
              </h3>
              {TIME_KEYS.some((k) => times[k]) && (
                <button
                  type="button"
                  onClick={() => setClearConfirm(true)}
                  className="px-2.5 py-1 text-xs font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-input rounded-xl">
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
                aria-pressed={automationEnabled}
                aria-label={automationEnabled ? "Disable automation" : "Enable automation"}
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

            {WINDOWS.map((window) => {
              const err = windowErrors[window.label];
              return (
                <div
                  key={window.label}
                  ref={(el) => {
                    windowRefs.current[window.label] = el;
                  }}
                >
                  <label className="block text-xs font-medium text-muted">{window.label} Window</label>
                  <p className="text-[11px] text-muted/70 mb-2">
                    {window.hint}
                    {defaults ? ` · default ${formatTimeRange(defaults[window.start], defaults[window.end])}` : ""}
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
                  {err && (
                    <p className="mt-1.5 text-xs text-danger" role="alert">
                      {err}
                    </p>
                  )}
                </div>
              );
            })}

            <p className="text-xs text-muted">
              The scheduler randomly picks a time within each window. Leave blank to use the
              defaults shown above. Half-day windows apply on days you mark as half-day leave —
              and you can override them for a single day when adding that leave.
            </p>
          </div>

          <div className="bg-card/80 border border-border rounded-2xl p-5 space-y-4 shadow-[var(--shadow)]">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon size={16} />
              Skip Days
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-input rounded-xl">
                <span className="text-sm font-medium">Saturday</span>
                <button
                  type="button"
                  onClick={() => setSkipSaturday(!skipSaturday)}
                  aria-pressed={skipSaturday}
                  aria-label={skipSaturday ? "Run scheduler on Saturday" : "Skip Saturday"}
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
              <div className="flex items-center justify-between p-3 bg-input rounded-xl">
                <span className="text-sm font-medium">Sunday</span>
                <button
                  type="button"
                  onClick={() => setSkipSunday(!skipSunday)}
                  aria-pressed={skipSunday}
                  aria-label={skipSunday ? "Run scheduler on Sunday" : "Skip Sunday"}
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

        <ConfirmDialog
          open={clearConfirm}
          onCancel={() => setClearConfirm(false)}
          onConfirm={() => {
            setTimes(EMPTY_TIMES);
            setWindowErrors({});
            setClearConfirm(false);
          }}
          title="Clear all time windows?"
          message="This clears your custom check-in and check-out windows. Defaults will be used until you set new times."
          confirmLabel="Clear all"
          tone="danger"
          icon={<TrashIcon size={24} stroke="var(--danger)" />}
        />
    </div>
  );
}
