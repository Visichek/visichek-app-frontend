"use client";

import { useMemo, useState } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  Loader2,
  Check,
  X,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useChangePassword } from "@/features/account/hooks";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  clearMustChangePassword,
  selectCurrentRole,
} from "@/lib/store/session-slice";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { getPostLoginPath } from "@/lib/routing/redirects";
import { ApiError } from "@/types/api";
import type { SessionType } from "@/types/auth";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  PASSWORD_RULES,
  getStrengthLevel,
} from "@/features/account/lib/password-rules";

/**
 * Forced first-login change-password screen for both shells.
 *
 * Every admin-provisioned account starts with a system-generated temp
 * password emailed to the user and `mustChangePassword = true`. Until the
 * user posts a real password here, every other endpoint returns 403
 * PASSWORD_CHANGE_REQUIRED, so this screen is the only landing they can
 * reach — the login hook and the API interceptor both redirect here.
 *
 * `currentPassword` is the temp password from the email. On success the
 * server clears the flag and lifts the gate; we drop the cached flag and
 * route onward (super admins are then picked up by the tenant shell's
 * tenant-info confirmation gate).
 */
export function ChangePasswordScreen({ shell }: { shell: SessionType }) {
  const dispatch = useAppDispatch();
  const currentRole = useAppSelector(selectCurrentRole);
  const { navigate } = useNavigationLoading();
  const changePassword = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruleResults = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(newPassword) })),
    [newPassword],
  );
  const passedCount = ruleResults.filter((r) => r.passed).length;
  const allPassed = passedCount === PASSWORD_RULES.length;
  const strength = getStrengthLevel(passedCount, PASSWORD_RULES.length);
  const matchesConfirm = confirm.length > 0 && confirm === newPassword;
  const reused = newPassword.length > 0 && newPassword === currentPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    allPassed &&
    matchesConfirm &&
    !reused &&
    !changePassword.isPending;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      dispatch(clearMustChangePassword());
      toast.success("Password updated. Welcome to VisiChek.");
      const next =
        shell === "admin"
          ? getPostLoginPath("admin")
          : getPostLoginPath("system_user", currentRole ?? undefined);
      navigate(next);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many attempts. Please wait a few minutes before trying again.",
          );
        } else {
          // 422 / 400 cover policy failures, history reuse (last 5), and a
          // wrong current/temp password — the message carries the specifics.
          setError(
            err.message ||
              "Couldn't update your password. Check the requirements and try again.",
          );
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center relative overflow-hidden font-sans selection:bg-[#3A9615]/20">
      <div className="w-full max-w-[440px] px-6 relative z-base">
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-display font-bold tracking-tight text-gray-900">
              VisiChek
            </span>
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Set your password
            </h1>
            <p className="text-sm text-gray-500">
              Your account was created with a temporary password. Choose a new
              one to finish signing in.
            </p>
          </div>
        </div>

        {/* Card */}
        <main
          id="main-content"
          className="bg-white border border-gray-100 rounded-3xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] p-8"
        >
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {/* Temporary (current) password */}
            <PasswordField
              id="current-password"
              label="Temporary password"
              icon={<KeyRound size={18} aria-hidden="true" />}
              value={currentPassword}
              onChange={setCurrentPassword}
              show={showCurrent}
              setShow={setShowCurrent}
              autoComplete="current-password"
              autoFocus
              hint="The one-time password from your welcome email."
            />

            {/* New password */}
            <PasswordField
              id="new-password"
              label="New password"
              icon={<Lock size={18} aria-hidden="true" />}
              value={newPassword}
              onChange={setNewPassword}
              show={showNew}
              setShow={setShowNew}
              autoComplete="new-password"
              error={reused ? "Pick something different from the temporary password" : undefined}
            />

            {/* Strength meter + rule checklist */}
            {newPassword.length > 0 && (
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

            {/* Confirm */}
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              icon={<Lock size={18} aria-hidden="true" />}
              value={confirm}
              onChange={setConfirm}
              show={showNew}
              setShow={setShowNew}
              autoComplete="new-password"
              error={
                confirm.length > 0 && confirm !== newPassword
                  ? "Passwords don't match"
                  : undefined
              }
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full min-h-[48px] bg-[#3A9615] hover:bg-[#2e7a11] disabled:opacity-60 disabled:pointer-events-none text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(58,150,21,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(58,150,21,0.6)] text-base md:text-sm"
                >
                  {changePassword.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                      Updating...
                    </>
                  ) : (
                    <>
                      Set password &amp; continue
                      <ArrowRight size={18} className="opacity-90" />
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Save your new password and continue into VisiChek — your
                temporary password stops working after this
              </TooltipContent>
            </Tooltip>
          </form>
        </main>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <Link
            href="/support"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3A9615] transition-colors"
          >
            <HelpCircle size={16} aria-hidden="true" />
            Get Help &amp; Support
          </Link>
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <ShieldCheck size={14} className="text-[#3A9615]" aria-hidden="true" />
            <span>Protected by VisiChek. Your data stays secure.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  icon,
  value,
  onChange,
  show,
  setShow,
  autoFocus,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-gray-700 ml-1">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#3A9615] transition-colors">
          {icon}
        </div>
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="login-input w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-12 text-base md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A9615]/25 focus:border-[#3A9615] transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {show ? "Hide your password" : "Show your password as you type"}
          </TooltipContent>
        </Tooltip>
      </div>
      {hint && !error && <p className="text-[11px] text-gray-400 ml-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 ml-1">{error}</p>}
    </div>
  );
}
