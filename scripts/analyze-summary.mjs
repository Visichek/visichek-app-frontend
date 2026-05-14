#!/usr/bin/env node
/**
 * Extracts `window.chartData` from a webpack-bundle-analyzer HTML report and
 * prints a focused summary: top chunks by gzip, big node_modules per chunk,
 * and any chunk that ships >100 kB of app code outside `node_modules`.
 *
 * Usage:
 *   node scripts/analyze-summary.mjs [.next/analyze/client.html]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";

const file =
  argv[2] ??
  fileURLToPath(new URL("../.next/analyze/client.html", import.meta.url));
const html = readFileSync(file, "utf8");

// The HTML embeds `window.chartData = [ ... ];` followed by a few more
// `window.<x> = ...` assignments. We slice the substring between the first
// `[` after the marker and the matching closing `]`.
const marker = "window.chartData = ";
const start = html.indexOf(marker);
if (start === -1) {
  console.error(`Could not find ${marker} in ${file}`);
  process.exit(1);
}
let depth = 0;
let i = start + marker.length;
const open = html[i];
if (open !== "[") {
  console.error(`Expected '[' after marker, got '${open}'`);
  process.exit(1);
}
const begin = i;
for (; i < html.length; i++) {
  const c = html[i];
  if (c === "[") depth++;
  else if (c === "]") {
    depth--;
    if (depth === 0) {
      i++;
      break;
    }
  }
}
const data = JSON.parse(html.slice(begin, i));

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

// ── 1. Top chunks by gzip size ──────────────────────────────────────
const chunks = data
  .map((c) => ({
    label: c.label,
    statSize: c.statSize,
    parsedSize: c.parsedSize,
    gzipSize: c.gzipSize,
    groups: c.groups ?? [],
  }))
  .sort((a, b) => b.gzipSize - a.gzipSize);

console.log("=".repeat(72));
console.log("TOP 20 CLIENT CHUNKS BY GZIP SIZE");
console.log("=".repeat(72));
console.log(
  `${"chunk".padEnd(50)} ${"stat".padStart(10)} ${"gzip".padStart(10)}`,
);
for (const c of chunks.slice(0, 20)) {
  console.log(
    `${c.label.padEnd(50)} ${kb(c.statSize).padStart(10)} ${kb(c.gzipSize).padStart(10)}`,
  );
}

// ── 2. Where does each big package live? ────────────────────────────
//
// Walk every group tree once and collect a map of top-level
// node_modules package -> { chunks: Set<label>, totalStat: number }.
//
// "Top-level" means the first segment of the path after `node_modules/`,
// honoring scoped packages (`@radix-ui/...`).
const pkgMap = new Map();

function walk(group, chunkLabel) {
  const path = group.path ?? group.label;
  if (typeof path === "string" && path.includes("node_modules")) {
    const after = path.split("node_modules/").pop();
    const segs = after.split(/[\\/]/);
    const pkg = segs[0].startsWith("@") ? `${segs[0]}/${segs[1]}` : segs[0];
    if (pkg && !pkg.startsWith("@types")) {
      const stat = group.statSize ?? 0;
      // Leaf modules carry the real size; intermediate folders sum their
      // children, so we only count groups that have no further groups
      // ("real" leaves) to avoid double-counting.
      if (!group.groups || group.groups.length === 0) {
        const entry = pkgMap.get(pkg) ?? {
          totalStat: 0,
          chunks: new Set(),
        };
        entry.totalStat += stat;
        entry.chunks.add(chunkLabel);
        pkgMap.set(pkg, entry);
      }
    }
  }
  for (const g of group.groups ?? []) walk(g, chunkLabel);
}

for (const c of data) for (const g of c.groups ?? []) walk(g, c.label);

const packages = [...pkgMap.entries()]
  .map(([name, v]) => ({
    name,
    totalStat: v.totalStat,
    chunkCount: v.chunks.size,
    chunks: [...v.chunks],
  }))
  .sort((a, b) => b.totalStat - a.totalStat);

console.log();
console.log("=".repeat(72));
console.log("TOP 25 NODE_MODULES PACKAGES BY TOTAL STAT SIZE");
console.log("=".repeat(72));
console.log(
  `${"package".padEnd(40)} ${"stat".padStart(10)} ${"chunks".padStart(8)}`,
);
for (const p of packages.slice(0, 25)) {
  console.log(
    `${p.name.padEnd(40)} ${kb(p.totalStat).padStart(10)} ${String(p.chunkCount).padStart(8)}`,
  );
}

// ── 3. Heavy packages found in MULTIPLE chunks ──────────────────────
//
// Duplication is the most common subtle waste — the same library shipped
// inside several entrypoints. We surface anything > 30 kB stat that lives
// in more than one chunk.
const duplicated = packages.filter(
  (p) => p.chunkCount > 1 && p.totalStat > 30 * 1024,
);
if (duplicated.length) {
  console.log();
  console.log("=".repeat(72));
  console.log("DUPLICATED HEAVY PACKAGES (>30 kB, in >1 chunk)");
  console.log("=".repeat(72));
  for (const p of duplicated) {
    console.log(
      `${p.name}  (${kb(p.totalStat)}, in ${p.chunkCount} chunks)`,
    );
    for (const ch of p.chunks) console.log(`    - ${ch}`);
  }
}

// ── 4. Any app/src tile shipping a heavy library? ───────────────────
//
// Walk each chunk; if a chunk contains BOTH our `src/` code AND a heavy
// node_modules library, report it. That's the most common "static import
// leaked into a route's first-load JS" smell.
const HEAVY = ["recharts", "jspdf", "html2canvas", "html5-qrcode", "dojah-kyc-sdk-react", "qrcode.react"];
const leaks = [];

function chunkHasSrc(c) {
  function check(g) {
    const p = g.path ?? g.label ?? "";
    if (p.includes("./src/") && !p.includes("node_modules")) return true;
    for (const child of g.groups ?? []) if (check(child)) return true;
    return false;
  }
  return (c.groups ?? []).some(check);
}

function chunkHas(c, pkg) {
  function check(g) {
    const p = g.path ?? g.label ?? "";
    if (p.includes(`node_modules/${pkg}`) || p.includes(`node_modules\\${pkg}`))
      return true;
    for (const child of g.groups ?? []) if (check(child)) return true;
    return false;
  }
  return (c.groups ?? []).some(check);
}

for (const c of data) {
  if (!chunkHasSrc(c)) continue;
  for (const heavy of HEAVY) {
    if (chunkHas(c, heavy)) leaks.push({ chunk: c.label, pkg: heavy });
  }
}

console.log();
console.log("=".repeat(72));
console.log("HEAVY LIBRARY LEAKS INTO src/ ROUTE CHUNKS");
console.log("=".repeat(72));
if (leaks.length === 0) {
  console.log("None — heavy libs are isolated in their own chunks. ✓");
} else {
  for (const l of leaks) console.log(`  ${l.pkg}  →  ${l.chunk}`);
}
