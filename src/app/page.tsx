import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Building2,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center relative overflow-hidden font-sans selection:bg-[#00D287]/20">
      {/* Soft ambient glows — calm, light, not loud */}
      <div
        className="absolute top-[-15%] right-[-10%] w-[55%] h-[55%] bg-[#00D287]/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-15%] left-[-10%] w-[55%] h-[55%] bg-emerald-100/50 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Very subtle light grid — barely visible, just for texture */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.025)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_40%,transparent_100%)] pointer-events-none"
        aria-hidden="true"
      />

      <div className="w-full max-w-[440px] px-6 relative z-10">
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-10">
          <span className="text-3xl font-display font-bold tracking-tight text-gray-900 mb-3">
            VisiChek
          </span>
          <p className="text-sm text-gray-500">
            Enterprise Visitor Management System
          </p>
        </div>

        {/* Portal Cards */}
        <div className="space-y-4">
          {/* Platform Admin Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00D287]/10 text-[#00D287]">
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Platform Administration
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Manage tenants, plans, and system settings
                </p>
              </div>
            </div>
            <Link
              href="/admin/login"
              className="w-full min-h-[44px] bg-[#00D287] hover:bg-[#00bd78] text-white font-semibold rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-sm"
            >
              Admin Login
              <ArrowRight size={16} className="opacity-90" />
            </Link>
          </div>

          {/* Tenant Portal Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00D287]/10 text-[#00D287]">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Tenant Portal
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Access your organization&apos;s visitor management system
                </p>
              </div>
            </div>
            <Link
              href="/app/login"
              className="w-full min-h-[44px] bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 hover:text-gray-900 font-semibold rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_1px_2px_rgba(15,23,42,0.04)] text-sm"
            >
              Tenant Login
              <ArrowRight size={16} className="opacity-90" />
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 flex flex-col items-center space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck
              size={14}
              className="text-[#00D287]"
              aria-hidden="true"
            />
            <span>Protected by VisiChek. Your data stays secure.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
