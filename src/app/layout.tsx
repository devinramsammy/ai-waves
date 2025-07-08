import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-WAVES",
  description: "Artificial Immersion in Waveform Activity & Visual Emotion Signals",
  keywords: "audio visualizer, futuristic, space interface, AI, neural network",
  authors: [{ name: "Devin Ramsammy" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#00FFFF",
  colorScheme: "dark",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#00FFFF" />
        <meta name="background-color" content="#000000" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white overflow-x-hidden`}
      >
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
          {children}
        </div>
      </body>
    </html>
  );
}
