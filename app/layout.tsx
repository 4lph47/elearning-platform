import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/layout/SessionProviderWrapper";
import { Navbar } from "@/components/layout/Navbar";

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
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}
      >
        <SessionProviderWrapper>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
