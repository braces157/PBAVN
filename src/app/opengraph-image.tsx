import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#f3efe6",
          color: "#151412",
          padding: "56px 64px",
          borderTop: "10px solid #151412",
          borderBottom: "10px solid #cf2a1f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#fbfaf6", border: "2px solid #cfc6b3" }} />
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#e8b520", border: "2px solid #b98a0c" }} />
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#cf2a1f", border: "2px solid #8f1610" }} />
          </div>
          <span style={{ fontSize: "34px", fontWeight: 900, letterSpacing: "-0.02em" }}>
            PBA<span style={{ color: "#cf2a1f" }}>HUB</span>
          </span>
          <span style={{ fontSize: "18px", color: "#6b6554", marginLeft: "12px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            3-Cushion Broadsheet &amp; Scoreboard
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", borderTop: "3px solid #151412", paddingTop: "28px" }}>
          <div style={{ fontSize: "72px", fontWeight: 900, lineHeight: 0.96, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
            Scores, Stats &amp; Standings
          </div>
          <div style={{ fontSize: "26px", color: "#45413a", lineHeight: 1.35 }}>
            Live carom match centres, inning-by-inning charts, prize rankings, and PBA Team League standings.
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", fontSize: "18px", color: "#151412", fontWeight: 800, borderTop: "2px solid #cfc6b3", paddingTop: "20px", textTransform: "uppercase" }}>
          <span>PBA Tour</span>
          <span>·</span>
          <span style={{ color: "#cf2a1f" }}>LPBA Tour</span>
          <span>·</span>
          <span>Dream Tour</span>
          <span>·</span>
          <span style={{ color: "#1d4f91" }}>Team League</span>
        </div>
      </div>
    ),
    size,
  );
}
