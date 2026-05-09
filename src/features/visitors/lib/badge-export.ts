"use client";

import type { VisitorBadgeFormat } from "../components/visitor-badge";

const DIMS: Record<VisitorBadgeFormat, { w: number; h: number }> = {
  A6: { w: 105, h: 148 },
  A7: { w: 74, h: 105 },
};

function badgeFilename(visitorName: string, format: VisitorBadgeFormat) {
  const slug =
    visitorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "visitor";
  return `badge-${slug}-${format.toLowerCase()}.pdf`;
}

/**
 * Print the badge currently mounted at `node` at exactly its A6/A7
 * footprint. Renders into a hidden iframe (so popup blockers stay out
 * of the way), waits for images/fonts, then triggers the iframe's
 * print dialog. The user's "Save as PDF" option in that dialog also
 * works — the page size is locked to the badge by `@page`.
 */
export async function printVisitorBadge(
  node: HTMLElement,
  format: VisitorBadgeFormat,
): Promise<void> {
  const { w, h } = DIMS[format];
  const html = node.outerHTML;

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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800;900&family=IBM+Plex+Mono:wght@500;700&display=swap" />
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { width: ${w}mm; height: ${h}mm; }
  body > * { border-radius: 0 !important; box-shadow: none !important; }
  @media screen { body { display: flex; align-items: center; justify-content: center; } }
</style>
</head>
<body>${html}</body>
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
 * Capture the badge node and save it as a fixed-format PDF. Uses
 * html2canvas at high DPR for crisp QR/logo rendering, then writes the
 * resulting bitmap into a jsPDF page sized exactly to the badge.
 *
 * Filename derives from `visitorName`, e.g. `badge-edoka-issac-a6.pdf`.
 */
export async function downloadVisitorBadgePdf(
  node: HTMLElement,
  format: VisitorBadgeFormat,
  visitorName: string,
): Promise<void> {
  const { w, h } = DIMS[format];

  const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(node, {
    scale: Math.max(3, window.devicePixelRatio || 1) ,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new JsPDF({
    unit: "mm",
    format: format === "A6" ? "a6" : [w, h],
    orientation: "portrait",
    compress: true,
  });

  pdf.addImage(imgData, "PNG", 0, 0, w, h, undefined, "FAST");
  pdf.save(badgeFilename(visitorName, format));
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
