import Link from "next/link";
import {
  Mail,
  Phone,
  MessageCircle,
  FileText,
  ArrowLeft,
  ShieldCheck,
  HelpCircle,
  BookOpen,
  LifeBuoy,
} from "lucide-react";

export default function SupportPage() {
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

      <div className="w-full max-w-lg px-6 py-12 relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-emerald-400 transition-colors mb-8"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to login
        </Link>

        {/* Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 mb-4">
            <LifeBuoy size={24} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Help & Support
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm">
            Need assistance? Reach out through any of the channels below and
            we&apos;ll get you sorted.
          </p>
        </div>

        {/* Support channels */}
        <div className="space-y-3">
          {/* Email */}
          <a
            href="mailto:support@visichek.com"
            className="flex items-start gap-4 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 shadow-lg hover:border-emerald-500/30 transition-colors group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
              <Mail size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Email Support
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                support@visichek.com
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                We typically respond within 24 hours.
              </p>
            </div>
          </a>

          {/* Phone */}
          <a
            href="tel:+2341234567890"
            className="flex items-start gap-4 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 shadow-lg hover:border-emerald-500/30 transition-colors group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
              <Phone size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Phone</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                +234 123 456 7890
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Available Mon-Fri, 9 AM — 5 PM WAT.
              </p>
            </div>
          </a>

          {/* Live Chat */}
          <div className="flex items-start gap-4 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 shadow-lg">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <MessageCircle size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Live Chat</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Chat with our support team in real time.
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Coming soon.
              </p>
            </div>
          </div>

          {/* Documentation */}
          <div className="flex items-start gap-4 bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 shadow-lg">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <BookOpen size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Documentation
              </h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Guides, FAQs, and troubleshooting articles.
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Coming soon.
              </p>
            </div>
          </div>
        </div>

        {/* Common questions */}
        <div className="mt-10">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4 ml-1">
            Common questions
          </h3>
          <div className="space-y-2">
            <details className="group bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
              <summary className="flex items-center gap-3 cursor-pointer px-5 py-3.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors list-none">
                <HelpCircle
                  size={16}
                  className="shrink-0 text-emerald-500/70"
                  aria-hidden="true"
                />
                Where do I find my Workspace ID?
              </summary>
              <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
                Your Workspace ID is provided by your organization&apos;s
                administrator when your account is created. It&apos;s typically
                a short slug like &quot;acme-corp&quot;. If you&apos;re unsure,
                contact your admin or email us at support@visichek.com.
              </div>
            </details>

            <details className="group bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
              <summary className="flex items-center gap-3 cursor-pointer px-5 py-3.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors list-none">
                <HelpCircle
                  size={16}
                  className="shrink-0 text-emerald-500/70"
                  aria-hidden="true"
                />
                I forgot my password
              </summary>
              <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
                Use the &quot;Forgot password?&quot; link on the login page to
                reset your password. You&apos;ll receive a reset link at the
                email address associated with your account.
              </div>
            </details>

            <details className="group bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
              <summary className="flex items-center gap-3 cursor-pointer px-5 py-3.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors list-none">
                <HelpCircle
                  size={16}
                  className="shrink-0 text-emerald-500/70"
                  aria-hidden="true"
                />
                My account is locked
              </summary>
              <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
                After multiple failed login attempts your account is
                temporarily locked. Wait a few minutes and try again, or contact
                your administrator to unlock it manually.
              </div>
            </details>
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
