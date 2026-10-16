import { ImageResponse } from "next/og";
import { getTournament } from "@/lib/fish/tournaments";
import { formatDateTime } from "../../_components/formatDate";

/**
 * Branded share card for tournaments without a cover photo — the
 * "fancy link art" a challenge link unfurls with in chat apps.
 * Tournaments WITH a cover photo use the photo itself (see
 * generateMetadata in the page). Kept deliberately simple: brand
 * colours, the tournament name, species and dates.
 */
export const runtime = "nodejs";
export const alt = "FishMB tournament challenge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const t = await getTournament(params.id);
  const name = t?.name ?? "FishMB Tournament";
  const species = t?.species?.length ? t.species.join(", ") : "All species";
  const dates = t ? `${formatDateTime(t.starts_at)} → ${formatDateTime(t.ends_at)}` : "";
  const fee = t?.entry_fee_cents ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#072838",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{ color: "#FFFFFF" }}>Fish</span>
            <span style={{ color: "#0891B2" }}>MB</span>
          </div>
          <div
            style={{
              color: "#CA8804",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            Tournament challenge
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: name.length > 42 ? 64 : 80,
              fontWeight: 700,
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            {name}
          </div>
          <div style={{ color: "#E0E9F0", fontSize: 32, marginTop: 24 }}>
            {species}
            {dates ? ` · ${dates}` : ""}
          </div>
          <div style={{ color: "#E0E9F0", fontSize: 32, marginTop: 6 }}>
            {fee > 0
              ? `Entry $${(fee / 100).toFixed(fee % 100 === 0 ? 0 : 2)}`
              : "Free entry"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              backgroundColor: "#CA8804",
              color: "#072838",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              borderRadius: 999,
              padding: "14px 32px",
            }}
          >
            Tap to accept the challenge
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
