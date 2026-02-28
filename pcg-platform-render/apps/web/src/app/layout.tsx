import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCG Platform — Cloud Gaming Simulator",
  description: "Production Cloud Gaming platform simulator with real-time metrics, billing, and resource management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
