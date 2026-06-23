"use client";

import { forwardRef, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export type PrintBadgeFormat = "A6" | "A7";

export interface PrintBadgeData {
  /** Who the visitor is visiting — always shown. */
  tenantName: string;
  /**
   * Resolved tenant logo URL. Rendered as a manual-grayscale data URL
   * (CSS `filter` is dropped by the html2canvas snapshot, so we
   * pre-process via a 2D canvas instead). Pass undefined when the
   * tenant has no branding ability — the badge then falls back to the
   * VisiChek mark only.
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
  /** Unix epoch seconds — printed as the issued caption. */
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

/**
 * System-only font stacks so the on-screen preview matches the
 * html2canvas snapshot byte-for-byte. The project's local fonts
 * (Moderat Serif, TWK Lausanne) are wired via next/font/local as CSS
 * variables — those don't reliably resolve inside the canvas capture,
 * which is what causes "Visitor Pass" to render as "VisitorPass" in
 * the exported PNG/PDF.
 */
const BODY_FONT =
  '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
const DISPLAY_FONT =
  'Georgia, "Times New Roman", "Liberation Serif", Times, serif';

/**
 * VisiChek mark, inlined so its colour is set by `fill` (not a CSS
 * `filter`). html2canvas drops `filter`, which is why the file-based
 * SVG kept coming out in its source green (#359300) inside the export.
 */
const VISICHEK_PATH =
  "M0.493647 131.983C0.280304 132.163 -0.0414403 131.979 0.00441278 131.704L9.14961 76.8168C9.19398 76.5505 9.54002 76.4737 9.69284 76.6963L20.7933 92.8616C20.8868 92.9977 21.0726 93.0327 21.2092 92.9399L131.02 18.3713L27.212 70.4969C27.083 70.5617 26.9262 70.5255 26.8388 70.4107L12.5599 51.6827C12.5373 51.6531 12.5205 51.6195 12.5102 51.5837L1.10161 11.8843C1.01226 11.5734 1.41044 11.3608 1.61915 11.6079L31.8005 47.3485C31.8794 47.442 32.0071 47.4782 32.1232 47.44L143.142 11.0164C143.456 10.9136 143.681 11.3183 143.429 11.5309L0.493647 131.983Z";

function VisichekMark({ size, color = INK }: { size: string; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 144 144"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path d={VISICHEK_PATH} fill={color} />
    </svg>
  );
}

/**
 * Load `url`, draw it into an off-screen canvas, convert to luminance
 * grayscale by hand, and return the result as a PNG data URL. We do
 * this instead of `filter: grayscale(1)` because the export pipeline
 * (html2canvas) ignores CSS filters — so the on-screen preview and the
 * downloaded PNG would otherwise disagree on logo colour.
 *
 * If the remote logo's CORS headers don't allow pixel reads, the canvas
 * becomes tainted on `getImageData` and we fall back to the original
 * URL (colour will leak through, but at least the badge still renders).
 */
function useGrayscaleDataUrl(url: string | undefined): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setDataUrl(undefined);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth || 256;
        const h = img.naturalHeight || 256;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        // Luminance grayscale + contrast/darken so the mark reads as
        // near-black ink on white, matching the rest of the pass.
        for (let i = 0; i < d.length; i += 4) {
          const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          const contrasted = Math.max(
            0,
            Math.min(255, (lum - 128) * 1.4 + 128),
          );
          const darkened = Math.max(0, Math.min(255, contrasted * 0.55));
          d[i] = darkened;
          d[i + 1] = darkened;
          d[i + 2] = darkened;
        }
        ctx.putImageData(imgData, 0, 0);
        setDataUrl(canvas.toDataURL("image/png"));
      } catch {
        setDataUrl(url);
      }
    };
    img.onerror = () => {
      if (!cancelled) setDataUrl(url);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return dataUrl;
}

export function printBadgeDims(format: PrintBadgeFormat) {
  return DIMS[format];
}

const SIZES: Record<
  PrintBadgeFormat,
  {
    framePad: string;
    visitorTagFs: number;
    visitorTagPad: string;
    visitorTagH: string;
    headerGap: string;
    headerMt: string;
    logoSize: string;
    tenantNameFs: number;
    tenantSubFs: number;
    titleFs: number;
    titleMt: string;
    qrFrame: string;
    qrPad: string;
    qrMaxW: string;
    visitorNameFs: number;
    visitorNameMt: string;
    visitorCompanyFs: number;
    visitorMetaFs: number;
    visitorMetaMt: string;
    footerGap: string;
    footerLogo: string;
    footerFs: number;
    ruleMb: string;
    qrModulesPx: number;
  }
> = {
  A6: {
    framePad: "7mm 7mm 5mm",
    visitorTagFs: 6.5,
    visitorTagPad: "0 2.6mm",
    visitorTagH: "4.6mm",
    headerGap: "3mm",
    headerMt: "3.5mm",
    logoSize: "11mm",
    tenantNameFs: 13.5,
    tenantSubFs: 6.4,
    titleFs: 27,
    titleMt: "6mm",
    qrFrame: "82mm",
    qrPad: "3mm",
    qrMaxW: "76mm",
    visitorNameFs: 12,
    visitorNameMt: "3.5mm",
    visitorCompanyFs: 7.2,
    visitorMetaFs: 5.8,
    visitorMetaMt: "1.2mm",
    footerGap: "1.8mm",
    footerLogo: "3.6mm",
    footerFs: 7.2,
    ruleMb: "2.4mm",
    qrModulesPx: 520,
  },
  A7: {
    framePad: "4.5mm 4.5mm 3.5mm",
    visitorTagFs: 5.2,
    visitorTagPad: "0 1.9mm",
    visitorTagH: "3.6mm",
    headerGap: "2mm",
    headerMt: "2.4mm",
    logoSize: "8mm",
    tenantNameFs: 10,
    tenantSubFs: 4.8,
    titleFs: 19,
    titleMt: "4mm",
    qrFrame: "56mm",
    qrPad: "2mm",
    qrMaxW: "52mm",
    visitorNameFs: 9,
    visitorNameMt: "2.4mm",
    visitorCompanyFs: 5.6,
    visitorMetaFs: 4.6,
    visitorMetaMt: "0.8mm",
    footerGap: "1.2mm",
    footerLogo: "2.6mm",
    footerFs: 5.4,
    ruleMb: "1.6mm",
    qrModulesPx: 360,
  },
};

function formatIssued(seconds: number | undefined): string {
  if (!seconds) return "";
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/**
 * Monochrome (black-ink-on-white) visitor pass, sized in mm so the
 * rendered DOM matches its A6/A7 print footprint exactly. The same
 * node is what the export helpers capture, so anything styled here
 * lands on the printout unchanged.
 *
 * Preview/export parity rules (all enforced because html2canvas is
 * limited):
 *   - No CSS `filter` — colours are baked into the source (canvas
 *     grayscale for tenant logo, inline `fill` for VisiChek mark).
 *   - No CSS-variable fonts — system serif + system sans only, so the
 *     snapshot's font fallback matches the preview's.
 *   - No remote webfonts — same reason.
 */
export const PrintBadge = forwardRef<HTMLDivElement, PrintBadgeProps>(
  function PrintBadge({ data, format }, ref) {
    const { width, height } = DIMS[format];
    const sz = SIZES[format];
    const issuedLabel = formatIssued(data.issuedAt);
    const grayLogo = useGrayscaleDataUrl(data.tenantLogoUrl);
    const showTenantLogo = Boolean(grayLogo);

    // The visitor's name is the hero of the pass. Scale it down for
    // longer names so it never wraps past two lines and crowds the QR.
    const visitorNameDisplay = data.visitorName?.trim() || "Visitor";
    const nameLen = visitorNameDisplay.length;
    const nameFs =
      nameLen > 24
        ? sz.titleFs * 0.58
        : nameLen > 16
          ? sz.titleFs * 0.76
          : sz.titleFs;

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
          fontFamily: BODY_FONT,
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.18)",
        }}
      >
        {/* ── "Visitor" pill ──────────────────────────────────────── */}
        <div style={{ flex: "0 0 auto", display: "flex" }}>
          <span
            style={{
              background: INK,
              color: PAPER,
              fontSize: `${sz.visitorTagFs}px`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              // Cancels the trailing letter-spacing — without it, the
              // text drifts left of centre because the invisible tail
              // space gets counted in the box width.
              textIndent: "0.22em",
              // Fixed height + flex centring keeps text vertically
              // pinned, instead of relying on padding + baseline
              // computations that html2canvas often disagrees with.
              height: sz.visitorTagH,
              padding: sz.visitorTagPad,
              borderRadius: "999px",
              fontFamily: BODY_FONT,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            Visitor
          </span>
        </div>

        {/* ── Header: tenant mark + name ──────────────────────────── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: sz.headerGap,
            flex: "0 0 auto",
            marginTop: sz.headerMt,
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
            {showTenantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={grayLogo}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <VisichekMark size="100%" color={INK} />
            )}
          </div>

          <div style={{ minWidth: 0, lineHeight: 1 }}>
            <div
              style={{
                fontSize: `${data.tenantName.length > 22 ? sz.tenantNameFs * 0.78 : sz.tenantNameFs}px`,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                lineHeight: 1.02,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                fontFamily: BODY_FONT,
              }}
            >
              {data.tenantName}
            </div>
            <div
              style={{
                marginTop: "1mm",
                fontSize: `${sz.tenantSubFs}px`,
                fontWeight: 400,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "rgba(0,0,0,0.7)",
                fontFamily: BODY_FONT,
              }}
            >
              Visitor Management
            </div>
          </div>
        </header>

        {/* ── Pass eyebrow + visitor name (the hero) ──────────────── */}
        <div style={{ marginTop: sz.titleMt, flex: "0 0 auto" }}>
          <div
            style={{
              fontSize: `${sz.tenantSubFs}px`,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: "rgba(0,0,0,0.55)",
              lineHeight: 1,
              fontFamily: BODY_FONT,
            }}
          >
            Visitor Pass
          </div>
          <div
            style={{
              marginTop: format === "A6" ? "1.6mm" : "1.1mm",
              fontSize: `${nameFs}px`,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              // Georgia's "p"/"g" descenders sit ~0.2em below the
              // baseline; a tight line-height of 1 clips them under the
              // badge's overflow:hidden in the snapshot. 1.18 gives the
              // descender its required headroom.
              lineHeight: 1.18,
              paddingBottom: "0.5mm",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              fontFamily: DISPLAY_FONT,
            }}
          >
            {visitorNameDisplay}
          </div>
        </div>

        {/* ── QR with explicit quiet zone ─────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            placeItems: "center",
            minHeight: 0,
            marginTop: format === "A6" ? "3mm" : "2mm",
          }}
        >
          <div
            style={{
              width: sz.qrFrame,
              maxWidth: "100%",
              aspectRatio: "1 / 1",
              padding: sz.qrPad,
              background: PAPER,
              display: "grid",
              placeItems: "center",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: sz.qrMaxW,
                aspectRatio: "1 / 1",
              }}
            >
              <QRCodeSVG
                value={data.qrToken}
                size={sz.qrModulesPx}
                level="H"
                marginSize={0}
                fgColor={INK}
                bgColor={PAPER}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>
        </div>

        {/* ── Verification meta (company + issued) ────────────────── */}
        {(data.company || issuedLabel) && (
          <div
            style={{
              marginTop: sz.visitorNameMt,
              flex: "0 0 auto",
              textAlign: "center",
            }}
          >
            {data.company && (
              <div
                style={{
                  fontSize: `${sz.visitorCompanyFs}px`,
                  fontWeight: 400,
                  color: "rgba(0,0,0,0.7)",
                  overflowWrap: "anywhere",
                  lineHeight: 1.1,
                  fontFamily: BODY_FONT,
                }}
              >
                {data.company}
              </div>
            )}
            {issuedLabel && (
              <div
                style={{
                  marginTop: data.company ? sz.visitorMetaMt : "0mm",
                  fontSize: `${sz.visitorMetaFs}px`,
                  fontWeight: 400,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(0,0,0,0.55)",
                  fontFamily: BODY_FONT,
                }}
              >
                Issued {issuedLabel}
              </div>
            )}
          </div>
        )}

        {/* ── Footer: hairline + VisiChek mark ────────────────────── */}
        <footer
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: format === "A6" ? "4mm" : "2.5mm",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "0.3mm",
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
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: INK,
              fontFamily: BODY_FONT,
            }}
          >
            <VisichekMark size={sz.footerLogo} color={INK} />
            <span>Powered by VisiChek</span>
          </div>
        </footer>
      </div>
    );
  },
);
