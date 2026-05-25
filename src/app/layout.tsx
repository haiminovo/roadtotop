import type { Metadata } from "next";
import "./globals.css";
import { GameSessionProvider } from "@/features/game/context/game-session-provider";
import { getMessages } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/i18n/provider";

const copy = getMessages();

export const metadata: Metadata = {
  title: copy.app.title,
  description: copy.app.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <LocaleProvider>
          <GameSessionProvider>
            {children}
          </GameSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
