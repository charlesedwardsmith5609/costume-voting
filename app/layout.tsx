import type { Metadata, Viewport } from "next";
import { Creepster } from "next/font/google";
import "./globals.css";

const creepster = Creepster({ weight: "400", subsets: ["latin"], variable: "--font-creepster" });

export const metadata: Metadata = {
  title: "The Charlies Costume Contest 2026",
  description: "Vote for your favorite costumes!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0a14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={creepster.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
