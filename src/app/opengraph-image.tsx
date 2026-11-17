import { ImageResponse } from "next/og";

/**
 * The social card, rendered once at build time. The palette mirrors the site:
 * near-black baize, one lime accent. The default satori font carries the type —
 * no custom font is worth shipping for one image.
 */
export const alt = "PBA Hub — Professional Billiards Association";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 84,
          background: "linear-gradient(135deg, #040507 0%, #0b0e13 60%, #10160c 100%)",
          color: "#f4f5f1",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#d4ff4a",
              color: "#040507",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            8
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em" }}>PBA HUB</span>
            <span style={{ fontSize: 20, color: "#79828e", letterSpacing: "0.14em" }}>
              BILLIARDS ASSOCIATION
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            Every table, every frame
          </span>
          <span style={{ fontSize: 28, color: "#9aa1a9", marginTop: 18 }}>
            Live scores, schedule, rankings and the full PBA / LPBA tour calendar
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: "#79828e" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ff3d1f" }} />
          <span>pbatour.org data · updated through the day</span>
        </div>
      </div>
    ),
    size,
  );
}
