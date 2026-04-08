import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visitor Registration | VisiChek",
  description: "Register your visit",
};

/**
 * Public registration layout.
 * No admin navigation, no sidebar, no auth chrome.
 * Clean visitor-facing shell for QR-code-accessible pages.
 */
export default function PublicRegisterLayout({
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
