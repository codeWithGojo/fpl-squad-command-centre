import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPL Transfer Assistant",
  description: "Explore fixture difficulty and transparent player transfer recommendations powered by official Fantasy Premier League data.",
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
