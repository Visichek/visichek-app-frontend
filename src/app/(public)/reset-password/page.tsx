"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  PASSWORD_RULES,
  getStrengthLevel,
} from "@/features/account/lib/password-rules";

type ViewState =
  | { kind: "missing_token" }
  | { kind: "form" }
  | { kind: "expired"; message: string }
  | { kind: "done" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function PageLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
    </div>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { resetPassword } = useAuth();

  const initialView: ViewState = token ? { kind: "form" } : { kind: "missing_token" };
  const [view, setView] = useState<ViewState>(initialView);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ruleResults = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password]
  );
  const passedCount = ruleResults.filter((r) => r.passed).length;
  const allPassed = passedCount === PASSWORD_RULES.length;
  const strength = getStrengthLevel(passedCount, PASSWORD_RULES.length);
  const matchesConfirm = confirm.length > 0 && confirm === password;
  const canSubmit = allPassed && matchesConfirm && !isSubmitting;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword({ token, newPassword: password });
      setView({ kind: "done" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          // Token expired or already used — the link is dead. Move the user
          // to the dedicated dead-link state so the only CTA is "request a
          // new link" instead of letting them keep retrying the same token.
          setView({
            kind: "expired",
            message:
              err.message ||
              "This reset link has expired or already been used.",
          });
        } else if (err.status === 422) {
          // Password policy violation — keep the form mounted so the user
          // can correct it. The rule list is already on screen.
          setError(
            err.message ||
              "That password doesn't meet our policy. Adjust it and try again."
          );
        } else if (err.status === 429) {
          setError(
            "Too many attempts. Please wait a few minutes before trying again."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading =
    view.kind === "done"
      ? "Password updated"
      : view.kind === "expired"
        ? "Link no longer valid"
        : view.kind === "missing_token"
          ? "Reset link required"
          : "Choose a new password";

  const subheading =
    view.kind === "done"
      ? "You can now sign in with your new password."
      : view.kind === "expired"
        ? "Request a new reset link to continue."
        : view.kind === "missing_token"
          ? "Open the link in the reset email we sent you."
          : "Pick something you haven't used here before.";

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center relative overflow-hidden font-sans selection:bg-[#00D287]/20">
      <div className="w-full max-w-[440px] px-6 relative z-base">
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-display font-bold tracking-tight text-gray-900">
              VisiChek
            </span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              {heading}
            </h1>
            <p className="text-sm text-gray-500">{subheading}</p>
          </div>
        </div>

        {/* Main Card */}
        <main
          id="main-content"
          className="bg-white border border-gray-100 rounded-3xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] p-8"
        >
          {error && view.kind === "form" && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6"
              role="alert"
            >
              {error}
            </div>
          )}

          {view.kind === "missing_token" && <MissingTokenView />}
          {view.kind === "expired" && <ExpiredTokenView message={view.message} />}
          {view.kind === "done" && <SuccessView />}
          {view.kind === "form" && (
            <form onSubmit={onSubmit} className="space-y-6" noValidate>
              <PasswordField
                id="new-password"
                label="New password"
                value={password}
                onChange={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                autoFocus
                autoComplete="new-password"
              />

              {/* Strength meter + rule list */}
              {password.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Strength</span>
                    <span
                      className={
                        strength.label === "Strong"
                          ? "font-medium text-emerald-600"
                          : strength.label === "Good"
                            ? "font-medium text-blue-600"
                            : strength.label === "Fair"
                              ? "font-medium text-amber-600"
                              : "font-medium text-red-600"
                      }
                    >
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`${strength.color} ${strength.width} h-full transition-all duration-200`}
                    />
                  </div>
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {ruleResults.map((rule) => (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-[11px] ${
                          rule.passed ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        {rule.passed ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          <X size={12} aria-hidden="true" />
                        )}
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <PasswordField
                id="confirm-password"
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                // Re-use the same visibility toggle so toggling once flips
                // both fields and the user can compare what they typed.
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                autoComplete="new-password"
                error={
                  confirm.length > 0 && confirm !== password
                    ? "Passwords don't match"
                    : undefined
                }
              />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] disabled:opacity-60 disabled:pointer-events-none text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2
                          size={18}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Updating...
                      </>
                    ) : (
                      <>
                        Update password
                        <ArrowRight size={18} className="opacity-90" />
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Save the new password and invalidate the reset link so it
                  can&apos;t be reused
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/login"
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors py-2"
                  >
                    <ArrowLeft size={14} />
                    Back to sign in
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Cancel the reset and return to the sign-in page
                </TooltipContent>
              </Tooltip>
            </form>
          )}
        </main>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <Link
            href="/support"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors"
          >
            <HelpCircle size={16} aria-hidden="true" />
            Get Help & Support
          </Link>

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

// ── Subviews ──────────────────────────────────────────────────────────

function MissingTokenView() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-amber-50 p-4">
          <AlertTriangle
            className="h-8 w-8 text-amber-500"
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="text-sm text-gray-700">
        The page was opened without a reset token. Please use the button in
        the email we sent you, or request a new reset link below.
      </p>

      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/forgot-password"
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] text-white font-semibold rounded-xl py-3 px-4 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
          >
            Request a new link
            <ArrowRight size={18} className="opacity-90" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          Open the reset request form so we can email you a new password
          reset link
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function ExpiredTokenView({ message }: { message: string }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-amber-50 p-4">
          <AlertTriangle
            className="h-8 w-8 text-amber-500"
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="text-sm text-gray-700">{message}</p>

      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/forgot-password"
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] text-white font-semibold rounded-xl py-3 px-4 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
          >
            Request a new link
            <ArrowRight size={18} className="opacity-90" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          Open the reset request form so we can email you a fresh password
          reset link
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function SuccessView() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-[#00D287]/10 p-4">
          <CheckCircle2
            className="h-8 w-8 text-[#00D287]"
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="text-sm text-gray-700">
        Your password has been updated. Sign in to continue.
      </p>

      <div className="space-y-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/app/login"
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] text-white font-semibold rounded-xl py-3 px-4 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
            >
              Sign in to your workspace
              <ArrowRight size={18} className="opacity-90" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">
            Go to the workspace sign-in page for tenant staff
            (super admin, receptionist, DPO, and others)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/admin/login"
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors py-2"
            >
              Platform admin? Sign in here
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">
            Go to the VisiChek platform admin console sign-in page
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Password field ────────────────────────────────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  showPassword,
  setShowPassword,
  autoFocus,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-gray-700 ml-1">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00D287] transition-colors">
          <Lock size={18} aria-hidden="true" />
        </div>
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="login-input w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-12 text-base md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D287]/25 focus:border-[#00D287] transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {showPassword ? "Hide your password" : "Show your password as you type"}
          </TooltipContent>
        </Tooltip>
      </div>
      {error && <p className="text-xs text-red-600 ml-1">{error}</p>}
    </div>
  );
}
