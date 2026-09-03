import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Outfit } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "HRMS Auto Check-in",
    template: "%s · HRMS Auto Check-in",
  },
  description: "Automated HRMS check-in/check-out scheduler",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.png", sizes: "32x32" }],
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${fraunces.variable} ${jetbrains.variable} h-dvh antialiased`}
    >
      <body className="h-dvh max-h-dvh flex flex-col overflow-hidden font-sans">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
