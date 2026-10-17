import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rental Operations Tracker", template: "%s · Rental Operations Tracker" },
  description: "A rent ledger for small landlords.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
