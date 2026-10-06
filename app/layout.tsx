import type { Metadata, Viewport } from "next";
import AppChrome from "@/components/common/AppChrome";
import ServiceWorkerRegistrar from "@/components/common/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "온마음",
  description: "얼굴 표정 기반 일별 마음 상태 모니터링",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "온마음",
  },
};

export const viewport: Viewport = {
  themeColor: "#6BAB9A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink-50">
        <AppChrome>{children}</AppChrome>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
