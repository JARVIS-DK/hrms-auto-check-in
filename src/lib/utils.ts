import { toZonedTime } from "date-fns-tz";
import { format, isWeekend } from "date-fns";

const IST = "Asia/Kolkata";

export function nowIST(): Date {
  return toZonedTime(new Date(), IST);
}

export function todayIST(): string {
  return format(nowIST(), "yyyy-MM-dd");
}

export function isWeekendIST(): boolean {
  return isWeekend(nowIST());
}

export function randomDelay(maxMinutes: number): number {
  return Math.floor(Math.random() * maxMinutes * 60 * 1000);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
