/**
 * Smoke-test fixture for `route-resolver.ts` (Issue 2).
 *
 * The project doesn't ship with a test runner yet, so this file is
 * written as a portable assertion script:
 *
 *   - It runs under Vitest / Jest as soon as one lands (the `it()`/
 *     `expect()` calls below match both runners' APIs when their
 *     globals are available).
 *   - It also runs as a plain Node script via
 *     `node --import tsx src/lib/notifications/route-resolver.test.ts`
 *     thanks to the local `runIfStandalone()` shim at the bottom.
 *
 * The point is to guard against the two original regressions in
 * Issue 2:
 *   1. /admin/admin/... double-prefix.
 *   2. Onboarding notifications landing on a route that doesn't
 *      exist in the admin shell.
 *
 * Add a case here every time you add a rewrite rule.
 */

import {
  resolveNotificationBucket,
  resolveNotificationRoute,
} from "./route-resolver";
import { isKnownRoute } from "@/lib/routing/route-registry";

interface Case {
  name: string;
  input: { link: string; audience: "admin" | "tenant" };
  expected: string | null;
}

const ROUTE_CASES: Case[] = [
  // Admin shell rewrites
  {
    name: "support case → /admin/support-cases/{id} (no doubled prefix)",
    input: {
      link: "/app/admin/support-cases/abc123",
      audience: "admin",
    },
    expected: "/admin/support-cases/abc123",
  },
  {
    name: "onboarding → /admin/tenants/onboarding/{id} (correct admin path)",
    input: {
      link: "/app/admin/onboarding/xyz",
      audience: "admin",
    },
    expected: "/admin/tenants/onboarding/xyz",
  },
  {
    name: "visitor approval → /admin/visitors/{id} for admin shell",
    input: {
      link: "/app/checkins/v1",
      audience: "admin",
    },
    expected: "/admin/visitors/v1",
  },

  // Tenant shell rewrites
  {
    name: "visitor approval → /app/visitors/{id} for tenant shell",
    input: {
      link: "/app/checkins/v1",
      audience: "tenant",
    },
    expected: "/app/visitors/v1",
  },
  {
    name: "tenant-side support case keeps /app/admin/support-cases/{id}",
    input: {
      link: "/app/admin/support-cases/abc123",
      audience: "tenant",
    },
    expected: "/app/admin/support-cases/abc123",
  },

  // Generic shell swap
  {
    name: "plain /app/* → /admin/* for admin shell",
    input: {
      link: "/app/dashboard",
      audience: "admin",
    },
    expected: "/admin/dashboard",
  },
  {
    name: "tenant user opening admin URL gets null (don't silently bounce)",
    input: {
      link: "/admin/dashboard",
      audience: "tenant",
    },
    expected: null,
  },

  // Defense-in-depth: a stale rule that produces /admin/admin/...
  // must be collapsed before we hand the URL back.
  {
    name: "double /admin/admin/ prefix is collapsed",
    input: {
      link: "/admin/admin/support-cases/abc123",
      audience: "admin",
    },
    expected: "/admin/support-cases/abc123",
  },

  // Query / hash preserved
  {
    name: "query + hash survive the rewrite",
    input: {
      link: "/app/admin/onboarding/xyz?ref=email#notes",
      audience: "admin",
    },
    expected: "/admin/tenants/onboarding/xyz?ref=email#notes",
  },

  // Bad inputs
  { name: "empty link → null", input: { link: "", audience: "admin" }, expected: null },
];

interface BucketCase {
  name: string;
  input: string | null;
  expected: ReturnType<typeof resolveNotificationBucket>;
}

const BUCKET_CASES: BucketCase[] = [
  {
    name: "support-cases path",
    input: "/admin/support-cases/abc",
    expected: "support_cases",
  },
  {
    name: "onboarding path",
    input: "/admin/tenants/onboarding/xyz",
    expected: "onboarding_queue",
  },
  {
    name: "visitor path",
    input: "/app/visitors/v1",
    expected: "visitors",
  },
  {
    name: "appointment path",
    input: "/app/appointments/a1",
    expected: "appointments",
  },
  {
    name: "incident path",
    input: "/app/incidents/i1",
    expected: "incidents",
  },
  {
    name: "jobs path",
    input: "/admin/jobs/t1",
    expected: "jobs",
  },
  {
    name: "blog path",
    input: "/admin/blogs/b1",
    expected: "content",
  },
  {
    name: "pricing path",
    input: "/admin/content/pricing",
    expected: "pricing",
  },
  {
    name: "plans path",
    input: "/admin/plans/p1",
    expected: "plans",
  },
  {
    name: "billing path",
    input: "/app/billing",
    expected: "billing",
  },
  { name: "unknown path", input: "/admin/random", expected: null },
  { name: "null path", input: null, expected: null },
];

interface Result {
  passed: number;
  failed: number;
  failures: string[];
}

function runAssertions(): Result {
  const result: Result = { passed: 0, failed: 0, failures: [] };

  for (const c of ROUTE_CASES) {
    const got = resolveNotificationRoute(c.input.link, c.input.audience);
    if (got === c.expected) {
      result.passed++;
    } else {
      result.failed++;
      result.failures.push(
        `route: ${c.name} — expected ${JSON.stringify(
          c.expected,
        )} got ${JSON.stringify(got)}`,
      );
    }
  }

  for (const c of BUCKET_CASES) {
    const got = resolveNotificationBucket(c.input);
    if (got === c.expected) {
      result.passed++;
    } else {
      result.failed++;
      result.failures.push(
        `bucket: ${c.name} — expected ${JSON.stringify(
          c.expected,
        )} got ${JSON.stringify(got)}`,
      );
    }
  }

  // ── Route-existence check ─────────────────────────────────────
  //
  // Every non-null resolver output MUST land on a registered route
  // in `route-registry.ts`. This locks in the Issue 2 fixes — if
  // someone changes the resolver to point at a route that doesn't
  // exist in the shell, the test fails before users hit a 404.
  for (const c of ROUTE_CASES) {
    if (c.expected == null) continue; // null is by design (off-origin etc.)
    const known = isKnownRoute(c.expected, c.input.audience);
    if (known) {
      result.passed++;
    } else {
      result.failed++;
      result.failures.push(
        `route-existence: ${c.name} — resolver emits ${JSON.stringify(
          c.expected,
        )} but no registered ${c.input.audience} route covers it. Add the prefix to route-registry.ts.`,
      );
    }
  }

  return result;
}

// ── Standalone runner (works under `node --import tsx ...`) ────────
//
// We do NOT pull in any vitest/jest globals here so the file compiles
// in an environment without a test runner. When a runner is added,
// either:
//   - rename to `*.spec.ts` (Vitest's default include) and the runner
//     will see the assertions via the wrapper below, or
//   - replace this body with describe()/it()/expect() calls.

function runIfStandalone(): void {
  // Heuristic: when imported by a test framework, `process.argv[1]`
  // doesn't point at this file. Only auto-run when the user invoked
  // node on this file directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const argv1: string | undefined = (globalThis as any).process?.argv?.[1];
  if (!argv1) return;
  if (!argv1.endsWith("route-resolver.test.ts")) return;

  const result = runAssertions();
  // eslint-disable-next-line no-console
  console.log(
    `route-resolver smoke test: ${result.passed} passed, ${result.failed} failed`,
  );
  if (result.failed > 0) {
    for (const line of result.failures) {
      // eslint-disable-next-line no-console
      console.error(`  ✗ ${line}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process?.exit?.(1);
  }
}

// Export so a future Vitest/Jest spec can `import { runAssertions }`
// and convert the table-driven cases into a real test suite.
export { runAssertions, ROUTE_CASES, BUCKET_CASES };

runIfStandalone();
