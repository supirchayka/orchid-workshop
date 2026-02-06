import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/pwa/RegisterSW";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Orchid — учёт заказов",
  description: "PWA для учёта заказов мастерской Orchid",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}