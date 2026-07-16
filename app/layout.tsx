import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

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
  themeColor: "#B68E44",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
