#!/usr/bin/env node
/**
 * Guardrail: fails CI if a user-visible "tenant" string sneaks back into the
 * frontend copy. WS1 renamed the user-facing noun to "organization"
 * (or "organisation" in files that already used British spelling)
 * everywhere except code identifiers, route paths, query keys, and API
 * payload keys — those legitimately keep the word "tenant" and are not
 * user-visible.
 *
 * Approach: walk src/**\/*.{ts,tsx}, find lines that assign a copy prop
 * (label, title, description, placeholder, message, tooltip, aria-label,
 * aria-*, heading, header, hint, alt, emptyTitle, emptyDescription,
 * searchPlaceholder, confirmLabel, loadingText, etc.) or a JSX text node,
 * pull out the string/template-literal value, and check it for a
 * whole-word "tenant"/"Tenant" match. Identifiers like `tenantId`,
 * `useTenantList`, `tenant.companyName` do NOT match \btenant\b because
 * the trailing character is a word character (camelCase), so they are
 * naturally excluded without an allowlist.
 *
 * A small allowlist exists for lines that are legitimately fine (backend
 * enum values quoted as copy, e.g. discount scope options) — add to it
 * deliberately, never to silence a real miss.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");

// Each pattern captures the literal copy value in group 1 so we only test
// *that* substring for "tenant" — never the surrounding code (prop names,
// callback params like `(tenant) =>`, or `tenant.companyName` accesses).
const COPY_VALUE_PATTERNS = [
  // label="..." / title={"..."} / description: "..." / placeholder='...'
  /\b(?:label|title|description|placeholder|message|tooltip|heading|header|hint|alt|emptyTitle|emptyDescription|searchPlaceholder|confirmLabel|loadingText|disabledReason|confirmDescription|subtitle)\s*[:=]\s*\{?\s*["'`]((?:[^"'`\\]|\\.)*)["'`]/g,
  // aria-label="..." / aria-live={"..."}
  /\baria-[a-z]+\s*=\s*\{?\s*["'`]((?:[^"'`\\]|\\.)*)["'`]/g,
  // toast.error("...") / toast.success(`...`)
  /\btoast\.(?:error|success|info|warning)\s*\(\s*["'`]((?:[^"'`\\]|\\.)*)["'`]/g,
  // JSX text node: >Some visible text<
  />\s*([A-Za-z][^<>{}\n]*)</g,
];

// Whole-word match only — "tenantId", "useTenantList", "tenant.companyName"
// etc. do not match because the character after "tenant" is a word char.
const TENANT_WORD = /\btenant\b/i;

// file:line substrings that are known-safe and intentionally excluded.
// Keep this list short — every entry should be reviewed, not a dumping
// ground for lazily suppressing real misses.
const ALLOWLIST = [
  // Backend enum literal ("global" | "tenant" | "plan") rendered as a raw
  // SelectItem value, not label copy — the visible label was already
  // changed to "Organization — one specific organization".
  'src/features/discounts/components/discount-form.tsx:397:                  <SelectItem value="tenant">',
];

/** @param {string} dir */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      yield* walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      yield full;
    }
  }
}

let violations = [];

for (const file of walk(SRC_DIR)) {
  const relPath = relative(ROOT, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf-8").split("\n");

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const key = `${relPath}:${lineNo}`;

    for (const pattern of COPY_VALUE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        // Strip template-literal interpolations (`${tenant.id}`,
        // `${tenantLabel}`, etc.) before testing — those reference code
        // identifiers, not literal copy text.
        const value = match[1]?.replace(/\$\{[^}]*\}/g, "");
        if (!value || !TENANT_WORD.test(value)) continue;

        const entry = `${key}:${line.trim()}`;
        if (ALLOWLIST.some((allowed) => entry.startsWith(allowed))) continue;

        violations.push({ file: relPath, line: lineNo, text: line.trim() });
        break;
      }
    }
  });
}

if (violations.length > 0) {
  console.error(
    `\n✗ check:copy found ${violations.length} user-visible "tenant" string(s). Use "organization" (or "organisation" if the file already uses British spelling) for anything a user reads — labels, titles, descriptions, placeholders, tooltips, toasts, aria-* text, JSX text nodes.\n`
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}\n    ${v.text}\n`);
  }
  console.error(
    "If a hit is a genuine false positive (e.g. a raw backend enum value, not copy), add it to the ALLOWLIST in scripts/check-tenant-copy.mjs with a comment explaining why.\n"
  );
  process.exit(1);
}

console.log("✓ check:copy — no user-visible \"tenant\" strings found.");
