"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

const loginSchema = z.object({
  tenantId: z.string().min(1, "Workspace ID is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AppLoginPage() {
  const { loginSystemUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      await loginSystemUser(
        { email: values.email, password: values.password },
        values.tenantId
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "RESOURCE_NOT_FOUND") {
          setError("Workspace not found. Please check your Workspace ID.");
        } else if (err.code === "TOO_MANY_REQUESTS") {
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

      <div className="w-full max-w-[440px] px-6 relative z-base">
        {/* Logo Area */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl font-display font-bold tracking-tight text-white">
              VisiChek
            </span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-zinc-400">
              Sign in to your workspace to continue
            </p>
          </div>
        </div>

        {/* Main Card */}
        <main
          id="main-content"
          className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/60 rounded-3xl shadow-2xl p-8"
        >
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
          >
            {/* Error Banner */}
            {error && (
              <div
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Workspace ID */}
            <div className="space-y-1.5">
              <label
                htmlFor="tenantId"
                className="text-xs font-medium text-zinc-300 ml-1"
              >
                Workspace ID
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                  <Building2 size={18} aria-hidden="true" />
                </div>
                <input
                  id="tenantId"
                  type="text"
                  placeholder="e.g. acme-corp"
                  autoComplete="organization"
                  autoFocus
                  className="login-input w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-base md:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  {...register("tenantId")}
                />
              </div>
              {errors.tenantId ? (
                <p className="text-xs text-red-400 ml-1">
                  {errors.tenantId.message}
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500 ml-1">
                  Provided by your organization administrator.
                </p>
              )}
            </div>

            {/* Divider */}
            <div
              className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent"
              aria-hidden="true"
            />

            {/* Credentials */}
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium text-zinc-300 ml-1"
                >
                  Email or mobile number
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                    <Mail size={18} aria-hidden="true" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="login-input w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-base md:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400 ml-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium text-zinc-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                    <Lock size={18} aria-hidden="true" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="login-input w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-12 text-base md:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
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
                  <p className="text-xs text-red-400 ml-1">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:pointer-events-none text-zinc-950 font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.6)] mt-2 text-base md:text-sm"
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
                  Sign In to Workspace
                  <ArrowRight size={18} className="opacity-80" />
                </>
              )}
            </button>
          </form>

          {/* SSO Options */}
          <div className="mt-8">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-zinc-800" />
              <span className="flex-shrink-0 mx-4 text-xs text-zinc-500 font-medium">
                OR CONTINUE WITH
              </span>
              <div className="flex-grow border-t border-zinc-800" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm font-medium text-zinc-300 transition-colors min-h-[44px]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm font-medium text-zinc-300 transition-colors min-h-[44px]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 21 21"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M10 0H0v10h10V0z" fill="#f25022" />
                  <path d="M21 0H11v10h10V0z" fill="#7fba00" />
                  <path d="M10 11H0v10h10V11z" fill="#00a4ef" />
                  <path d="M21 11H11v10h10V11z" fill="#ffb900" />
                </svg>
                Microsoft
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <Link
            href="/support"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            <HelpCircle size={16} aria-hidden="true" />
            Get Help & Support
          </Link>

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
