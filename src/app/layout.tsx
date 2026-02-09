import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import { Navigation } from "@/components/layout/Navigation";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import { PresenceWrapper } from "@/components/layout/PresenceWrapper";

// Force all pages to be dynamically rendered (no SSG) — Firebase needs runtime env vars
export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Unime Informatica - Master Data Analysis & Computer Science",
  description: "Course-first learning platform with adaptive practice, mini labs, and community-driven content.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-512x512.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            <PresenceWrapper />
            <div className="min-h-screen flex flex-col">
              <Navigation />
              <AnnouncementBanner />
              <main className="flex-1">{children}</main>
              <footer className="border-t py-6 text-center text-sm text-muted-foreground">
                <div className="container">
                  <p>© {new Date().getFullYear()} Unime Informatica. All rights reserved.</p>
                </div>
              </footer>
            </div>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
