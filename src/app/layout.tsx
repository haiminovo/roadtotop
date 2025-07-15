import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Chat from "@/components/chat";

export const metadata: Metadata = {
  title: "roadtotop",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const MenuIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

  const AnotherIcon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-green-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const menuItems = [
    { icon: MenuIcon, menuName: 'Dashboard', progress: 75 },
    { icon: AnotherIcon, menuName: 'Settings', progress: 50 },
    { icon: MenuIcon, menuName: 'Profile', progress: 90 },
  ];

  return (
    <html lang="en">
      <body
        className={`antialiased w-screen h-screen`}
      >
        <div className="flex w-full h-full">
          <Sidebar items={menuItems} />
          <div className="w-full h-full flex flex-col justify-between">
            {children}
            <Chat></Chat>
          </div>
        </div>
      </body>
    </html>
  );
}
