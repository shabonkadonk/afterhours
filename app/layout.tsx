import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/app-provider";
import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "AFTERHOURS — Keep the night.",
  description: "A shared photo roll for the nights you want to remember.",
  applicationName: "AFTERHOURS",
};

export const viewport: Viewport = {
  themeColor: "#141311",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
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
