"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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
  Building2,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useRedirectIfAuthenticated } from "@/hooks/use-redirect-if-authenticated";
import { ApiError } from "@/types/api";
import { OtpInput } from "@/components/ui/otp-input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { apiGet } from "@/lib/api/request";
import { resolveDocumentUrl } from "@/lib/utils/document-url";
import type { TenantSelectionCandidate } from "@/types/account";

interface PublicTenantBranding {
  tenantId: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type View = "credentials" | "tenant_chooser" | "otp";

/** selectionToken expires server-side after 5 minutes. We mirror that
 *  here so the chooser auto-resets instead of letting the user click a
 *  card that's guaranteed to 401. */
const SELECTION_TOKEN_TTL_MS = 5 * 60 * 1000;

export default function AppLoginPage() {
  const { isChecking } = useRedirectIfAuthenticated();
  const { loginSystemUser, selectTenant, verifyOtp } = useAuth();
  const { navigateFromOverlay } = useNavigationLoading();

  const [view, setView] = useState<View>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Tenant-chooser state — selectionToken is memory-only by design.
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantSelectionCandidate[]>([]);
  const [loadingTenantId, setLoadingTenantId] = useState<string | null>(null);

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

  function resetToCredentials(message: string | null) {
    setSelectionToken(null);
    setTenants([]);
    setLoadingTenantId(null);
    setOtpChallengeId(null);
    setOtpCode("");
    setError(message);
    setView("credentials");
  }

  // Auto-expire the selectionToken after 5 minutes so a stale chooser
  // doesn't sit there waiting to 401.
  const ttlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (view !== "tenant_chooser" || !selectionToken) return;
    ttlTimerRef.current = setTimeout(() => {
      resetToCredentials("Your sign-in session expired. Please try again.");
    }, SELECTION_TOKEN_TTL_MS);
    return () => {
      if (ttlTimerRef.current) clearTimeout(ttlTimerRef.current);
    };
  }, [view, selectionToken]);

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      const result = await loginSystemUser(values);

      if (result.kind === "complete") {
        // Hook already redirected.
        return;
      }

      if (result.kind === "otp") {
        setOtpChallengeId(result.otpChallengeId);
        setOtpCode("");
        setView("otp");
        return;
      }

      // Multi-tenant: pick a workspace.
      // If only one tenant came back, save the user a click and submit it.
      if (result.tenants.length === 1) {
        await runTenantSelection(
          result.selectionToken,
          result.tenants[0].tenantId
        );
        return;
      }

      setSelectionToken(result.selectionToken);
      setTenants(result.tenants);
      setView("tenant_chooser");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "RESOURCE_NOT_FOUND") {
          setError("Account not found. Check your email and try again.");
        } else if (err.code === "TOO_MANY_REQUESTS" || err.status === 429) {
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

  async function runTenantSelection(token: string, tenantId: string) {
    setLoadingTenantId(tenantId);
    setError(null);
    try {
      const result = await selectTenant({
        selectionToken: token,
        tenantId,
      });

      if (result.kind === "complete") {
        // Hook already redirected.
        return;
      }

      if (result.kind === "otp") {
        setOtpChallengeId(result.otpChallengeId);
        setOtpCode("");
        setSelectionToken(null);
        setTenants([]);
        setLoadingTenantId(null);
        setView("otp");
      }
    } catch (err) {
      setLoadingTenantId(null);
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Token invalid/used/expired — back to credentials.
          resetToCredentials(
            "Your sign-in session expired. Please try again."
          );
        } else if (err.status === 403) {
          setError(
            "That workspace is no longer available for this account. Pick another or sign in again."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to enter that workspace. Please try again.");
      }
    }
  }

  function onSelectTenant(tenantId: string) {
    if (!selectionToken || loadingTenantId) return;
    void runTenantSelection(selectionToken, tenantId);
  }

  async function onVerifyOtp() {
    if (!otpChallengeId || otpCode.length < 6) return;
    setError(null);
    setIsVerifying(true);

    try {
      await verifyOtp({ otpChallengeId, otpCode }, "system_user");
      // Hook redirects on success.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError(
            "Too many OTP attempts. Please log in again to get a new code."
          );
          resetToCredentials(null);
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
    resetToCredentials(null);
  }

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const heading =
    view === "otp"
      ? "Two-Factor Authentication"
      : view === "tenant_chooser"
        ? "Choose a workspace"
        : "Welcome back";

  const subheading =
    view === "otp"
      ? "Enter the 6-digit code from your authenticator app"
      : view === "tenant_chooser"
        ? "Your email is linked to more than one workspace. Pick one to continue."
        : "Sign in to your workspace to continue";

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

          {view === "otp" ? (
            <OtpView
              otpCode={otpCode}
              setOtpCode={setOtpCode}
              isVerifying={isVerifying}
              onVerify={onVerifyOtp}
              onBack={handleBackToLogin}
            />
          ) : view === "tenant_chooser" ? (
            <TenantChooserView
              tenants={tenants}
              loadingTenantId={loadingTenantId}
              onSelect={onSelectTenant}
              onBack={handleBackToLogin}
            />
          ) : (
            <CredentialsView
              register={register}
              handleSubmit={handleSubmit}
              onSubmit={onSubmit}
              errors={errors}
              isSubmitting={isSubmitting}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          )}
        </main>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/support"
                onClick={(event) => {
                  if (
                    event.defaultPrevented ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  navigateFromOverlay("/support");
                }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors"
              >
                <HelpCircle size={16} aria-hidden="true" />
                Get Help & Support
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open the support page for help signing in or recovering access to
              your workspace
            </TooltipContent>
          </Tooltip>

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

type CredentialsViewProps = {
  register: ReturnType<typeof useForm<LoginFormValues>>["register"];
  handleSubmit: ReturnType<typeof useForm<LoginFormValues>>["handleSubmit"];
  onSubmit: (values: LoginFormValues) => Promise<void>;
  errors: ReturnType<typeof useForm<LoginFormValues>>["formState"]["errors"];
  isSubmitting: boolean;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
};

function CredentialsView({
  register,
  handleSubmit,
  onSubmit,
  errors,
  isSubmitting,
  showPassword,
  setShowPassword,
}: CredentialsViewProps) {
  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
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
                placeholder="name@company.com"
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#00D287] hover:text-[#00bd78] transition-colors"
                  >
                    Forgot password?
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Start the password recovery flow to reset access to your
                  account
                </TooltipContent>
              </Tooltip>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {showPassword
                    ? "Hide your password"
                    : "Show your password as you type"}
                </TooltipContent>
              </Tooltip>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 ml-1">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <Tooltip>
          <TooltipTrigger asChild>
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
                  Sign In to Workspace
                  <ArrowRight size={18} className="opacity-90" />
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Sign in to your workspace using your email and password
          </TooltipContent>
        </Tooltip>
      </form>
    </>
  );
}

type TenantChooserViewProps = {
  tenants: TenantSelectionCandidate[];
  loadingTenantId: string | null;
  onSelect: (tenantId: string) => void;
  onBack: () => void;
};

function TenantChooserView({
  tenants,
  loadingTenantId,
  onSelect,
  onBack,
}: TenantChooserViewProps) {
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-gray-100">
        {tenants.map((tenant) => {
          const isThisLoading = loadingTenantId === tenant.tenantId;
          const isAnyLoading = loadingTenantId !== null;

          return (
            <li key={tenant.tenantId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(tenant.tenantId)}
                    disabled={isAnyLoading}
                    className="w-full flex items-center gap-4 py-4 px-2 -mx-2 rounded-xl text-left transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D287]/30 min-h-[64px]"
                  >
                    <TenantWorkspaceAvatar
                      tenantId={tenant.tenantId}
                      companyName={tenant.companyName}
                    />

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {tenant.companyName}
                        </span>
                        {tenant.mfaEnabled && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center text-gray-400"
                                aria-label="Two-factor authentication required"
                              >
                                <Lock size={12} aria-hidden="true" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              This workspace requires a one-time code from your
                              authenticator app after you select it
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 capitalize truncate">
                        {tenant.role.replace(/_/g, " ")}
                      </p>
                    </div>

                    {/* Trailing: spinner or chevron */}
                    <div className="flex-shrink-0 text-gray-400">
                      {isThisLoading ? (
                        <Loader2
                          size={18}
                          className="animate-spin text-[#00D287]"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronRight size={18} aria-hidden="true" />
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Sign in to {tenant.companyName} as {tenant.role.replace(/_/g, " ")}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onBack}
            disabled={loadingTenantId !== null}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#00D287] transition-colors py-3 mt-2 disabled:opacity-60 disabled:pointer-events-none"
          >
            <ArrowLeft size={14} />
            Use a different account
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Discard this sign-in and return to the email and password screen
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

type OtpViewProps = {
  otpCode: string;
  setOtpCode: (v: string) => void;
  isVerifying: boolean;
  onVerify: () => void;
  onBack: () => void;
};

function OtpView({
  otpCode,
  setOtpCode,
  isVerifying,
  onVerify,
  onBack,
}: OtpViewProps) {
  return (
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
          onComplete={() => onVerify()}
          disabled={isVerifying}
          autoFocus
          aria-label="Enter your 6-digit verification code"
        />
        <p className="text-[11px] text-gray-400 text-center">
          You can also use a backup code
        </p>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onVerify}
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
        </TooltipTrigger>
        <TooltipContent side="top">
          Submit the 6-digit verification code to finish signing in
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
            Back to login
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Cancel verification and return to the sign-in screen
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ── Tenant chooser avatar ─────────────────────────────────────────────
//
// Fetches the tenant's public branding so the workspace card can show its
// real logo instead of generic initials. The endpoint is public (no auth
// required) which is what we need here — the user has a `selectionToken`
// at this point but no session cookie yet, so any authenticated branding
// route would 401.
function useTenantPublicBranding(tenantId: string) {
  return useQuery({
    queryKey: ["public", "tenant-branding", tenantId],
    queryFn: async () => {
      const data = await apiGet<PublicTenantBranding>(
        `/branding/public/tenant/${tenantId}`
      );
      return {
        ...data,
        logoUrl: resolveDocumentUrl(data.logoUrl) ?? undefined,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
}

function TenantWorkspaceAvatar({
  tenantId,
  companyName,
}: {
  tenantId: string;
  companyName: string;
}) {
  const { data } = useTenantPublicBranding(tenantId);
  const logoUrl = data?.logoUrl;
  const initials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex-shrink-0 h-11 w-11 rounded-full bg-[#00D287]/10 text-[#00D287] flex items-center justify-center overflow-hidden font-semibold text-sm">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={44}
          height={44}
          className="h-full w-full object-cover"
          onError={(event) => {
            // If the public document URL fails to load (e.g. tenant removed
            // the logo between fetches), drop the image so the initials
            // fallback shows through instead of a broken-image glyph.
            event.currentTarget.style.display = "none";
          }}
        />
      ) : initials ? (
        initials
      ) : (
        <Building2 size={18} aria-hidden="true" />
      )}
    </div>
  );
}
