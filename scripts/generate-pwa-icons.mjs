import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_SVG = resolve(ROOT, "src/app/visichek-favicon-bg.svg");
const OUT_DIR = resolve(ROOT, "public");

const BRAND_GREEN = "#359300";
const WHITE = "#ffffff";

async function loadSvg() {
  const raw = await readFile(SRC_SVG, "utf8");
  return Buffer.from(raw);
}

async function loadMaskableSvg() {
  // Maskable icons need padding so the mark survives Android's circular/squircle masks.
  // Inset the original 144x144 mark to ~70% of the canvas, on a brand-green field.
  const original = await readFile(SRC_SVG, "utf8");
  const inner = original.replace(/<\?xml[^>]*\?>/g, "").trim();
  const wrapped = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" fill="${BRAND_GREEN}"/>
  <g transform="translate(28 28) scale(1)">
    ${inner.replace(/<rect[^/]*\/>/, `<rect width="144" height="144" rx="20" fill="${WHITE}"/>`)}
  </g>
</svg>`;
  return Buffer.from(wrapped);
}

async function out(name, buf) {
  const path = resolve(OUT_DIR, name);
  await writeFile(path, buf);
  console.log(`wrote ${path}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = await loadSvg();
  const maskable = await loadMaskableSvg();

  await out(
    "icon-192.png",
    await sharp(svg, { density: 384 }).resize(192, 192).png().toBuffer()
  );
  await out(
    "icon-512.png",
    await sharp(svg, { density: 512 }).resize(512, 512).png().toBuffer()
  );
  await out(
    "icon-maskable-512.png",
    await sharp(maskable, { density: 512 }).resize(512, 512).png().toBuffer()
  );
  await out(
    "apple-touch-icon.png",
    await sharp(svg, { density: 360 }).resize(180, 180).png().toBuffer()
  );
  await out("icon.svg", svg);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
