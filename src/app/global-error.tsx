"use client";

import { useEffect } from "react";

/**
 * The boundary for a failure in the root layout itself — the one case the
 * route-level `error.tsx` cannot catch, because that file renders *inside* the
 * layout. It has to carry its own `<html>` and `<body>`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e4e6e9",
          color: "#1d2329",
          fontFamily: '"IBM Plex Sans", Arial, sans-serif',
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 480,
            padding: "24px",
            textAlign: "center",
            background: "#ffffff",
            border: "1px solid #dcdfe3",
            borderRadius: 3,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6c7682",
            }}
          >
            Something broke
          </p>
          <h1 style={{ fontSize: 22, margin: "10px 0 0", fontWeight: 700 }}>The site hit an error</h1>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "#4b5560", margin: "10px 0 0" }}>
            The page failed before it could render. Retrying usually works; the official site is
            the source of truth.
          </p>
          {error.digest ? (
            <p
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "2px 8px",
                border: "1px solid #dcdfe3",
                borderRadius: 3,
                fontSize: 11,
                color: "#6c7682",
              }}
            >
              ref {error.digest}
            </p>
          ) : null}
          <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#1f2933",
                color: "#ffffff",
                border: "none",
                borderRadius: 3,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="https://www.pbatour.org/en/index"
              target="_blank"
              rel="noreferrer noopener"
              style={{
                border: "1px solid #c9ced4",
                borderRadius: 3,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#1d2329",
                textDecoration: "none",
              }}
            >
              pbatour.org ↗
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
