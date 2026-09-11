"use client";

/**
 * Root-level error boundary. Required to render its own <html>/<body> because
 * it replaces the root layout when that is what failed. Styling is inline /
 * token-matched to the Gold/Slate system so the brand holds even here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0E14",
          color: "#F8FAFC",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            border: "1px solid rgba(223,178,96,0.20)",
            borderRadius: "1.5rem",
            background: "#161B22",
            padding: "2.5rem 1.5rem",
          }}
        >
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.875rem", margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#94A3B8", fontSize: "0.875rem", marginTop: "0.75rem" }}>
            We hit an unexpected snag. It has been logged — please try again.
          </p>
          {error?.digest ? (
            <p style={{ color: "#64748B", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              border: 0,
              borderRadius: "9999px",
              background: "#DFB260",
              color: "#0B0E14",
              fontWeight: 600,
              fontSize: "0.875rem",
              padding: "0.75rem 1.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
