import type { Metadata } from "next";
import { Abril_Fatface, DM_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });
const abril = Abril_Fatface({ subsets: ["latin"], weight: "400", variable: "--font-abril", display: "swap" });

export const metadata: Metadata = {
  title: "Cornell Communities OS",
  description: "Private operating portal",
  robots: { index: false, follow: false },
};

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${abril.variable}`}>
      <body>{children}</body>
    </html>
  );
}
