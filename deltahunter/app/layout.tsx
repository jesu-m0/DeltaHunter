import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeltaHunter — Telemetry Comparison for Sim Racing",
  description:
    "Upload two MoTeC .ld telemetry files and instantly see where and why you lose time, corner by corner.",
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
