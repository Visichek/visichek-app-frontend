"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Mail,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MailCheck,
  Building2,
  Server,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";
import type { ForgotPasswordAccount } from "@/types/auth";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

/**
 * Recovery is a two-step lookup → pick flow (step 3, the actual reset, lives
 * on /reset-password and is opened by the email link). One email can map to
 * several accounts, so step 1 returns them all and the user chooses which to
 * recover before any email is sent.
 */
type Stage =
  | { kind: "email" }
  | {
      kind: "pick";
      email: string;
      selectionToken: string;
      accounts: ForgotPasswordAccount[];
    }
  | { kind: "sent"; email: string; count: number };

export default function ForgotPasswordPage() {
  const { forgotPassword, sendResetLinks } = useAuth();
  const [stage, setStage] = useState<Stage>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);

  const heading =
    stage.kind === "sent"
      ? "Check your inbox"
      : stage.kind === "pick"
        ? "Which account?"
        : "Reset your password";

  const subheading =
    stage.kind === "sent"
      ? "If an account matches that email, we've sent reset instructions."
      : stage.kind === "pick"
        ? "Pick the login you'd like to recover."
        : "Enter the email tied to your account and we'll send a reset link.";

  function restart() {
    setError(null);
    setStage({ kind: "email" });
  }

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
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6"
              role="alert"
            >
              {error}
            </div>
          )}

          {stage.kind === "email" && (
            <EmailStep
              onError={setError}
              onResult={(email, lookup) => {
                setError(null);
                // No matching accounts → don't reveal that. Show the same
                // neutral confirmation we'd show after a real send.
                if (lookup.accounts.length === 0) {
                  setStage({ kind: "sent", email, count: 0 });
                  return;
                }
                setStage({
                  kind: "pick",
                  email,
                  selectionToken: lookup.selectionToken,
                  accounts: lookup.accounts,
                });
              }}
              forgotPassword={forgotPassword}
            />
          )}

          {stage.kind === "pick" && (
            <PickStep
              email={stage.email}
              accounts={stage.accounts}
              onError={setError}
              onExpired={(message) => {
                setError(message);
                setStage({ kind: "email" });
              }}
              onBack={restart}
              onSent={(count) => {
                setError(null);
                setStage({ kind: "sent", email: stage.email, count });
              }}
              sendResetLinks={(accountRefs) =>
                sendResetLinks({
                  selectionToken: stage.selectionToken,
                  accountRefs,
                })
              }
            />
          )}

          {stage.kind === "sent" && (
            <SentConfirmation
              email={stage.email}
              count={stage.count}
              onResend={restart}
            />
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

// ── Step 1: enter email ─────────────────────────────────────────────────

function EmailStep({
  forgotPassword,
  onResult,
  onError,
}: {
  forgotPassword: ReturnType<typeof useAuth>["forgotPassword"];
  onResult: (
    email: string,
    lookup: Awaited<ReturnType<ReturnType<typeof useAuth>["forgotPassword"]>>,
  ) => void;
  onError: (message: string | null) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  async function onSubmit(values: ForgotFormValues) {
    onError(null);
    try {
      const lookup = await forgotPassword({ email: values.email });
      onResult(values.email, lookup);
    } catch (err) {
      if (err instanceof ApiError) {
        onError(
          err.status === 429
            ? "Too many requests. Please wait a few minutes before trying again."
            : err.message,
        );
      } else {
        onError("An unexpected error occurred. Please try again.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-xs font-medium text-gray-700 ml-1"
        >
          Email
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00D287] transition-colors">
            <Mail size={18} aria-hidden="true" />
          </div>
          <input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            inputMode="email"
            className="login-input w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-base md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D287]/25 focus:border-[#00D287] transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-600 ml-1">{errors.email.message}</p>
        )}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] disabled:opacity-60 disabled:pointer-events-none text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Looking up your accounts...
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={18} className="opacity-90" />
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Look up the accounts tied to this email so you can choose which one
          to reset — no email is sent yet
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
          Cancel and return to the sign-in page
        </TooltipContent>
      </Tooltip>
    </form>
  );
}

// ── Step 2: pick account(s) ──────────────────────────────────────────────

function PickStep({
  email,
  accounts,
  sendResetLinks,
  onSent,
  onExpired,
  onError,
  onBack,
}: {
  email: string;
  accounts: ForgotPasswordAccount[];
  sendResetLinks: (accountRefs: string[]) => Promise<{ sent: number }>;
  onSent: (count: number) => void;
  onExpired: (message: string) => void;
  onError: (message: string | null) => void;
  onBack: () => void;
}) {
  // Pre-select every account so the common single-account case is one click.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(accounts.map((a) => a.accountRef)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggle(accountRef: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountRef)) next.delete(accountRef);
      else next.add(accountRef);
      return next;
    });
  }

  async function onSend() {
    if (selected.size === 0 || isSubmitting) return;
    onError(null);
    setIsSubmitting(true);
    try {
      const result = await sendResetLinks(Array.from(selected));
      onSent(result.sent);
    } catch (err) {
      // A 400 means the selection token expired / was already used — the
      // only recovery is to start over at step 1.
      if (err instanceof ApiError && err.status === 400) {
        onExpired(
          "This request expired before you finished. Please enter your email again.",
        );
      } else if (err instanceof ApiError && err.status === 429) {
        onError(
          "Too many requests. Please wait a few minutes before trying again.",
        );
      } else if (err instanceof ApiError) {
        onError(err.message);
      } else {
        onError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Accounts for{" "}
        <span className="font-medium text-gray-900 break-all">{email}</span>
      </p>

      <fieldset className="space-y-2.5">
        <legend className="sr-only">
          Choose which accounts to send a reset link to
        </legend>
        {accounts.map((account) => {
          const isChecked = selected.has(account.accountRef);
          return (
            <label
              key={account.accountRef}
              className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                isChecked
                  ? "border-[#00D287] bg-[#00D287]/5 shadow-[0_1px_2px_rgba(0,210,135,0.12)]"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(account.accountRef)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-[#00D287] focus:ring-2 focus:ring-[#00D287]/40 focus:ring-offset-0"
                aria-label={`Send a reset link to your ${account.roleLabel} login${
                  account.type === "tenant" && account.tenantName
                    ? ` for ${account.tenantName}`
                    : ""
                }`}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  {account.type === "platform" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Server size={11} aria-hidden="true" />
                      VisiChek Platform
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#00D287]/10 px-2 py-0.5 text-[10px] font-medium text-[#00845a]">
                      <Building2 size={11} aria-hidden="true" />
                      Workspace
                    </span>
                  )}
                </span>
                <span className="truncate text-sm font-medium text-gray-900">
                  {account.type === "tenant"
                    ? account.tenantName ?? account.label
                    : account.label}
                </span>
                <span className="text-xs text-gray-500">
                  {account.roleLabel}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSend}
            disabled={selected.size === 0 || isSubmitting}
            className="w-full min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] disabled:opacity-60 disabled:pointer-events-none text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              <>
                {selected.size > 1
                  ? `Send ${selected.size} reset links`
                  : "Send reset link"}
                <ArrowRight size={18} className="opacity-90" />
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Email a single-use reset link to the address on file for each
          selected account
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors py-2"
          >
            <ArrowLeft size={14} />
            Use a different email
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Go back and look up accounts for a different email address
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ── Step 2 result: confirmation ──────────────────────────────────────────

function SentConfirmation({
  email,
  count,
  onResend,
}: {
  email: string;
  count: number;
  onResend: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-[#00D287]/10 p-4">
          <MailCheck className="h-8 w-8 text-[#00D287]" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-700">
          {count > 1 ? (
            <>
              We sent {count} reset links to{" "}
              <span className="font-medium text-gray-900 break-all">
                {email}
              </span>
              , one per account you chose.
            </>
          ) : (
            <>
              If an account matches{" "}
              <span className="font-medium text-gray-900 break-all">
                {email}
              </span>
              , a reset link is on its way.
            </>
          )}
        </p>
        <p className="text-xs text-gray-500">
          The link expires in about an hour. Can&apos;t find it? Check your
          spam folder.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left text-xs text-gray-600 leading-relaxed">
        <span className="font-medium text-gray-700">
          Don&apos;t see anything after a few minutes?
        </span>{" "}
        Make sure the address is spelled correctly and try again. Each link is
        single-use and signs you out everywhere once a new password is set.
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] text-white font-semibold rounded-xl py-3 px-4 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
          >
            Return to sign in
            <ArrowRight size={18} className="opacity-90" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          Go back to the sign-in page to enter your new password once the
          reset is complete
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onResend}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors py-2"
          >
            <ArrowLeft size={14} />
            Use a different email
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Go back and request a reset link for a different email address
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
