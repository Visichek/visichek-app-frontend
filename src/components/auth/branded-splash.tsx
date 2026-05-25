"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Lightbulb } from "lucide-react";

const BRAND_GREEN = "#3A9615";
const TIP_ROTATE_MS = 6000;

interface SplashTip {
  title: string;
  body: string;
}

// Cross-role tips — written so they're useful to a receptionist on their
// first shift OR a tenant owner kicking the tyres for the first time.
// Order doesn't matter; first tip on screen is randomised at mount so
// fast bootstraps still surface variety across visits.
const SPLASH_TIPS: readonly SplashTip[] = [
  {
    title: "Hide what you can't use",
    body: "Free-plan warnings everywhere? Open Settings and turn them off — locked features will be hidden on this device.",
  },
  {
    title: "Select many at once",
    body: "Most tables and lists support multi-select. Tick the header checkbox to grab everything visible, then run bulk actions from the toolbar that slides in.",
  },
  {
    title: "Tailor the visitor form",
    body: "Visitors → Configure form lets you add, hide, or require any field — including custom questions and consent.",
  },
  {
    title: "Take the in-app tutorial",
    body: "Look for the Start tutorial button on key pages. Your progress saves between sessions so you can pick up where you left off.",
  },
  {
    title: "Lists refresh themselves",
    body: "Active visitors, pending approvals, and awaiting check-outs all poll on their own — no need to reload the page to see new arrivals.",
  },
  {
    title: "Built for the front desk",
    body: "On a tablet? The sidebar becomes a drawer and modals slide up from the bottom so the receptionist can work one-handed.",
  },
  {
    title: "Don't see a menu item?",
    body: "The sidebar only shows what your role can do. Ask an admin to update your role from Users if something looks missing.",
  },
] as const;

/**
 * Presentation-only branded splash. No redirects, no session reads —
 * drop this anywhere you need to fill the screen while something else
 * (bootstrap, route transition, etc.) is settling. The animated
 * scenes match `VisichekSplash` so the user sees one continuous
 * loading state instead of a spinner-then-splash hop.
 */
export function BrandedSplash({ label }: { label?: string }) {
  // `null` while we're still on the server / pre-hydration so SSR and the
  // first client render agree. The actual starting tip is picked in the
  // mount effect — Math.random() in a useState initialiser would diverge
  // between server and client and trip a hydration mismatch.
  const [tipIndex, setTipIndex] = useState<number | null>(null);

  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * SPLASH_TIPS.length));
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => ((i ?? 0) + 1) % SPLASH_TIPS.length);
    }, TIP_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const tip = tipIndex === null ? null : SPLASH_TIPS[tipIndex];

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-white text-gray-900 font-sans"
      role="status"
      aria-live="off"
      aria-label={label ?? "Loading VisiChek"}
    >
      <style>{`
        @keyframes branded-splash-logo-in {
          0%   { opacity: 0; transform: scale(0.72); }
          60%  { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes branded-splash-fade-up {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes branded-splash-fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes branded-splash-progress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes branded-splash-tip-in {
          0%   { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .branded-splash-logo {
          animation: branded-splash-logo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .branded-splash-wordmark {
          animation: branded-splash-fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
        }
        .branded-splash-tagline {
          animation: branded-splash-fade-in 640ms ease-out 620ms both;
        }
        .branded-splash-progress-bar {
          animation: branded-splash-progress 1.4s cubic-bezier(0.45, 0, 0.2, 1) infinite;
        }
        .branded-splash-tip-card {
          animation: branded-splash-fade-in 520ms ease-out 980ms both;
        }
        .branded-splash-tip-content {
          animation: branded-splash-tip-in 380ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .branded-splash-logo,
          .branded-splash-wordmark,
          .branded-splash-tagline,
          .branded-splash-progress-bar,
          .branded-splash-tip-card,
          .branded-splash-tip-content {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <Image
          src="/visichek_logo.svg"
          alt=""
          aria-hidden="true"
          width={128}
          height={128}
          priority
          unoptimized
          className="branded-splash-logo h-28 w-28 sm:h-32 sm:w-32"
        />

        <div className="mt-8 flex flex-col items-center text-center">
          <span className="branded-splash-wordmark font-display text-4xl font-bold tracking-tight text-gray-900">
            VisiChek
          </span>
          <span className="branded-splash-tagline mt-2 text-sm text-gray-500">
            Enterprise Visitor Management
          </span>
        </div>

        {tip && (
          <div
            className="branded-splash-tip-card mt-10 w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-left shadow-sm"
            aria-hidden="true"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <Lightbulb
                className="h-3.5 w-3.5"
                style={{ color: BRAND_GREEN }}
                aria-hidden="true"
              />
              Tip
            </div>
            <div
              key={tipIndex}
              className="branded-splash-tip-content mt-1"
            >
              <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {tip.body}
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden"
        style={{ backgroundColor: "rgba(53, 147, 0, 0.08)" }}
        aria-hidden="true"
      >
        <div
          className="branded-splash-progress-bar h-full w-1/4"
          style={{ backgroundColor: BRAND_GREEN }}
        />
      </div>

      <span className="sr-only">Loading VisiChek, please wait.</span>
    </div>
  );
}
