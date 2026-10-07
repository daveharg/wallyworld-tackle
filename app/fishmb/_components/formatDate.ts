// Server-safe date formatting (no "use client" — importable from server components).

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
