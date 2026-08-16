import type { Metadata, Viewport } from "next";
import "./globals.css";

// viewport-fit=cover is what makes env(safe-area-inset-bottom) non-zero, which
// the mobile playback sheet relies on to clear the iOS home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "DeltaHunter — Telemetry Comparison for Sim Racing",
  description:
    "Upload two MoTeC .ld telemetry files and instantly see where and why you lose time, corner by corner.",
  icons: {
    icon: "/favico.svg",
    shortcut: "/favico.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg">{children}</body>
    </html>
  );
}
