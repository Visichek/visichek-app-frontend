"use client";

import type { PrintBadgeFormat } from "../components/print-badge";

const DIMS: Record<PrintBadgeFormat, { w: number; h: number }> = {
  A6: { w: 105, h: 148 },
  A7: { w: 74, h: 105 },
};

function badgeFilename(
  visitorName: string,
  format: PrintBadgeFormat,
  ext: "pdf" | "png",
) {
  const slug =
    visitorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "visitor";
  return `badge-${slug}-${format.toLowerCase()}.${ext}`;
}

/**
 * Snapshot the badge node by serialising the live DOM into an SVG
 * <foreignObject>, loading that SVG as an <img>, and drawing it onto a
 * canvas at high DPI. The browser's *real* layout engine renders the
 * markup — same code path as the on-screen preview — so the captured
 * PNG matches the visible badge. html2canvas couldn't do this because
 * it re-implements CSS layout in JS and mis-renders sub-pixel features
 * like the visitor pill's flex centring, letter-spacing baseline, and
 * the `aspect-ratio` QR frame.
 *
 * Parity caveats that remain (rare):
 *   - Cross-origin <img> sources without CORS headers will taint the
 *     canvas; the grayscale tenant logo is already pre-converted to a
 *     data URL upstream so this only matters if a new asset is added.
 *   - Everything visual on `PrintBadge` is inline `style={{...}}`, so
 *     external stylesheets aren't needed inside the foreignObject.
 */
async function captureBadgeImage(node: HTMLElement): Promise<{
  dataUrl: string;
  blob: Blob;
}> {
  await waitForFontsAndImages(node);

  const rect = node.getBoundingClientRect();
  const widthPx = Math.max(1, Math.round(rect.width));
  const heightPx = Math.max(1, Math.round(rect.height));
  // 4× upscale keeps QR modules and font edges crisp at print size.
  const scale = 4;
  const renderW = widthPx * scale;
  const renderH = heightPx * scale;

  // Deep-clone so we can mutate the subtree (drop the on-screen shadow,
  // set the XHTML namespace required by <foreignObject>) without
  // disturbing the live preview.
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = "none";
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  // Cross-origin <img> sources inside <foreignObject> taint the canvas
  // on draw and block toDataURL/toBlob. The tenant logo is the usual
  // culprit: useGrayscaleDataUrl falls back to the raw remote URL when
  // the CDN doesn't return CORS headers. Inline every <img> as a data
  // URL before we serialise — if any fetch fails, drop the src so the
  // export still completes without the logo.
  await inlineCrossOriginImages(clone);

  const xhtml = new XMLSerializer().serializeToString(clone);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${renderW}" height="${renderH}" viewBox="0 0 ${widthPx} ${heightPx}">
  <foreignObject x="0" y="0" width="${widthPx}" height="${heightPx}">
    ${xhtml}
  </foreignObject>
</svg>`;

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await loadSvgImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = renderW;
    canvas.height = renderH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialise canvas for badge export.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, renderW, renderH);
    ctx.drawImage(img, 0, 0, renderW, renderH);

    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("Could not encode badge image.")),
        "image/png",
      );
    });
    return { dataUrl, blob };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/**
 * Walk every <img> in the subtree and replace any non-data-URL source
 * with an inlined data URL. The browser allows displaying cross-origin
 * images on screen without CORS, but as soon as one is drawn through
 * the SVG-foreignObject → canvas pipeline its pixels are unreadable
 * and `toBlob`/`toDataURL` throws SecurityError. Inlining short-circuits
 * that by fetching the bytes ourselves and converting to base64.
 *
 * If a fetch fails (CDN doesn't allow CORS on GET), we drop the src so
 * the export still completes — the badge loses the logo rather than
 * the whole download failing. The proper long-term fix is to serve
 * tenant logo URLs with `Access-Control-Allow-Origin: *`.
 */
async function inlineCrossOriginImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const response = await fetch(src, {
          mode: "cors",
          credentials: "omit",
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute("src", dataUrl);
      } catch {
        img.removeAttribute("src");
        img.setAttribute("alt", "");
      }
    }),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read blob as data URL."));
    reader.readAsDataURL(blob);
  });
}

function loadSvgImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(
          new Error("Badge SVG rendered empty — likely malformed markup."),
        );
        return;
      }
      resolve(img);
    };
    img.onerror = () =>
      reject(new Error("Could not render badge SVG to image."));
    img.src = src;
  });
}

/**
 * Print the badge currently mounted at `node`. The live badge DOM is
 * cloned directly into a hidden iframe and handed to `window.print()` —
 * no html2canvas raster in between, so the printer receives exactly
 * what the browser's native layout engine produces from the same inline
 * styles the on-screen preview renders. Fonts, letter-spacing, the
 * visitor pill's flex centring, and QR sub-pixel positioning all match
 * the preview without the parity hacks the raster path required.
 *
 * Why a clone, not the live node: moving the live node out of the
 * modal would unmount its React subtree mid-flow. A deep clone keeps
 * the on-screen preview intact, and since every style on `PrintBadge`
 * is an inline `style={{...}}` (no class names, no CSS variables, no
 * webfonts), the clone is fully self-contained.
 *
 * Print sizing strategy:
 *   - `@page { size: ${w}mm ${h}mm; margin: 0 }` pins the paper-size
 *     hint so the printer driver pre-selects A6/A7 (or treats it as a
 *     custom page). Without this, browsers default to Letter/A4 and
 *     the badge prints tiny in a corner.
 *   - The badge node already carries `width/height` in mm, so it fills
 *     the page 1:1.
 *   - `print-color-adjust: exact` forces the printer to honor the
 *     solid-black QR and visitor pill rather than treating them as
 *     suppressible backgrounds in economy modes.
 */
export async function printVisitorBadge(
  node: HTMLElement,
  format: PrintBadgeFormat,
): Promise<void> {
  const { w, h } = DIMS[format];

  const clone = node.cloneNode(true) as HTMLElement;
  // On-screen drop shadow is a preview affordance — drop it so the
  // printer doesn't waste toner on a grey fringe at the edges.
  clone.style.boxShadow = "none";

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Visitor badge print");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not open print frame.");
  }

  doc.open();
  doc.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Visitor Badge</title>
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { width: ${w}mm; height: ${h}mm; }
  @media screen {
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      width: auto;
      height: auto;
    }
  }
</style>
</head>
<body></body>
</html>`);
  doc.close();

  // adoptNode moves the cloned subtree into the iframe's document
  // without re-parsing — inline styles, child SVGs (QR + VisiChek
  // mark), and data-URL <img> sources all transfer verbatim.
  doc.body.appendChild(doc.adoptNode(clone));

  await waitForFrameReady(iframe);
  // Native fonts are immediate, but a freshly-mounted SVG can need a
  // tick before its layout settles — `fonts.ready` is a cheap barrier
  // that also covers any future webfont swap.
  if (doc.fonts?.ready) {
    await doc.fonts.ready.catch(() => undefined);
  }

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } finally {
    window.setTimeout(() => iframe.remove(), 1500);
  }
}

/**
 * Capture the badge node and save it as a fixed-format PDF. The PDF
 * carries a single rasterised PNG sized to the badge — same pixels as
 * the on-screen preview and the print path.
 *
 * Filename derives from `visitorName`, e.g. `badge-edoka-issac-a6.pdf`.
 */
export async function downloadVisitorBadgePdf(
  node: HTMLElement,
  format: PrintBadgeFormat,
  visitorName: string,
): Promise<void> {
  const { w, h } = DIMS[format];
  const [{ default: JsPDF }, { dataUrl }] = await Promise.all([
    import("jspdf"),
    captureBadgeImage(node),
  ]);

  const pdf = new JsPDF({
    unit: "mm",
    format: format === "A6" ? "a6" : [w, h],
    orientation: "portrait",
    compress: true,
  });

  pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "SLOW");
  pdf.save(badgeFilename(visitorName, format, "pdf"));
}

/**
 * html2canvas captures whatever fonts the browser has at that instant.
 * Without waiting for `document.fonts.ready`, web-loaded faces (Plus
 * Jakarta Sans, IBM Plex Mono) can be substituted by a fallback whose
 * space-glyph metrics differ — the result is rendered text with
 * collapsed whitespace ("Visitor Management" → "VisitorManagement",
 * "2026-05-09 18:33 UTC" → "2026-05-0918:33UTC"). Awaiting the fonts
 * promise plus any `<img>` decode keeps the snapshot consistent with
 * the on-screen preview.
 */
async function waitForFontsAndImages(node: HTMLElement): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];

  if (typeof document !== "undefined" && document.fonts?.ready) {
    tasks.push(document.fonts.ready.catch(() => undefined));
  }

  const images = Array.from(node.querySelectorAll("img"));
  for (const img of images) {
    if (img.complete && img.naturalWidth > 0) continue;
    tasks.push(
      new Promise<void>((resolve) => {
        const settle = () => resolve();
        img.addEventListener("load", settle, { once: true });
        img.addEventListener("error", settle, { once: true });
      }),
    );
  }

  // Bound the wait so a slow remote logo never blocks the export forever.
  await Promise.race([
    Promise.all(tasks),
    new Promise((resolve) => window.setTimeout(resolve, 3000)),
  ]);
}

/**
 * Wait until the iframe's images have loaded (or errored) so the
 * print snapshot includes the logo. Bounded so a slow remote image
 * never blocks the print dialog forever.
 */
function waitForFrameReady(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve) => {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      resolve();
      return;
    }

    const start = () => {
      const images = Array.from(doc.images);
      if (images.length === 0) {
        resolve();
        return;
      }
      let remaining = images.length;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      images.forEach((img) => {
        if (img.complete) {
          if (--remaining === 0) finish();
          return;
        }
        const settle = () => {
          if (--remaining === 0) finish();
        };
        img.addEventListener("load", settle, { once: true });
        img.addEventListener("error", settle, { once: true });
      });
      // Fallback: never block more than 3s on remote logos.
      window.setTimeout(finish, 3000);
    };

    if (doc.readyState === "complete") {
      start();
    } else {
      win.addEventListener("load", start, { once: true });
    }
  });
}
