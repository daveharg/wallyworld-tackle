// Winnipeg local-time helpers for the Vercel Cron auto-post gate.
//
// Vercel cron schedules are UTC-only, and Manitoba alternates between CDT
// (UTC-5) and CST (UTC-6), so vercel.json registers TWO UTC slots per job
// (one for each offset). Only the slot that lands on the job's Winnipeg
// target window may actually run — this module decides. The scripts'
// already-posted dedupe remains the second line of defence.
//
// Pure module (no imports) so the gate can be unit-exercised standalone.

export interface WinnipegParts {
  hour: number; // 0–23, America/Winnipeg
  minute: number; // 0–59
  weekday: number; // 0 = Sunday … 6 = Saturday, Winnipeg calendar day
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

export function winnipegParts(d: Date): WinnipegParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Winnipeg",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  // Weekday of the Winnipeg calendar date (UTC weekday of that Y/M/D is the
  // same civil weekday).
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    hour: get("hour") % 24, // guard the legacy "24" midnight quirk
    minute: get("minute"),
    weekday,
    year,
    month,
    day,
  };
}

export interface JobWindow {
  /** Winnipeg hour the job must run in (the cron slots fire at :00 UTC). */
  hour: number;
  /** Winnipeg weekdays the job runs on (0 = Sunday); null = every day. */
  weekdays: number[] | null;
}

export const JOB_WINDOWS: Record<string, JobWindow> = {
  // Dave's schedule (America/Winnipeg): weather 05:00 daily, video 07:00
  // daily, weekly content at 09:xx — tip Mon, ice Tue, hotspot Wed,
  // lake Fri, lodge Sun (the tip job also runs the ads pass). Tech
  // spotlight Thu: a weekly slot, but the job itself enforces biweekly
  // spacing (13 days) in lib/fish/autopost-server.ts.
  weather: { hour: 5, weekdays: null },
  video: { hour: 7, weekdays: null },
  tip: { hour: 9, weekdays: [1] },
  ice: { hour: 9, weekdays: [2] },
  hotspot: { hour: 9, weekdays: [3] },
  lake: { hour: 9, weekdays: [5] },
  lodge: { hour: 9, weekdays: [0] },
  tech: { hour: 9, weekdays: [4] },
};

/** True when `d` falls inside job's Winnipeg target window. */
export function isInJobWindow(job: string, d: Date): boolean {
  const w = JOB_WINDOWS[job];
  if (!w) return false;
  const p = winnipegParts(d);
  if (p.hour !== w.hour) return false;
  if (w.weekdays && !w.weekdays.includes(p.weekday)) return false;
  return true;
}
