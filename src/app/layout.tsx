import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DocFlow — Modern PDF Editor",
  description: "Edit, annotate, and collaborate on PDF documents in your browser. Fast, secure, and beautifully simple.",
  keywords: ["PDF editor", "annotate PDF", "document collaboration", "online PDF", "SaaS"],
  authors: [{ name: "DocFlow Team" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "DocFlow — Modern PDF Editor",
    description: "Edit, annotate, and collaborate on PDF documents in your browser.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}