import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPL Command | Squad & Transfer Planner",
  description: "Plan your gameweek with squad projections, transfer comparisons, chip drafts and a six-week FPL planner.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
