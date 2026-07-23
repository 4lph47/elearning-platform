import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/layout/SessionProviderWrapper";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarMainShell } from "@/components/layout/SidebarMainShell";
import { CardTransitionProvider } from "@/components/course/CardTransitionContext";
import { CardTransitionOverlay } from "@/components/course/CardTransitionOverlay";
import { FadeNavProvider } from "@/components/course/FadeNavContext";
import { FadeOutScrim } from "@/components/course/FadeOutScrim";
import { PageEntranceFade } from "@/components/course/PageEntranceFade";
import { TextFlyProvider } from "@/components/course/TextFlyContext";
import { TextFlyOverlay } from "@/components/course/TextFlyOverlay";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "E-Learn — Plataforma de Cursos Online",
  description: "Aprende novas competências com cursos criados por instrutores reais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-white text-slate-900 antialiased dark:bg-black dark:text-white`}
      >
        <ThemeProvider>
          <SessionProviderWrapper>
            <CardTransitionProvider>
              <FadeNavProvider>
                <TextFlyProvider>
                  <SidebarProvider>
                    <Navbar />
                    <Sidebar />
                    <PageEntranceFade>
                      <SidebarMainShell>{children}</SidebarMainShell>
                    </PageEntranceFade>
                    <Footer />
                  </SidebarProvider>
                  <FadeOutScrim />
                  <CardTransitionOverlay />
                  <TextFlyOverlay />
                  <CookieConsentBanner />
                </TextFlyProvider>
              </FadeNavProvider>
            </CardTransitionProvider>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
