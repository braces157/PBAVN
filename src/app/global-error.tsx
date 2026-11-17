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
          background: "#f3efe6",
          color: "#151412",
          fontFamily:
            "var(--font-inter), Inter, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div
          role="alert"
          style={{ maxWidth: 480, padding: "0 1rem", textAlign: "center" }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#55514a",
            }}
          >
            Something broke
          </p>
          <h1 style={{ fontSize: 24, margin: "12px 0 0", fontWeight: 700 }}>The site hit an error</h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#55514a", margin: "12px 0 0" }}>
            The page failed before it could render. Retrying usually works; the official site is
            the source of truth.
          </p>
          {error.digest ? (
            <p
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "2px 8px",
                border: "1px solid #d6d0c2",
                borderRadius: 0,
                fontSize: 10.5,
                color: "#55514a",
              }}
            >
              ref {error.digest}
            </p>
          ) : null}
          <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#151412",
                color: "#f3efe6",
                border: "none",
                borderRadius: 0,
                padding: "10px 16px",
                fontSize: 13,
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
                border: "1px solid #d6d0c2",
                borderRadius: 0,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: "#151412",
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
