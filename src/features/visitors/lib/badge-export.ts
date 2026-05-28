"use client";

import type { VisitorBadgeFormat } from "../components/visitor-badge";

const DIMS: Record<VisitorBadgeFormat, { w: number; h: number }> = {
  A6: { w: 105, h: 148 },
  A7: { w: 74, h: 105 },
};

function badgeFilename(
  visitorName: string,
  format: VisitorBadgeFormat,
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
 * Snapshot the badge node to a high-DPI PNG via html2canvas. Both the
 * print and the download paths consume this so the printed/saved badge
 * is pixel-identical to the on-screen preview — no font substitution,
 * no remote-CSS races in a print iframe.
 */
async function captureBadgeImage(node: HTMLElement): Promise<{
  dataUrl: string;
  blob: Blob;
}> {
  const { default: html2canvas } = await import("html2canvas");
  await waitForFontsAndImages(node);

  const canvas = await html2canvas(node, {
    scale: Math.max(4, window.devicePixelRatio * 2 || 4),
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    imageTimeout: 0,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  });

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
}

/**
 * Print the badge currently mounted at `node`. The badge is captured to
 * a PNG first (same image the PDF and download paths consume), then
 * dropped into a hidden iframe as a single `<img>` sized at the badge's
 * exact A6/A7 footprint in mm.
 *
 * `@page` intentionally does NOT pin the paper size — only the margin —
 * so the user's print dialog can pick any paper and the printer can
 * scale the badge to fit (the "Scale" / "Fit to page" slider in the
 * dialog is what "resizable" means in print contexts). Defaults to
 * exact A6/A7 size at 100% scale when the user has matching paper.
 */
export async function printVisitorBadge(
  node: HTMLElement,
  format: VisitorBadgeFormat,
): Promise<void> {
  const { w, h } = DIMS[format];
  const { dataUrl } = await captureBadgeImage(node);

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
  @page { margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  img {
    display: block;
    width: ${w}mm;
    height: ${h}mm;
    max-width: 100%;
    max-height: 100vh;
    object-fit: contain;
  }
  @media print {
    body { min-height: auto; }
  }
</style>
</head>
<body><img src="${dataUrl}" alt="" /></body>
</html>`);
  doc.close();

  await waitForFrameReady(iframe);

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
  format: VisitorBadgeFormat,
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
 * Save the badge as a standalone PNG image. This is the most portable
 * artefact — any phone or printer can open it, no PDF reader required.
 */
export async function downloadVisitorBadgeImage(
  node: HTMLElement,
  format: VisitorBadgeFormat,
  visitorName: string,
): Promise<void> {
  const { blob } = await captureBadgeImage(node);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = badgeFilename(visitorName, format, "png");
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
