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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  async function onSubmit(values: ForgotFormValues) {
    setError(null);
    try {
      await forgotPassword({ email: values.email });
      // Backend always returns 202 — even for unknown emails — so we show
      // the same confirmation screen regardless. The lack of an email
      // arriving is the user's signal that the account doesn't exist.
      setSentToEmail(values.email);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many requests. Please wait a few minutes before trying again."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
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
              {sentToEmail ? "Check your inbox" : "Reset your password"}
            </h1>
            <p className="text-sm text-gray-500">
              {sentToEmail
                ? "If an account matches that email, we've sent reset instructions."
                : "Enter the email tied to your account and we'll send a reset link."}
            </p>
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

          {sentToEmail ? (
            <SentConfirmation
              email={sentToEmail}
              onResend={() => setSentToEmail(null)}
            />
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
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
                  <p className="text-xs text-red-600 ml-1">
                    {errors.email.message}
                  </p>
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
                        <Loader2
                          size={18}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send reset link
                        <ArrowRight size={18} className="opacity-90" />
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Email a single-use password reset link to the address you
                  entered
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

function SentConfirmation({
  email,
  onResend,
}: {
  email: string;
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
          We sent a reset link to{" "}
          <span className="font-medium text-gray-900 break-all">{email}</span>.
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
        Make sure the address is spelled correctly and try again. We don&apos;t
        confirm whether an email is registered, so a missing email usually
        means the address isn&apos;t on file.
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
