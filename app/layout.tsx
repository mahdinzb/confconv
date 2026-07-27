import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ConfConv — Confluence Content Converter",
  description: "Convert Persian, English, and mixed-language content into Confluence Wiki Markup or Markdown.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" dir="ltr"><body>{children}</body></html>;
}
