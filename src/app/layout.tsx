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
  // Inline script to set theme before first paint (prevents flash)
  const themeScript = `(function(){try{var t=localStorage.getItem('scriptus-theme');if(!t)t=window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.classList.remove('dark','light');document.documentElement.classList.add(t)}catch(e){}})()`;

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
