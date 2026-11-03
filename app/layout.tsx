import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, DM_Serif_Display } from "next/font/google";
import { AppProvider } from "@/components/app-provider";
import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { ScrollMotion } from "@/components/scroll-motion";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-ui", subsets: ["latin"] });
const dmSerif = DM_Serif_Display({ variable: "--font-editorial", weight: "400", subsets: ["latin"] });
const dmMono = DM_Mono({ variable: "--font-label", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Afterhours — Shared photo rolls",
  description: "A shared camera roll for nights out. Add photos through the night and open them together tomorrow.",
  applicationName: "Afterhours",
};

export const viewport: Viewport = {
  themeColor: "#141311",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
        <ScrollMotion />
        <AuthProvider>
          <AppProvider>
            <SiteHeader />
            {children}
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
