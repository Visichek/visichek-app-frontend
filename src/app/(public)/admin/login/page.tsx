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
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const { loginAdmin } = useAuth();
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
      await loginAdmin(values);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
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
              Platform Administration
            </h1>
            <p className="text-sm text-zinc-400">
              Sign in to the VisiChek admin console
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

            {/* Credentials */}
            <div className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium text-zinc-300 ml-1"
                >
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                    <Mail size={18} aria-hidden="true" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@visichek.com"
                    autoComplete="email"
                    autoFocus
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
                  Sign In
                  <ArrowRight size={18} className="opacity-80" />
                </>
              )}
            </button>
          </form>
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
