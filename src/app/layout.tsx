import type { Metadata } from "next";
import { Noto_Sans_SC, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { GameSessionProvider } from "@/features/game/context/game-session-provider";

const bodyFont = Noto_Sans_SC({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const displayFont = Space_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "伊洛纳网页挂机 MMO · Day0",
  description: "游客登录、角色创建、挂机与离线收益结算的最小可运行骨架。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen antialiased`}>
        <GameSessionProvider>
          {children}
        </GameSessionProvider>
      </body>
    </html>
  );
}
