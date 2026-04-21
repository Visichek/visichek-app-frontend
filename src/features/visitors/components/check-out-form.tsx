"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/recipes/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/feedback/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useNavigationLoading } from "@/lib/routing/navigation-context";
import { useCheckOut } from "@/features/visitors/hooks/use-visitors";
import type { CheckOutMethod } from "@/types/enums";

const CHECK_OUT_METHODS = ["qr_scan", "manual"] as const;

const checkOutSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Session ID or badge token is required"),
  checkOutMethod: z.enum(CHECK_OUT_METHODS),
});

type CheckOutFormData = z.infer<typeof checkOutSchema>;

export function CheckOutForm() {
  const router = useRouter();
  const { loadingHref, handleNavClick } = useNavigationLoading();
  const checkOutMutation = useCheckOut();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckOutFormData>({
    resolver: zodResolver(checkOutSchema),
    defaultValues: {
      identifier: "",
      checkOutMethod: "manual",
    },
  });

  const checkOutMethod = watch("checkOutMethod");

  const onSubmit = handleSubmit(async (data) => {
    try {
      await checkOutMutation.mutateAsync({
        ...(data.checkOutMethod === "qr_scan"
          ? { badgeQrToken: data.identifier }
          : { sessionId: data.identifier }),
        checkOutMethod: data.checkOutMethod as CheckOutMethod,
      });
      toast.success("Visitor checked out");
      router.push("/app/visitors");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to check out visitor",
      );
    }
  });

  const submitting = isSubmitting || checkOutMutation.isPending;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" asChild className="min-h-[44px]">
              <Link
                href="/app/visitors"
                onClick={() => handleNavClick("/app/visitors")}
              >
                {loadingHref === "/app/visitors" ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowLeft
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                  />
                )}
                Back to visitors
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Return to the visitors list without checking anyone out
          </TooltipContent>
        </Tooltip>
      </div>

      <PageHeader
        title="Check out visitor"
        description="Record a visitor's departure by scanning their badge QR or entering their session ID."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="checkOutMethod">Check-out method</Label>
          <Controller
            name="checkOutMethod"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="checkOutMethod" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qr_scan">QR scan</SelectItem>
                  <SelectItem value="manual">Manual entry</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.checkOutMethod && (
            <p className="text-sm text-destructive" role="alert">
              {errors.checkOutMethod.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="identifier">
            {checkOutMethod === "qr_scan" ? "Badge QR token" : "Session ID"} *
          </Label>
          <Input
            id="identifier"
            placeholder={
              checkOutMethod === "qr_scan"
                ? "Scan or paste the badge QR token"
                : "Enter the visitor's session ID"
            }
            autoComplete="off"
            {...register("identifier")}
            aria-invalid={!!errors.identifier}
            aria-describedby={
              errors.identifier ? "error-identifier" : undefined
            }
            className="min-h-[44px]"
          />
          {errors.identifier && (
            <p
              id="error-identifier"
              className="text-sm text-destructive"
              role="alert"
            >
              {errors.identifier.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {checkOutMethod === "qr_scan"
              ? "Scan the badge QR with a connected scanner, or paste the token here."
              : "Enter the unique session ID from the visitor's active check-in."}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 md:flex-row md:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                asChild
                disabled={submitting}
                className="w-full min-h-[44px] md:w-auto"
              >
                <Link
                  href="/app/visitors"
                  onClick={() => handleNavClick("/app/visitors")}
                >
                  Cancel
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Discard this check-out and return to the visitors list
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <LoadingButton
                  type="submit"
                  isLoading={submitting}
                  loadingText="Checking out…"
                  className="w-full md:w-auto"
                >
                  Check out visitor
                </LoadingButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              End this visitor's session and mark them as checked out
            </TooltipContent>
          </Tooltip>
        </div>
      </form>
    </div>
  );
}
