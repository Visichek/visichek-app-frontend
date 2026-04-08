"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/feedback/loading-button";

const lookupSchema = z.object({
  request_id: z.string().min(1, "Request ID is required"),
  verification_token: z.string().min(1, "Verification token is required"),
});

type LookupFormValues = z.infer<typeof lookupSchema>;

/**
 * Manual status lookup page for visitors who only have
 * a request ID and verification token (e.g., from a saved note).
 */
export default function ManualStatusLookupPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LookupFormValues>({
    resolver: zodResolver(lookupSchema),
  });

  function onSubmit(values: LookupFormValues) {
    router.push(
      `/rights/request/${values.request_id}/status?token=${encodeURIComponent(
        values.verification_token
      )}`
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-8 md:py-12">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Search className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-display font-semibold">
          Check Request Status
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Enter the request ID and verification token you received when you
          submitted your data rights request.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="request_id">
                Request ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="request_id"
                type="text"
                placeholder="Your request ID"
                autoFocus
                className="text-base md:text-sm font-mono"
                {...register("request_id")}
              />
              {errors.request_id && (
                <p className="text-sm text-destructive">
                  {errors.request_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification_token">
                Verification Token <span className="text-destructive">*</span>
              </Label>
              <Input
                id="verification_token"
                type="text"
                placeholder="Your verification token"
                className="text-base md:text-sm font-mono"
                {...register("verification_token")}
              />
              {errors.verification_token && (
                <p className="text-sm text-destructive">
                  {errors.verification_token.message}
                </p>
              )}
            </div>

            <LoadingButton type="submit" className="w-full">
              Look Up Status
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need to submit a new request?{" "}
        <a
          href="/rights/request"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Submit a data rights request
        </a>
      </p>
    </div>
  );
}
