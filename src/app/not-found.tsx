import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Button asChild className="min-h-[44px]">
        <Link href="/">Go back home</Link>
      </Button>
    </div>
  );
}
