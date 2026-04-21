"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  KeyRound,
} from "lucide-react";
import { useAuth, type LoginResult } from "@/hooks/use-auth";
import { useRedirectIfAuthenticated } from "@/hooks/use-redirect-if-authenticated";
import { ApiError } from "@/types/api";
import { OtpInput } from "@/components/ui/otp-input";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const { isChecking } = useRedirectIfAuthenticated();
  const { loginAdmin, verifyOtp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // OTP state
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      const result = await loginAdmin(values);

      // If OTP is required, show the OTP form instead of redirecting
      if (result.otpRequired) {
        setOtpChallengeId(result.otpChallengeId);
        setOtpCode("");
      }
      // If otpRequired is false, the hook already redirected to dashboard
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "TOO_MANY_REQUESTS") {
          setError(
            "Too many login attempts. Your account has been temporarily locked. Please try again later."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  }

  async function onVerifyOtp() {
    if (!otpChallengeId || otpCode.length < 6) return;
    setError(null);
    setIsVerifying(true);

    try {
      await verifyOtp(
        { otpChallengeId, otpCode },
        "admin"
      );
      // On success the hook redirects to the dashboard
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many OTP attempts. Please log in again to get a new code."
          );
          // Reset to login form since the challenge is expired
          setOtpChallengeId(null);
          setOtpCode("");
        } else {
          setError(err.message || "Invalid code. Please try again.");
        }
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  }

  function handleBackToLogin() {
    setOtpChallengeId(null);
    setOtpCode("");
    setError(null);
  }

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center relative overflow-hidden font-sans selection:bg-[#00D287]/20">
      {/* Very subtle light grid — barely visible, just for texture */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.025)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_40%,transparent_100%)] pointer-events-none"
        aria-hidden="true"
      />

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
              {otpChallengeId ? "Two-Factor Authentication" : "Platform Administration"}
            </h1>
            <p className="text-sm text-gray-500">
              {otpChallengeId
                ? "Enter the 6-digit code from your authenticator app"
                : "Sign in to the VisiChek admin console"}
            </p>
          </div>
        </div>

        {/* Main Card */}
        <main
          id="main-content"
          className="bg-white border border-gray-100 rounded-3xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] p-8"
        >
          {/* Error Banner */}
          {error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6"
              role="alert"
            >
              {error}
            </div>
          )}

          {otpChallengeId ? (
            /* ── OTP Verification Form ────────────────────── */
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-[#00D287]/10 p-4">
                  <KeyRound className="h-8 w-8 text-[#00D287]" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-700 ml-1 block text-center">
                  Verification code
                </label>
                <OtpInput
                  length={6}
                  value={otpCode}
                  onChange={setOtpCode}
                  onComplete={(_code) => onVerifyOtp()}
                  disabled={isVerifying}
                  autoFocus
                  aria-label="Enter your 6-digit verification code"
                />
                <p className="text-[11px] text-gray-400 text-center">
                  You can also use a backup code
                </p>
              </div>

              <button
                type="button"
                onClick={onVerifyOtp}
                disabled={otpCode.length < 6 || isVerifying}
                className="w-full min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] disabled:opacity-60 disabled:pointer-events-none text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] text-base md:text-sm"
              >
                {isVerifying ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Code
                    <ArrowRight size={18} className="opacity-90" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors py-2"
              >
                <ArrowLeft size={14} />
                Back to login
              </button>
            </div>
          ) : (
            /* ── Login Form ───────────────────────────────── */
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              {/* Credentials */}
              <div className="space-y-4">
                {/* Email */}
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
                      placeholder="admin@visichek.com"
                      autoComplete="email"
                      autoFocus
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

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <label
                      htmlFor="password"
                      className="text-xs font-medium text-gray-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-[#00D287] hover:text-[#00bd78] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00D287] transition-colors">
                      <Lock size={18} aria-hidden="true" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="login-input w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-12 text-base md:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D287]/25 focus:border-[#00D287] transition-all shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-600 ml-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] bg-[#00D287] hover:bg-[#00bd78] disabled:opacity-60 disabled:pointer-events-none text-white font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_6px_20px_-6px_rgba(0,210,135,0.5)] hover:shadow-[0_8px_24px_-6px_rgba(0,210,135,0.6)] mt-2 text-base md:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={18} className="opacity-90" />
                  </>
                )}
              </button>
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
