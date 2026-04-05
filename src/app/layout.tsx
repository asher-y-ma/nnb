import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "缔图 | Ecommerce AI Studio",
  description: "Gemini-first ecommerce creative workstation for product images, fashion try-on and commerce content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
