"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/feedback/loading-button";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/types/api";

const loginSchema = z.object({
  tenant_id: z.string().min(1, "Workspace ID is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AppLoginPage() {
  const { loginSystemUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
        values.tenant_id
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-display">Sign In</CardTitle>
          <CardDescription>
            Sign in to your VisiChek workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tenant_id">Workspace ID</Label>
              <div className="relative">
                <Building2
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="tenant_id"
                  type="text"
                  placeholder="Your workspace identifier"
                  autoComplete="organization"
                  autoFocus
                  className="pl-10 text-base md:text-sm"
                  {...register("tenant_id")}
                />
              </div>
              {errors.tenant_id && (
                <p className="text-sm text-destructive">
                  {errors.tenant_id.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Your organization&apos;s unique identifier provided by your
                administrator.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                className="text-base md:text-sm"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="text-base md:text-sm"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              loadingText="Signing in..."
              className="w-full min-h-[44px]"
            >
              Sign In
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
