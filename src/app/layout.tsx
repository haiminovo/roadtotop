import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Road To Top - 休闲放置 MMORPG",
  description: "轻松挂机，冒险不停",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
