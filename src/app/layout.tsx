import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = "Undercard: book the right openers, with taste data";
const description =
  "An agent for independent promoters and venues that turns one headliner and one city into a data-backed show plan, powered by the Qloo taste graph.";

export const metadata: Metadata = {
  metadataBase: new URL("https://undercard-phi.vercel.app"),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Undercard",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
