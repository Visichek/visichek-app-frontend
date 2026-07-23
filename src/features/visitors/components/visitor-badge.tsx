"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QRCodeSVG } from "qrcode.react";

import type { LogoPosition, VisitStatus } from "@/types/enums";
import type { PublicBadgePass } from "@/types/public";

// ─────────────────────────────────────────────────────────────────────
// Types — the single badge data contract every consumer maps into.
// ─────────────────────────────────────────────────────────────────────

/** Print paper formats supported by the export pipeline. */
export type BadgePrintFormat = "A6" | "A7";

/**
 * Render variant. `screen` is the on-device badge view (kiosk, phone);
 * `print-a6` / `print-a7` are mm-sized layouts the print/PDF export
 * pipeline captures 1:1.
 */
export type BadgeVariant = "screen" | "print-a6" | "print-a7";

/**
 * Badge branding as delivered by the backend badge-pass payload
 * (`branding` object, camelCased from badge_header_color /
 * badge_text_color / logo_url / logo_position / company_display_name).
 * `null` branding = the org has no custom-branding entitlement — the
 * badge renders the neutral VisiChek layout.
 */
export interface BadgeBranding {
  headerColor?: string | null;
  textColor?: string | null;
  logoUrl?: string | null;
  logoPosition?: LogoPosition | null;
  companyDisplayName?: string | null;
}

/** Everything the badge can render. All optional fields degrade gracefully. */
export interface BadgePassData {
  visitorName: string;
  /** Organization the visitor is visiting. */
  orgName: string;
  /** Visitor's own company. */
  company?: string | null;
  purpose?: string | null;
  departmentName?: string | null;
  hostName?: string | null;
  /** Unix epoch seconds. */
  checkInTime?: number | null;
  /** What the QR encodes — the badge QR token for real passes. */
  qrValue: string;
  /** Unix epoch seconds. */
  validFrom?: number | null;
  /** Unix epoch seconds. */
  validUntil?: number | null;
  /** Short status label rendered in the corner pill (e.g. "Checked in"). */
  statusLabel?: string | null;
}

export interface VisitorBadgeProps {
  data: BadgePassData;
  branding: BadgeBranding | null;
  variant: BadgeVariant;
  /** Sample/preview render — used by the settings preview + test print. */
  sample?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Dimensions + helpers shared with the export pipeline.
// ─────────────────────────────────────────────────────────────────────

const PRINT_DIMS: Record<BadgePrintFormat, { width: number; height: number }> =
  {
    A6: { width: 105, height: 148 },
    A7: { width: 74, height: 105 },
  };

/** Physical badge dimensions in mm for a print format. */
export function badgePrintDims(format: BadgePrintFormat) {
  return PRINT_DIMS[format];
}

/** The print variant that matches an A6/A7 export format. */
export function printVariantForFormat(format: BadgePrintFormat): BadgeVariant {
  return format === "A6" ? "print-a6" : "print-a7";
}

const STATUS_LABELS: Record<VisitStatus, string> = {
  registered: "Registered",
  pending_verification: "Pending",
  checked_in: "Checked in",
  checked_out: "Checked out",
  denied: "Denied",
  cancelled: "Cancelled",
};

/**
 * Map the public badge-pass payload (GET /public/badge/{token}) into the
 * unified badge props. Handles both the new contract (top-level
 * `branding` object + `checkInTime`) and older payloads that only carry
 * `tenant.brandingEnabled` + `tenant.logoUrl` — everything degrades to
 * the neutral layout when absent.
 */
export function publicBadgePassToBadge(pass: PublicBadgePass): {
  data: BadgePassData;
  branding: BadgeBranding | null;
} {
  let branding: BadgeBranding | null = null;
  if (pass.branding) {
    branding = {
      headerColor: pass.branding.headerColor ?? null,
      textColor: pass.branding.textColor ?? null,
      logoUrl: pass.branding.logoUrl ?? pass.tenant?.logoUrl ?? null,
      logoPosition: pass.branding.logoPosition ?? null,
      companyDisplayName: pass.branding.companyDisplayName ?? null,
    };
  } else if (pass.tenant?.brandingEnabled && pass.tenant.logoUrl) {
    // Legacy payload without the branding object: keep showing the
    // branded org's logo, neutral colors otherwise.
    branding = { logoUrl: pass.tenant.logoUrl };
  }

  return {
    data: {
      visitorName: pass.visitorName,
      orgName:
        pass.tenant?.companyName ||
        pass.branding?.companyDisplayName ||
        "VisiChek",
      company: pass.company ?? null,
      purpose: pass.purpose ?? null,
      departmentName: pass.departmentName ?? null,
      hostName: pass.hostName ?? null,
      checkInTime: pass.checkInTime ?? pass.issuedAt ?? null,
      qrValue: pass.token,
      validFrom: pass.issuedAt ?? null,
      validUntil: pass.expiresAt ?? null,
      statusLabel: pass.status ? STATUS_LABELS[pass.status] ?? "Visitor" : null,
    },
    branding,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Rendering internals.
// ─────────────────────────────────────────────────────────────────────

const INK = "#000000";
const PAPER = "#ffffff";
/** Fallbacks when a branding object exists but a color is unset. */
const BRAND_HEADER_FALLBACK = "#111827";
const BRAND_TEXT_FALLBACK = "#FFFFFF";

/**
 * System-only font stacks so the on-screen preview matches the
 * SVG-foreignObject snapshot byte-for-byte. The project's local fonts
 * are wired via next/font/local as CSS variables — those don't reliably
 * resolve inside the canvas capture, which caused "Visitor Pass" to
 * render as "VisitorPass" in exported PNG/PDFs.
 */
const BODY_FONT =
  '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
const DISPLAY_FONT =
  'Georgia, "Times New Roman", "Liberation Serif", Times, serif';

/**
 * VisiChek mark, inlined so its colour is set by `fill` (not a CSS
 * `filter` — the export pipeline drops CSS filters).
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

function formatBadgeTime(seconds: number | null | undefined): string {
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
 * Per-variant size tokens. Print variants are mm-sized so the rendered
 * DOM matches its paper footprint exactly; the screen variant uses px
 * and a rounded-card look. All values are inline-style strings — no
 * classes, no CSS variables (export-pipeline parity requirement).
 */
interface VariantTokens {
  isPrint: boolean;
  width: string;
  height?: string;
  radius: string;
  headerPad: string;
  logoBox: string;
  headerNameFs: number;
  headerSubFs: number;
  bodyPad: string;
  pillFs: number;
  pillH: string;
  pillPad: string;
  eyebrowFs: number;
  nameFs: number;
  contextFs: number;
  metaLabelFs: number;
  metaValueFs: number;
  metaGapY: string;
  metaGapX: string;
  qrFrame: string;
  qrPad: string;
  qrPx: number;
  captionFs: number;
  footerFs: number;
  footerLogo: string;
  footerGap: string;
  ruleMb: string;
  gapSm: string;
  gapMd: string;
}

const VARIANT_TOKENS: Record<BadgeVariant, VariantTokens> = {
  "print-a6": {
    isPrint: true,
    width: "105mm",
    height: "148mm",
    radius: "0",
    headerPad: "4mm 6mm",
    logoBox: "9mm",
    headerNameFs: 11,
    headerSubFs: 5.4,
    bodyPad: "4.5mm 6mm 4mm",
    pillFs: 6,
    pillH: "4.4mm",
    pillPad: "0 2.4mm",
    eyebrowFs: 5.8,
    nameFs: 20,
    contextFs: 6.6,
    metaLabelFs: 5,
    metaValueFs: 6.6,
    metaGapY: "1.6mm",
    metaGapX: "3mm",
    qrFrame: "56mm",
    qrPad: "2.5mm",
    qrPx: 480,
    captionFs: 5.6,
    footerFs: 6.6,
    footerLogo: "3.4mm",
    footerGap: "1.6mm",
    ruleMb: "2.2mm",
    gapSm: "2mm",
    gapMd: "3.5mm",
  },
  "print-a7": {
    isPrint: true,
    width: "74mm",
    height: "105mm",
    radius: "0",
    headerPad: "2.8mm 4.2mm",
    logoBox: "6.5mm",
    headerNameFs: 8.5,
    headerSubFs: 4.2,
    bodyPad: "3.2mm 4.2mm 3mm",
    pillFs: 4.8,
    pillH: "3.4mm",
    pillPad: "0 1.8mm",
    eyebrowFs: 4.6,
    nameFs: 14.5,
    contextFs: 5.2,
    metaLabelFs: 4,
    metaValueFs: 5.2,
    metaGapY: "1.2mm",
    metaGapX: "2mm",
    qrFrame: "38mm",
    qrPad: "1.8mm",
    qrPx: 340,
    captionFs: 4.4,
    footerFs: 5,
    footerLogo: "2.4mm",
    footerGap: "1.2mm",
    ruleMb: "1.5mm",
    gapSm: "1.4mm",
    gapMd: "2.4mm",
  },
  screen: {
    isPrint: false,
    width: "340px",
    radius: "16px",
    headerPad: "16px 20px",
    logoBox: "36px",
    headerNameFs: 15,
    headerSubFs: 9,
    bodyPad: "18px 20px 16px",
    pillFs: 10,
    pillH: "20px",
    pillPad: "0 10px",
    eyebrowFs: 10,
    nameFs: 26,
    contextFs: 12,
    metaLabelFs: 9,
    metaValueFs: 12,
    metaGapY: "8px",
    metaGapX: "14px",
    qrFrame: "190px",
    qrPad: "10px",
    qrPx: 380,
    captionFs: 10,
    footerFs: 10,
    footerLogo: "12px",
    footerGap: "6px",
    ruleMb: "8px",
    gapSm: "10px",
    gapMd: "14px",
  },
};

function logoJustify(position: LogoPosition | null | undefined): string {
  switch (position) {
    case "top_center":
    case "center":
      return "center";
    case "top_right":
      return "flex-end";
    default:
      return "flex-start";
  }
}

/**
 * The one visitor badge renderer. Every surface — the public
 * `/badge/[token]` page, the in-shell print modal, the settings Live
 * Badge Preview / Test Print, and the kiosk badge view — renders this
 * component, so what you preview is exactly what prints.
 *
 * Export-parity rules (the print/PDF path serialises this DOM through
 * an SVG foreignObject → canvas):
 *   - INLINE STYLES ONLY — no class names, no CSS variables.
 *   - No CSS `filter` — colours are baked into sources (inline `fill`
 *     for the VisiChek mark; logos render as plain <img>).
 *   - System font stacks only — no webfonts, no CSS-variable fonts.
 */
export const VisitorBadge = forwardRef<HTMLDivElement, VisitorBadgeProps>(
  function VisitorBadge({ data, branding, variant, sample = false }, ref) {
    const t = VARIANT_TOKENS[variant];

    const branded = branding !== null && branding !== undefined;
    const headerBg = branded
      ? branding.headerColor || BRAND_HEADER_FALLBACK
      : PAPER;
    const headerFg = branded ? branding.textColor || BRAND_TEXT_FALLBACK : INK;
    const logoUrl = branded ? branding.logoUrl || undefined : undefined;
    const displayName =
      (branded && branding.companyDisplayName) || data.orgName || "VisiChek";

    // The visitor's name is the hero. Scale down long names so they
    // never wrap past two lines and crowd the QR.
    const visitorNameDisplay = data.visitorName?.trim() || "Visitor";
    const nameLen = visitorNameDisplay.length;
    const nameFs =
      nameLen > 24 ? t.nameFs * 0.58 : nameLen > 16 ? t.nameFs * 0.76 : t.nameFs;

    const pillLabel =
      data.statusLabel?.trim() || (sample ? "Sample" : "Visitor");
    const checkInLabel = formatBadgeTime(data.checkInTime ?? data.validFrom);
    const validUntilLabel = formatBadgeTime(data.validUntil);
    const qrValue = data.qrValue?.trim() || "visichek://sample-badge";

    const meta: Array<{ label: string; value: string }> = [];
    if (data.hostName) meta.push({ label: "Host", value: data.hostName });
    if (data.departmentName)
      meta.push({ label: "Department", value: data.departmentName });
    if (data.purpose) meta.push({ label: "Purpose", value: data.purpose });
    if (checkInLabel) meta.push({ label: "Checked in", value: checkInLabel });

    return (
      <div
        ref={ref}
        data-badge-variant={variant}
        style={{
          width: t.width,
          ...(t.height ? { height: t.height } : {}),
          background: PAPER,
          color: INK,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: t.radius,
          position: "relative",
          fontFamily: BODY_FONT,
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.18)",
        }}
      >
        {/* ── Header band: org logo + display name ─────────────────── */}
        <header
          style={{
            flex: "0 0 auto",
            background: headerBg,
            color: headerFg,
            padding: t.headerPad,
            display: "flex",
            alignItems: "center",
            gap: t.gapSm,
            justifyContent: logoJustify(branded ? branding.logoPosition : null),
            // Neutral layout: hairline separates the white header from
            // the body. Branded headers separate themselves by colour.
            ...(branded
              ? {}
              : { borderBottom: `0.3mm solid ${INK}` }),
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: t.logoBox,
              height: t.logoBox,
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <VisichekMark size="100%" color={headerFg} />
            )}
          </div>

          <div style={{ minWidth: 0, lineHeight: 1 }}>
            <div
              style={{
                fontSize: `${displayName.length > 22 ? t.headerNameFs * 0.78 : t.headerNameFs}px`,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.02em",
                lineHeight: 1.05,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                fontFamily: BODY_FONT,
                color: headerFg,
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                marginTop: t.isPrint ? "1mm" : "3px",
                fontSize: `${t.headerSubFs}px`,
                fontWeight: 400,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: headerFg,
                opacity: 0.75,
                fontFamily: BODY_FONT,
              }}
            >
              Visitor Management
            </div>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: t.bodyPad,
            boxSizing: "border-box",
          }}
        >
          {/* Status pill */}
          <div style={{ flex: "0 0 auto", display: "flex" }}>
            <span
              style={{
                background: branded ? headerBg : INK,
                color: branded ? headerFg : PAPER,
                fontSize: `${t.pillFs}px`,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                // Cancels the trailing letter-spacing so the text sits
                // centred instead of drifting left of centre.
                textIndent: "0.22em",
                height: t.pillH,
                padding: t.pillPad,
                borderRadius: "999px",
                fontFamily: BODY_FONT,
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              {pillLabel}
            </span>
          </div>

          {/* Eyebrow + visitor name (the hero) */}
          <div style={{ marginTop: t.gapMd, flex: "0 0 auto" }}>
            <div
              style={{
                fontSize: `${t.eyebrowFs}px`,
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
                marginTop: t.isPrint ? "1.4mm" : "5px",
                fontSize: `${nameFs}px`,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                // Georgia's descenders sit ~0.2em below the baseline; a
                // tight line-height clips them under overflow:hidden in
                // the export snapshot. 1.18 gives them headroom.
                lineHeight: 1.18,
                paddingBottom: t.isPrint ? "0.5mm" : "2px",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                fontFamily: DISPLAY_FONT,
              }}
            >
              {visitorNameDisplay}
            </div>
            {data.company && (
              <div
                style={{
                  marginTop: t.isPrint ? "0.8mm" : "3px",
                  fontSize: `${t.contextFs}px`,
                  fontWeight: 400,
                  color: "rgba(0,0,0,0.7)",
                  overflowWrap: "anywhere",
                  lineHeight: 1.15,
                  fontFamily: BODY_FONT,
                }}
              >
                {data.company}
              </div>
            )}
          </div>

          {/* Meta grid: host / department / purpose / check-in */}
          {meta.length > 0 && (
            <div
              style={{
                marginTop: t.gapMd,
                flex: "0 0 auto",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                columnGap: t.metaGapX,
                rowGap: t.metaGapY,
              }}
            >
              {meta.map((entry) => (
                <div key={entry.label} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: `${t.metaLabelFs}px`,
                      fontWeight: 400,
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      color: "rgba(0,0,0,0.55)",
                      lineHeight: 1.1,
                      fontFamily: BODY_FONT,
                    }}
                  >
                    {entry.label}
                  </div>
                  <div
                    style={{
                      marginTop: t.isPrint ? "0.6mm" : "2px",
                      fontSize: `${t.metaValueFs}px`,
                      fontWeight: 700,
                      color: INK,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      lineHeight: 1.15,
                      fontFamily: BODY_FONT,
                    }}
                  >
                    {entry.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* QR with explicit quiet zone — always black-on-white for
              scannability regardless of branding. */}
          <div
            style={{
              flex: "1 1 auto",
              display: "grid",
              placeItems: "center",
              minHeight: 0,
              marginTop: t.gapMd,
            }}
          >
            <div
              style={{
                width: t.qrFrame,
                maxWidth: "100%",
                aspectRatio: "1 / 1",
                padding: t.qrPad,
                background: PAPER,
                display: "grid",
                placeItems: "center",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                }}
              >
                <QRCodeSVG
                  value={qrValue}
                  size={t.qrPx}
                  level="H"
                  marginSize={0}
                  fgColor={INK}
                  bgColor={PAPER}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>
            </div>
          </div>

          {/* Validity caption */}
          {(validUntilLabel || sample) && (
            <div
              style={{
                marginTop: t.gapSm,
                flex: "0 0 auto",
                textAlign: "center",
                fontSize: `${t.captionFs}px`,
                fontWeight: 400,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(0,0,0,0.55)",
                fontFamily: BODY_FONT,
              }}
            >
              {validUntilLabel
                ? `Valid until ${validUntilLabel}`
                : "Sample badge — not valid for entry"}
            </div>
          )}

          {/* Footer: hairline + VisiChek mark */}
          <footer
            style={{
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: t.gapMd,
            }}
          >
            <div
              style={{
                width: "100%",
                height: t.isPrint ? "0.3mm" : "1px",
                background: INK,
                marginBottom: t.ruleMb,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: t.footerGap,
                fontSize: `${t.footerFs}px`,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                color: INK,
                fontFamily: BODY_FONT,
              }}
            >
              <VisichekMark size={t.footerLogo} color={INK} />
              <span>Powered by VisiChek</span>
            </div>
          </footer>
        </div>
      </div>
    );
  },
);

// ─────────────────────────────────────────────────────────────────────
// Scale-to-fit preview frame (shared by every on-screen consumer).
// ─────────────────────────────────────────────────────────────────────

/** 1mm ≈ 3.7795 CSS px at 96dpi. */
const MM_TO_PX = 3.7795;

export interface BadgeScaleFrameProps {
  /** Badge dimensions in mm (from `badgePrintDims`). */
  dims: { width: number; height: number };
  /**
   * `width` scales by available width only (normal-flow containers);
   * `both` also constrains by the container's resolved height (use
   * inside fixed-height flex containers like modals).
   */
  fit?: "width" | "both";
  /** Optional cap on the rendered width in px (default 360 for `width` fit). */
  maxWidthPx?: number;
  children: ReactNode;
}

/**
 * Scales the print-sized badge down to fit its container while leaving
 * the underlying mm geometry untouched, so the print/PDF capture stays
 * crisp. Measurement is deferred a frame and thresholded so dialog
 * open animations don't churn the preview.
 */
export function BadgeScaleFrame({
  dims,
  fit = "width",
  maxWidthPx,
  children,
}: BadgeScaleFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const pxWidth = dims.width * MM_TO_PX;
  const pxHeight = dims.height * MM_TO_PX;
  const widthCap = maxWidthPx ?? (fit === "width" ? 360 : undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      let availableWidth = Math.max(0, el.clientWidth - 8);
      if (widthCap !== undefined) {
        availableWidth = Math.min(availableWidth, widthCap);
      }
      const widthScale = availableWidth > 0 ? availableWidth / pxWidth : 1;
      let next = Math.min(1, widthScale);
      if (fit === "both") {
        const availableHeight = Math.max(0, el.clientHeight - 8);
        const heightScale =
          availableHeight > 0 ? availableHeight / pxHeight : 1;
        next = Math.min(next, heightScale);
      }
      // Ignore sub-pixel noise — without this, open animations drive a
      // fresh measurement every frame and the preview visibly churns.
      setScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };

    // Defer to the next frame: measuring synchronously inside the
    // observer callback and immediately re-rendering triggers the
    // browser's "ResizeObserver loop" error.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    });
    observer.observe(el);
    compute();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pxWidth, pxHeight, fit, widthCap]);

  if (fit === "both") {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Absolutely positioned so the scaled badge is OUT OF FLOW and
            can never influence the size of the element we measure —
            otherwise badge growth feeds back into the measurement. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <div style={{ width: pxWidth * scale, height: pxHeight * scale }}>
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                width: pxWidth,
                height: pxHeight,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", display: "flex", justifyContent: "center" }}
    >
      <div style={{ width: pxWidth * scale, height: pxHeight * scale }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: pxWidth,
            height: pxHeight,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
