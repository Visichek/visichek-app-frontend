import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Building2,
  Users,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center relative overflow-hidden font-sans selection:bg-emerald-500/30">
      {/* Ambient Background Glows */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Subtle Grid Background */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[440px] px-6 relative z-10">
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-10">
          <span className="text-3xl font-display font-bold tracking-tight text-white mb-3">
            VisiChek
          </span>
          <p className="text-sm text-zinc-400">
            Enterprise Visitor Management System
          </p>
        </div>

        {/* Portal Cards */}
        <div className="space-y-4">
          {/* Platform Admin Card */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Platform Administration
                </h2>
                <p className="text-sm text-zinc-400 mt-0.5">
                  Manage tenants, plans, and system settings
                </p>
              </div>
            </div>
            <Link
              href="/admin/login"
              className="w-full min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.6)] text-sm"
            >
              Admin Login
              <ArrowRight size={16} className="opacity-80" />
            </Link>
          </div>

          {/* Tenant Portal Card */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Tenant Portal
                </h2>
                <p className="text-sm text-zinc-400 mt-0.5">
                  Access your organization&apos;s visitor management system
                </p>
              </div>
            </div>
            <Link
              href="/app/login"
              className="w-full min-h-[44px] bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-semibold rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] text-sm"
            >
              Tenant Login
              <ArrowRight size={16} className="opacity-80" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 flex flex-col items-center space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck
              size={14}
              className="text-emerald-500/70"
              aria-hidden="true"
            />
            <span>Protected by VisiChek. Your data stays secure.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
