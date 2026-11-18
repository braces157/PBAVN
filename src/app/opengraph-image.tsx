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
          backgroundColor: "#e4e6e9",
          color: "#1d2329",
          padding: "56px 64px",
          borderTop: "10px solid #1f2933",
          borderBottom: "8px solid #e9b31c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#fbfaf6", border: "2px solid #c9ced4" }} />
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#e9b31c", border: "2px solid #c8960c" }} />
            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#d6322a", border: "2px solid #a01f19" }} />
          </div>
          <span style={{ fontSize: "34px", fontWeight: 900, letterSpacing: "-0.02em" }}>
            PBA<span style={{ color: "#e9b31c", backgroundColor: "#1f2933", padding: "2px 8px", borderRadius: "4px", marginLeft: "4px" }}>HUB</span>
          </span>
          <span style={{ fontSize: "18px", color: "#4b5560", marginLeft: "12px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            3-Cushion Stats &amp; Live Match Centre
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", backgroundColor: "#ffffff", border: "1px solid #dcdfe3", borderRadius: "4px", padding: "32px" }}>
          <div style={{ fontSize: "64px", fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
            Scores, Stats &amp; Standings
          </div>
          <div style={{ fontSize: "24px", color: "#4b5560", lineHeight: 1.35 }}>
            Live carom match centres, inning-by-inning scorecards, prize rankings, and PBA Team League standings.
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", fontSize: "18px", color: "#1d2329", fontWeight: 700 }}>
          <span>PBA Tour</span>
          <span>·</span>
          <span style={{ color: "#c2185b" }}>LPBA Tour</span>
          <span>·</span>
          <span style={{ color: "#c8960c" }}>Dream Tour</span>
          <span>·</span>
          <span style={{ color: "#1d4f91" }}>Team League</span>
        </div>
      </div>
    ),
    size,
  );
}
