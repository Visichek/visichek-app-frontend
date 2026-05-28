"use client";

import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export type PrintBadgeFormat = "A6" | "A7";

export interface PrintBadgeData {
  /** Who the visitor is visiting — always shown. */
  tenantName: string;
  /**
   * Resolved tenant logo URL. Rendered grayscale so the badge stays
   * monochrome. Pass undefined when the tenant has no branding ability —
   * the badge then falls back to the VisiChek mark only.
   */
  tenantLogoUrl?: string;
  visitorName: string;
  company?: string;
  purpose?: string;
  hostName?: string;
  departmentName?: string;
  /** Short status label — accepted for compatibility, not rendered. */
  statusLabel: string;
  /** The badge QR token — encoded in the QR. */
  qrToken: string;
  /** Unix epoch seconds — accepted for compatibility, not rendered. */
  issuedAt?: number;
  /** Unix epoch seconds — accepted for compatibility, not rendered. */
  expiresAt?: number;
}

interface PrintBadgeProps {
  data: PrintBadgeData;
  format: PrintBadgeFormat;
}

const DIMS = {
  A6: { width: 105, height: 148 },
  A7: { width: 74, height: 105 },
} as const;

const INK = "#000000";
const PAPER = "#ffffff";

export function printBadgeDims(format: PrintBadgeFormat) {
  return DIMS[format];
}

/**
 * Per-format spacing/typography knobs. The badge is a minimal,
 * QR-centric pass: tenant mark + name, "VISITOR PASS" headline, a
 * dominant QR, and a thin "Powered by VisiChek" footer. A7 is just
 * the same composition shrunk to fit 74×105mm.
 */
const SIZES: Record<
  PrintBadgeFormat,
  {
    framePad: string;
    headerGap: string;
    logoSize: string;
    tenantNameFs: number;
    tenantSubFs: number;
    titleFs: number;
    qrSize: string;
    footerGap: string;
    footerLogo: string;
    footerFs: number;
    ruleMb: string;
  }
> = {
  A6: {
    framePad: "8mm 8mm 6mm",
    headerGap: "3.2mm",
    logoSize: "12mm",
    tenantNameFs: 16,
    tenantSubFs: 7,
    titleFs: 26,
    qrSize: "78mm",
    footerGap: "2mm",
    footerLogo: "4mm",
    footerFs: 8,
    ruleMb: "3mm",
  },
  A7: {
    framePad: "5mm 5mm 4mm",
    headerGap: "2.2mm",
    logoSize: "8.5mm",
    tenantNameFs: 11.5,
    tenantSubFs: 5.4,
    titleFs: 18,
    qrSize: "54mm",
    footerGap: "1.5mm",
    footerLogo: "3mm",
    footerFs: 6,
    ruleMb: "2mm",
  },
};

/**
 * Monochrome (black-ink-on-white) visitor pass, sized in mm so the rendered
 * DOM matches its A6/A7 print footprint exactly. The same node is what the
 * export helpers capture, so anything styled here lands on the printout
 * unchanged.
 *
 * Composition (top → bottom):
 *   - Header row: tenant logo + tenant company name + "Visitor Management"
 *   - Headline: "VISITOR PASS"
 *   - QR code (dominant, centered)
 *   - Footer: hairline rule + VisiChek mark + "Powered by VisiChek"
 *
 * The tenant mark is rendered only when `tenantLogoUrl` is provided (the
 * tenant has the branding capability and a logo on file); otherwise the
 * VisiChek glyph stands in. All marks are forced to pure black so the pass
 * prints cleanly on any B&W printer.
 */
export const PrintBadge = forwardRef<HTMLDivElement, PrintBadgeProps>(
  function PrintBadge({ data, format }, ref) {
    const { width, height } = DIMS[format];
    const sz = SIZES[format];
    const hasTenantLogo = Boolean(data.tenantLogoUrl);

    return (
      <div
        ref={ref}
        data-badge-format={format}
        style={{
          width: `${width}mm`,
          height: `${height}mm`,
          background: PAPER,
          color: INK,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: sz.framePad,
          position: "relative",
          fontFamily:
            '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.18)",
        }}
      >
        {/* ── Header: tenant mark + name ───────────────────────────── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: sz.headerGap,
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              width: sz.logoSize,
              height: sz.logoSize,
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            {hasTenantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.tenantLogoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "grayscale(1) contrast(1.4) brightness(0.6)",
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/visichek_logo.svg"
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "brightness(0)",
                }}
              />
            )}
          </div>

          <div style={{ minWidth: 0, lineHeight: 1 }}>
            <div
              style={{
                fontSize: `${data.tenantName.length > 22 ? sz.tenantNameFs * 0.78 : sz.tenantNameFs}px`,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                lineHeight: 1.02,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {data.tenantName}
            </div>
            <div
              style={{
                marginTop: "1.2mm",
                fontSize: `${sz.tenantSubFs}px`,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: "rgba(0,0,0,0.7)",
              }}
            >
              Visitor Management
            </div>
          </div>
        </header>

        {/* ── Headline ─────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: format === "A6" ? "10mm" : "6mm",
            fontSize: `${sz.titleFs}px`,
            fontWeight: 900,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            lineHeight: 1,
            flex: "0 0 auto",
          }}
        >
          Visitor Pass
        </div>

        {/* ── QR (dominant, centered) ──────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            placeItems: "center",
            minHeight: 0,
            marginTop: format === "A6" ? "4mm" : "2.5mm",
          }}
        >
          <div
            style={{
              width: sz.qrSize,
              height: sz.qrSize,
              background: PAPER,
              display: "grid",
              placeItems: "center",
            }}
          >
            <QRCodeSVG
              value={data.qrToken}
              size={format === "A7" ? 320 : 480}
              level="H"
              marginSize={0}
              fgColor={INK}
              bgColor={PAPER}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>

        {/* ── Footer: hairline + VisiChek mark ─────────────────────── */}
        <footer
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "0.35mm",
              background: INK,
              marginBottom: sz.ruleMb,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: sz.footerGap,
              fontSize: `${sz.footerFs}px`,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: INK,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/visichek_logo.svg"
              alt=""
              style={{
                width: sz.footerLogo,
                height: sz.footerLogo,
                objectFit: "contain",
                filter: "brightness(0)",
              }}
            />
            <span>Powered by VisiChek</span>
          </div>
        </footer>
      </div>
    );
  },
);
