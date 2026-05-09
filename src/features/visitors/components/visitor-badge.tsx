"use client";

import { forwardRef, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

export type VisitorBadgeFormat = "A6" | "A7";

export interface VisitorBadgeData {
  tenantName: string;
  logoUrl?: string;
  visitorName: string;
  company?: string;
  purpose?: string;
  hostName?: string;
  departmentName?: string;
  statusLabel: string;
  badgeQrToken: string;
  /** Unix seconds. */
  badgeExpiry?: number;
  /** Unix seconds. */
  issuedAt?: number;
  /** Hex color for the header background — falls back to slate. */
  primaryColor?: string;
}

interface VisitorBadgeProps {
  data: VisitorBadgeData;
  format: VisitorBadgeFormat;
}

const A6 = { width: 105, height: 148 } as const;
const A7 = { width: 74, height: 105 } as const;

function dimsFor(format: VisitorBadgeFormat) {
  return format === "A6" ? A6 : A7;
}

function scaleFor(format: VisitorBadgeFormat) {
  return format === "A6" ? 1 : 0.72;
}

function formatUnixUtc(seconds?: number) {
  if (!seconds) return "—";
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "VC";
}

/**
 * Print-accurate visitor badge. Sized in mm so the rendered DOM matches
 * its A6/A7 print footprint exactly. The same node is what
 * `printVisitorBadge`/`downloadVisitorBadgePdf` capture, so anything
 * styled here lands on the page or PDF unchanged.
 *
 * The on-screen preview wrapper applies a `transform: scale(...)` so
 * smaller A7 badges feel readable in a modal — the underlying mm
 * geometry is preserved for export.
 */
export const VisitorBadge = forwardRef<HTMLDivElement, VisitorBadgeProps>(
  function VisitorBadge({ data, format }, ref) {
    const { width, height } = dimsFor(format);
    const isA6 = format === "A6";
    const fontScale = isA6 ? 1.4 : 1;
    const primary = data.primaryColor || "#0f172a";

    const initials = useMemo(
      () => initialsFromName(data.tenantName),
      [data.tenantName],
    );

    return (
      <div
        ref={ref}
        data-badge-format={format}
        style={{
          width: `${width}mm`,
          height: `${height}mm`,
          background: "#ffffff",
          color: "#020617",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily:
            '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "-9mm",
            bottom: "30mm",
            transform: "rotate(-90deg)",
            fontSize: `${19 * fontScale}px`,
            fontWeight: 950,
            color: "rgba(15, 23, 42, 0.045)",
            letterSpacing: "0.08em",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          VISITOR
        </div>

        <header
          style={{
            background: `linear-gradient(135deg, ${primary}, ${shade(primary, 14)})`,
            color: "#ffffff",
            padding: "4.5mm 5mm 4mm",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "3mm",
              marginBottom: "4mm",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2.5mm",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: "11mm",
                  height: "11mm",
                  background: "#ffffff",
                  borderRadius: "2.5mm",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  flex: "0 0 auto",
                }}
              >
                {data.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.logoUrl}
                    alt=""
                    crossOrigin="anonymous"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      padding: "1.4mm",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      color: "#0f172a",
                      fontSize: `${9 * fontScale}px`,
                      fontWeight: 950,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {initials}
                  </span>
                )}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: `${(data.tenantName.length > 22 ? 7 : 8) * fontScale}px`,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    lineHeight: 1.1,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {data.tenantName}
                </div>
                <div
                  style={{
                    fontSize: `${6.5 * fontScale}px`,
                    marginTop: "0.7mm",
                    color: "#cbd5e1",
                  }}
                >
                  Visitor Management
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#dcfce7",
                color: "#166534",
                borderRadius: "999px",
                padding: "1.3mm 2.2mm",
                fontSize: `${6.3 * fontScale}px`,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              {data.statusLabel}
            </div>
          </div>

          <div
            style={{
              fontSize: `${19 * fontScale}px`,
              lineHeight: 1,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Visitor
          </div>
          <div
            style={{
              marginTop: "1.3mm",
              fontSize: `${7 * fontScale}px`,
              color: "#cbd5e1",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            Temporary access badge
          </div>
        </header>

        <section
          style={{
            padding: "4mm 5mm 3.5mm",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "3mm",
          }}
        >
          <div
            style={{
              borderBottom: "0.35mm solid #f1f5f9",
              paddingBottom: "3mm",
            }}
          >
            <div
              style={{
                fontSize: `${6.3 * fontScale}px`,
                color: "#64748b",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
                marginBottom: "1.2mm",
              }}
            >
              Visitor name
            </div>
            <div
              style={{
                fontSize: `${18 * fontScale}px`,
                lineHeight: 1.05,
                fontWeight: 950,
                letterSpacing: "-0.045em",
                color: "#020617",
                overflowWrap: "anywhere",
              }}
            >
              {data.visitorName || "—"}
            </div>
            {data.company && (
              <div
                style={{
                  marginTop: "1.4mm",
                  fontSize: `${8.5 * fontScale}px`,
                  fontWeight: 750,
                  color: "#334155",
                  overflowWrap: "anywhere",
                }}
              >
                {data.company}
              </div>
            )}
          </div>

          <div
            style={{
              border: "0.35mm solid #dbeafe",
              background: "#eff6ff",
              borderRadius: "3mm",
              padding: "2.4mm 3mm",
            }}
          >
            <div
              style={{
                fontSize: `${6.2 * fontScale}px`,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#2563eb",
                marginBottom: "1mm",
              }}
            >
              Purpose of visit
            </div>
            <div
              style={{
                fontSize: `${10 * fontScale}px`,
                lineHeight: 1.18,
                fontWeight: 900,
                color: "#020617",
                overflowWrap: "anywhere",
              }}
            >
              {data.purpose || "General visit"}
            </div>
          </div>

          <div style={{ display: "grid", gap: "1.7mm" }}>
            <BadgeDetailRow
              label="Host"
              value={data.hostName || "—"}
              fontScale={fontScale}
            />
            <BadgeDetailRow
              label="Dept."
              value={data.departmentName || "—"}
              fontScale={fontScale}
            />
            <BadgeDetailRow
              label="Issued"
              value={formatUnixUtc(data.issuedAt)}
              fontScale={fontScale}
            />
            <BadgeDetailRow
              label="Expires"
              value={formatUnixUtc(data.badgeExpiry)}
              fontScale={fontScale}
            />
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "grid",
              gridTemplateColumns: isA6 ? "32mm 1fr" : "25mm 1fr",
              gap: "3mm",
              alignItems: "center",
              background: "#f1f5f9",
              border: "0.35mm solid #e2e8f0",
              borderRadius: "3mm",
              padding: "2.5mm",
            }}
          >
            <div
              style={{
                width: isA6 ? "30mm" : "24mm",
                height: isA6 ? "30mm" : "24mm",
                background: "#ffffff",
                border: "0.35mm solid #e2e8f0",
                borderRadius: "2mm",
                padding: "1.2mm",
                display: "grid",
                placeItems: "center",
              }}
            >
              <QRCodeSVG
                value={data.badgeQrToken}
                size={isA6 ? 220 : 170}
                level="M"
                marginSize={0}
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: `${7.3 * fontScale}px`,
                  fontWeight: 950,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#0f172a",
                  marginBottom: "1.4mm",
                }}
              >
                Scan to check out
              </div>
              <div
                style={{
                  fontSize: `${6 * fontScale}px`,
                  color: "#64748b",
                  marginBottom: "1.4mm",
                  lineHeight: 1.25,
                }}
              >
                Reception will scan this QR or enter the code below to end the
                visit.
              </div>
              <div
                style={{
                  fontSize: `${6.5 * fontScale}px`,
                  lineHeight: 1.15,
                  color: "#0f172a",
                  fontWeight: 900,
                  fontFamily:
                    '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                  overflowWrap: "anywhere",
                  letterSpacing: "0.02em",
                }}
              >
                {data.badgeQrToken}
              </div>
            </div>
          </div>
        </section>

        <footer
          style={{
            height: "8.5mm",
            display: "grid",
            placeItems: "center",
            background: `repeating-linear-gradient(45deg, ${primary}, ${primary} 2mm, ${shade(primary, 14)} 2mm, ${shade(primary, 14)} 4mm)`,
            color: "#ffffff",
            fontSize: `${6.4 * fontScale}px`,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
          }}
        >
          Authorized Visit Only
        </footer>
      </div>
    );
  },
);

interface DetailRowProps {
  label: string;
  value: string;
  fontScale: number;
}

function BadgeDetailRow({ label, value, fontScale }: DetailRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18mm 1fr",
        gap: "2mm",
        fontSize: `${7.2 * fontScale}px`,
        lineHeight: 1.2,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#020617",
          fontWeight: 750,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Returns a slightly lighter/darker variant of `hex` by `delta` percent
 * lightness. Used to derive the header gradient stop and the footer
 * stripe color from a single `primaryColor` input. Falls back to the
 * original color on any parse failure.
 */
function shade(hex: string, delta: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const adjust = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (255 - c) * (delta / 100))));
  const rr = adjust(r).toString(16).padStart(2, "0");
  const gg = adjust(g).toString(16).padStart(2, "0");
  const bb = adjust(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

export const visitorBadgeScale = scaleFor;
export const visitorBadgeDims = dimsFor;
