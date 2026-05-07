'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminNavItem = {
  href: string;
  label: string;
  hint: string;
};

const NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/accounts", label: "账号管理", hint: "账号列表与编辑" },
  { href: "/admin/roles", label: "角色管理", hint: "角色列表与编辑" },
  { href: "/admin/config", label: "配置中心", hint: "原配置编辑器" },
];

function getTitle(pathname: string) {
  if (pathname.startsWith("/admin/accounts")) {
    return "账号管理";
  }

  if (pathname.startsWith("/admin/roles")) {
    return "角色管理";
  }

  if (pathname.startsWith("/admin/config")) {
    return "配置中心";
  }

  return "管理后台";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="admin-console-antd min-h-screen bg-slate-50 text-slate-700 lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-white lg:h-screen lg:overflow-y-auto">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-lg font-semibold text-cyan-700">
                GM
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">业务管理后台</p>
                <p className="mt-1 text-xs text-slate-500">Road To Top Console</p>
              </div>
            </div>
          </div>

          <nav className="px-2 py-3">
            <p className="px-3 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">导航菜单</p>
            <div className="mt-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    className={`block rounded-xl px-3 py-3 transition ${active
                      ? "bg-[#1677ff] text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    href={item.href}
                  >
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className={`mt-1 text-xs ${active ? "text-blue-100" : "text-slate-500"}`}>
                      {item.hint}
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col lg:min-h-0">
          <header className="shrink-0 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
              <h1 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">{getTitle(pathname)}</h1>
            </div>
          </header>

          <div className="flex-1 px-4 py-4 md:px-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
