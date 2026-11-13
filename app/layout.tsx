import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";

export const metadata: Metadata = {
  title: "FPL Command Centre | Plan Your Gameweek",
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
      <body className="antialiased">{children}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 80 100"
        style={{
          position: "fixed",
          insetInlineEnd: "max(4px, env(safe-area-inset-right))",
          insetBlockEnd: "max(0px, env(safe-area-inset-bottom))",
          width: "clamp(42px, 7vw, 68px)",
          height: "auto",
          zIndex: 2,
          pointerEvents: "none",
          stroke: "none",
          filter: "drop-shadow(0 2px 4px #210d1370)",
        }}
      >
        <path fill="#88543d" d="M35 81h10v17H35z" />
        <path fill="#214d3b" d="M40 27 8 87q32 10 64 0L40 27Z" />
        <path fill="#30674e" d="M40 18 14 68q26 9 52 0L40 18Z" />
        <path fill="#428167" d="M40 13 22 48q18 7 36 0L40 13Z" />
        <path fill="none" stroke="#f6d695" strokeWidth="2" strokeLinecap="round" d="M30 43q8 5 18 2M24 63q15 8 32 3M17 83q21 9 46 2" />
        <g fill="#f4a7ae">
          <circle cx="34" cy="54" r="2.8" /><circle cx="53" cy="59" r="2.8" />
          <circle cx="26" cy="75" r="2.8" /><circle cx="48" cy="79" r="2.8" />
        </g>
        <path fill="#f8d486" d="m40 1 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" />
      </svg>
</body>
    </html>
  );
}
