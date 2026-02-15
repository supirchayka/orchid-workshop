import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import RegisterSW from "@/components/pwa/RegisterSW";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Orchid — учёт заказов",
  description: "PWA для учёта заказов мастерской Orchid",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Orchid",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff8c0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className={`${manrope.variable} font-sans`}>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
