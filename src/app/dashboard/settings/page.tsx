"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [hrmsEmail, setHrmsEmail] = useState("");
  const [hrmsPassword, setHrmsPassword] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [checkinStart, setCheckinStart] = useState("");
  const [checkinEnd, setCheckinEnd] = useState("");
  const [checkoutStart, setCheckoutStart] = useState("");
  const [checkoutEnd, setCheckoutEnd] = useState("");
  const [skipSaturday, setSkipSaturday] = useState(true);
  const [skipSunday, setSkipSunday] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setHrmsEmail(data.hrmsEmail || "");
        setLatitude(data.latitude || "");
        setLongitude(data.longitude || "");
        setCheckinStart(data.checkinStart || "");
        setCheckinEnd(data.checkinEnd || "");
        setCheckoutStart(data.checkoutStart || "");
        setCheckoutEnd(data.checkoutEnd || "");
        setSkipSaturday(data.skipSaturday ?? true);
        setSkipSunday(data.skipSunday ?? true);
        setHasPassword(data.hasPassword || false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const body: Record<string, unknown> = {
      hrmsEmail,
      latitude,
      longitude,
      checkinStart,
      checkinEnd,
      checkoutStart,
      checkoutEnd,
      skipSaturday,
      skipSunday,
    };
    if (hrmsPassword) body.hrmsPassword = hrmsPassword;

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage("Settings saved!");
      setHasPassword(true);
      setHrmsPassword("");
    } else {
      setMessage("Failed to save settings");
    }
    setSaving(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toString());
        setLongitude(pos.coords.longitude.toString());
        setMessage("Location captured successfully");
        setLocating(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setMessage("Location permission denied. Please allow location access in your browser.");
            break;
          case err.POSITION_UNAVAILABLE:
            setMessage("Location unavailable. Try again or enter manually.");
            break;
          case err.TIMEOUT:
            setMessage("Location request timed out. Try again.");
            break;
          default:
            setMessage("Could not get location. Please enter manually.");
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
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-6">HRMS Settings</h2>
      <form onSubmit={handleSave} className="space-y-5">
        {/* Credentials */}
        <div>
          <label className="block text-sm font-medium mb-1">HRMS Email</label>
          <input
            type="email"
            value={hrmsEmail}
            onChange={(e) => setHrmsEmail(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="you@company.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            HRMS Password{" "}
            {hasPassword && (
              <span className="text-muted">(leave blank to keep current)</span>
            )}
          </label>
          <input
            type="password"
            value={hrmsPassword}
            onChange={(e) => setHrmsPassword(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={hasPassword ? "********" : "Enter password"}
            required={!hasPassword}
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Latitude</label>
            <input
              type="text"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="11.0452..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Longitude</label>
            <input
              type="text"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="76.9266..."
              required
            />
          </div>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {locating ? "Getting location..." : "Use my current location"}
        </button>

        {/* Schedule Intervals */}
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-semibold mb-3">
            Schedule Intervals{" "}
            <span className="text-muted font-normal">(optional — defaults: check-in 09:30–10:00, check-out 18:00–18:45)</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Check-in From</label>
              <input
                type="time"
                value={checkinStart}
                onChange={(e) => setCheckinStart(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Check-in To</label>
              <input
                type="time"
                value={checkinEnd}
                onChange={(e) => setCheckinEnd(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Check-out From</label>
              <input
                type="time"
                value={checkoutStart}
                onChange={(e) => setCheckoutStart(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Check-out To</label>
              <input
                type="time"
                value={checkoutEnd}
                onChange={(e) => setCheckoutEnd(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-xs text-muted mt-2">
            The scheduler will randomly pick a time within the interval. Leave blank to use defaults.
          </p>
        </div>

        {/* Weekend Toggles */}
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-semibold mb-3">Skip Weekends</h3>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setSkipSaturday(!skipSaturday)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  skipSaturday ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    skipSaturday ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm">Skip Saturday</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <button
                type="button"
                onClick={() => setSkipSunday(!skipSunday)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  skipSunday ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    skipSunday ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm">Skip Sunday</span>
            </label>
          </div>
          <p className="text-xs text-muted mt-2">
            Toggle off to allow scheduler to run on that day.
          </p>
        </div>

        {message && (
          <p
            className={`text-sm ${
              message.includes("saved") || message.includes("captured")
                ? "text-success"
                : "text-danger"
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
