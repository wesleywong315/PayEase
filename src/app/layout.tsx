import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppNoticeBanner } from "@/components/AppNoticeBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PayEase",
    template: "%s · PayEase",
  },
  description: "Fair shared spending for student teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <AppNoticeBanner />
        {children}
      </body>
    </html>
  );
}
