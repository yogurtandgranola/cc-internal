import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cornell Communities OS",
  description: "Private operating portal",
  robots: { index: false, follow: false },
};

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
