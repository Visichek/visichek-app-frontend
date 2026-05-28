import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visitor Badge | VisiChek",
  description: "Print your visitor badge",
};

/**
 * Public badge layout. No admin chrome — a clean, print-friendly visitor
 * surface. The page itself owns the print controls and preview.
 */
export default function PublicBadgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
