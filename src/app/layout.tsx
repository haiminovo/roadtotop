import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Chat from "@/components/chat";
import { sidebarItems } from "@/features/navigation/sidebar-items";

export const metadata: Metadata = {
  title: "roadtotop",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="h-screen w-screen antialiased">
        <div className="flex h-full w-full bg-white">
          <Sidebar items={sidebarItems} />
          <div className="flex h-full w-full min-w-0 flex-col justify-between">
            {children}
            <Chat />
          </div>
        </div>
      </body>
    </html>
  );
}
