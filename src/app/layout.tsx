import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import CookieBanner from "@/components/CookieBanner";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  title: {
    default: 'UmaCore',
    template: '%s — UmaCore',
  },
  description: 'Quota tracking, member management, and reports for Uma Musume club admins.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'UmaCore',
    description: 'Quota tracking, member management, and reports for Uma Musume club admins.',
    url: APP_URL,
    siteName: 'UmaCore',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'UmaCore' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UmaCore',
    description: 'Quota tracking, member management, and reports for Uma Musume club admins.',
    images: ['/api/og'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
