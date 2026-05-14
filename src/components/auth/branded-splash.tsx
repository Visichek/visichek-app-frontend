"use client";

const BRAND_GREEN = "#359300";

/**
 * Presentation-only branded splash. No redirects, no session reads —
 * drop this anywhere you need to fill the screen while something else
 * (bootstrap, route transition, etc.) is settling. The animated
 * scenes match `VisichekSplash` so the user sees one continuous
 * loading state instead of a spinner-then-splash hop.
 */
export function BrandedSplash({ label }: { label?: string }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-white text-gray-900 font-sans"
      role="status"
      aria-live="polite"
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
        @media (prefers-reduced-motion: reduce) {
          .branded-splash-logo,
          .branded-splash-wordmark,
          .branded-splash-tagline,
          .branded-splash-progress-bar {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/visichek_logo.svg"
          alt=""
          aria-hidden="true"
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
