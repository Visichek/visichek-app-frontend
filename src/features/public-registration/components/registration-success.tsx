"use client";

import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegistrationSuccessProps {
  visitorName: string;
  companyName?: string;
}

/**
 * Success screen shown after a visitor completes public self-registration.
 * Tells the visitor to proceed to reception for check-in confirmation.
 */
export function RegistrationSuccess({
  visitorName,
  companyName,
}: RegistrationSuccessProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2
              className="h-8 w-8 text-success"
              aria-hidden="true"
            />
          </div>
          <CardTitle className="text-xl font-display">
            Registration Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-foreground">
            Welcome, <span className="font-semibold">{visitorName}</span>
            {companyName ? ` from ${companyName}` : ""}.
          </p>
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm font-medium text-foreground">
              Please proceed to the reception desk
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              A receptionist will verify your details and provide your visitor
              badge.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
