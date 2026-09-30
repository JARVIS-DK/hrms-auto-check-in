"use client";

import { useRegisterPullRefresh } from "@/components/ui/PullToRefresh";
import AttendanceCalendar from "@/components/AttendanceCalendar";

export default function AttendancePage() {
  useRegisterPullRefresh(() => {}, []);

  return (
    <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Attendance</h2>
        <p className="text-sm text-muted mt-0.5">Monthly calendar with daily working hours</p>
      </div>
      <AttendanceCalendar fetchUrl="/api/attendance" />
    </div>
  );
}
