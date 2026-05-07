'use client';

import { useEffect } from "react";
import { ConfigProvider } from "antd";
import { AdminShell } from "@/features/admin/components/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("admin-body");

    return () => {
      document.body.classList.remove("admin-body");
    };
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorText: "#334155",
          colorTextHeading: "#1e293b",
          colorTextPlaceholder: "#94a3b8",
          colorTextSecondary: "#64748b",
        },
      }}
    >
      <AdminShell>{children}</AdminShell>
    </ConfigProvider>
  );
}
