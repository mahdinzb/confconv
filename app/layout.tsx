import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conflux — مبدل متن به کانفلوئنس",
  description: "تبدیل هوشمند متن فارسی، انگلیسی و ترکیبی به خروجی آمادهٔ Confluence",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
