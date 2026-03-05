import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScriptUs — Collaborative Theater Production Manager",
  description:
    "Real-time collaborative script annotation and cue management for theater productions.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-stage-bg text-stage-text min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
