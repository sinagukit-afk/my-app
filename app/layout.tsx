import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// Sinag Ukit V3 three-typeface system. Cormorant Garamond is marketing-hero
// only and must never be applied inside ERP screens — it's loaded here so
// it's available if a marketing/print page needs it, but nothing in the
// dashboard references --font-serif-display today.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-sans-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sinag Ukit ERP",
  description: "Sign in to manage your POS dashboard.",
  appleWebApp: {
    capable: true,
    title: "Sinag Ukit",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#C9A24B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${cormorantGaramond.variable} ${manrope.variable} ${inter.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
