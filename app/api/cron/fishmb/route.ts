// GET /api/cron/fishmb?job=weather|video|tip|hotspot|lake|lodge|ice|monitor
// (job=monitor is the admin-alerts backstop sweep — see lib/fish/admin-alerts.ts)
//
// Server-side FishMB auto-posts, triggered by Vercel Cron (see
// vercel.json). Replaces the VM cron jobs that had to fetch DATABASE_URL
// out of the Vercel dashboard through a browser helper on every run —
// the helper intermittently refused to hand over the secret. Here the
// app uses its own environment, so no credential retrieval exists.
//
// Auth, two ways:
//  1. Vercel Cron: header `authorization: Bearer ${CRON_SECRET}`
//     (Vercel sends this automatically when CRON_SECRET is set).
//     Cron calls ALWAYS respect the Winnipeg-time window gate: two UTC
//     slots are registered per job (CDT + CST), and only the slot that
//     lands in the job's Winnipeg window actually posts.
//  2. An authenticated FishMB admin (same check as every admin API) may
//     call a job manually — e.g. to fire today's video right after a
//     deploy. With `force=1` the admin path bypasses the window gate;
//     the scripts' already-posted dedupe still applies either way.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest } from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import {
  AUTOPOST_JOBS,
  runAutopostJob,
  type AutopostJob,
} from "@/lib/fish/autopost-server";
import { isInJobWindow } from "@/lib/fish/winnipeg-time";
import { sweepAdminAlerts } from "@/lib/fish/admin-alerts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jobParam = req.nextUrl.searchParams.get("job") ?? "";
  const isJob = (AUTOPOST_JOBS as string[]).includes(jobParam);

  // Path 1 — Vercel Cron bearer.
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const viaCron = !!secret && authHeader === `Bearer ${secret}`;

  // Path 2 — FishMB admin session (the app's existing admin check).
  let viaAdmin = false;
  if (!viaCron) {
    const me = await fishUserFromRequest(req).catch(() => null);
    viaAdmin = !!me && isAdminEmail(me.email);
  }

  if (!viaCron && !viaAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // job=monitor — the admin-alerts backstop sweep. Not an auto-post:
  // no Winnipeg window gate (a waiting report matters at any hour),
  // it only summary-pushes items that never got an instant alert.
  if (jobParam === "monitor") {
    try {
      const result = await sweepAdminAlerts();
      return NextResponse.json({ ok: true, job: "monitor", ...result });
    } catch (err) {
      console.error("[cron/fishmb] monitor sweep failed:", err);
      return NextResponse.json(
        { error: "Monitor sweep failed.", detail: String(err).slice(0, 300) },
        { status: 500 }
      );
    }
  }

  if (!isJob) {
    return NextResponse.json(
      { error: `Unknown job: ${jobParam || "(missing)"}` },
      { status: 400 }
    );
  }
  const job = jobParam as AutopostJob;

  // Window gate: always for cron; for admins only force=1 bypasses it.
  const force = viaAdmin && req.nextUrl.searchParams.get("force") === "1";
  if (!force && !isInJobWindow(job, new Date())) {
    return NextResponse.json({ skipped: "window", job });
  }

  try {
    const result = await runAutopostJob(job);
    return NextResponse.json({ ok: true, forced: force, ...result });
  } catch (err) {
    console.error(`[cron/fishmb] job ${job} failed:`, err);
    return NextResponse.json(
      { error: `Job ${job} failed.`, detail: String(err).slice(0, 300) },
      { status: 500 }
    );
  }
}
