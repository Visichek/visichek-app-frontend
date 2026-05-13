"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useSession } from "@/hooks/use-session";

/**
 * Branded loading splash shown at `/`. Plays a short entrance animation
 * (logo + wordmark + animated progress bar) while session bootstrap
 * resolves, then routes the user to where they actually belong:
 *
 *   - authenticated admin → `/admin/dashboard`
 *   - authenticated tenant user → `/app/dashboard`
 *   - unauthenticated → `/login` (dual-portal chooser)
 *
 * A minimum on-screen time keeps the animation from flashing past on
 * fast networks. A safety timer guarantees we never strand the user on
 * the splash if bootstrap stalls on a hung backend.
 */

const MIN_VISIBLE_MS = 1600;
const SAFETY_TIMEOUT_MS = 10_000;

export function VisichekSplash() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, isSystemUser, isBootstrapping } = useSession();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (isBootstrapping) return;
    if (!minTimeElapsed) return;

    hasRedirectedRef.current = true;
    if (isAuthenticated && isAdmin) {
      router.replace("/admin/dashboard");
    } else if (isAuthenticated && isSystemUser) {
      router.replace("/app/dashboard");
    } else {
      router.replace("/login");
    }
  }, [
    isAuthenticated,
    isAdmin,
    isSystemUser,
    isBootstrapping,
    minTimeElapsed,
    router,
  ]);

  useEffect(() => {
    const safety = window.setTimeout(() => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      router.replace("/login");
    }, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(safety);
  }, [router]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-white text-gray-900 font-sans"
      role="status"
      aria-live="polite"
      aria-label="Loading VisiChek"
    >
      <style>{`
        @keyframes visichek-logo-in {
          0%   { opacity: 0; transform: scale(0.72); }
          60%  { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes visichek-fade-up {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes visichek-fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes visichek-pulse-ring {
          0%   { transform: scale(0.85); opacity: 0.55; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes visichek-progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .visichek-logo {
          animation: visichek-logo-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .visichek-ring {
          animation: visichek-pulse-ring 2.2s ease-out 400ms infinite;
        }
        .visichek-wordmark {
          animation: visichek-fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) 320ms both;
        }
        .visichek-tagline {
          animation: visichek-fade-in 640ms ease-out 620ms both;
        }
        .visichek-progress-bar {
          animation: visichek-progress-slide 1.4s cubic-bezier(0.45, 0, 0.2, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .visichek-logo,
          .visichek-ring,
          .visichek-wordmark,
          .visichek-tagline,
          .visichek-progress-bar {
            animation: none !important;
          }
        }
      `}</style>

      <div
        className="pointer-events-none absolute right-[-10%] top-[-15%] h-[55%] w-[55%] rounded-full bg-[#00D287]/10 blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-15%] left-[-10%] h-[55%] w-[55%] rounded-full bg-emerald-100/50 blur-[140px]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden="true"
            className="visichek-ring absolute inline-block h-20 w-20 rounded-3xl border-2 border-[#00D287]/40"
          />
          <span
            aria-hidden="true"
            className="visichek-ring absolute inline-block h-20 w-20 rounded-3xl border-2 border-[#00D287]/30"
            style={{ animationDelay: "1.1s" }}
          />
          <div className="visichek-logo flex h-20 w-20 items-center justify-center rounded-3xl bg-[#00D287] text-white shadow-[0_18px_50px_-12px_rgba(0,210,135,0.5)]">
            <ShieldCheck className="h-9 w-9" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center text-center">
          <span className="visichek-wordmark font-display text-4xl font-bold tracking-tight text-gray-900">
            VisiChek
          </span>
          <span className="visichek-tagline mt-2 text-sm text-gray-500">
            Enterprise Visitor Management
          </span>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-emerald-50"
        aria-hidden="true"
      >
        <div className="visichek-progress-bar h-full w-1/4 bg-gradient-to-r from-transparent via-[#00D287] to-transparent" />
      </div>

      <span className="sr-only">Loading VisiChek, please wait.</span>
    </div>
  );
}
