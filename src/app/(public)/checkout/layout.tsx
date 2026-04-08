import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check Out | VisiChek",
  description: "Check out from your visit",
};

/**
 * Public checkout layout.
 * No admin navigation, no auth chrome.
 * Clean visitor-facing shell for badge-QR checkout.
 */
export default function PublicCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by VisiChek
      </footer>
    </div>
  );
}
