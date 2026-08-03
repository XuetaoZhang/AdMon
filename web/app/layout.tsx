import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdMon · Transparent agent advertising on Monad",
  description:
    "A transparent advertising and click settlement layer for AI agent publishers."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
