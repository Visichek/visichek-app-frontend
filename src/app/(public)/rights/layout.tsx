import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Data Rights | VisiChek",
  description: "Manage your data privacy rights as a visitor",
};

/**
 * Public rights layout.
 * No admin navigation, no auth chrome.
 * Clean visitor-facing shell for privacy rights pages.
 */
export default function PublicRightsLayout({
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
