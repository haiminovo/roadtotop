'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: '仪表盘' },
  { href: '/admin/items', label: '物品管理' },
  { href: '/admin/enemies', label: '怪物管理' },
  { href: '/admin/events', label: '事件规则' },
  { href: '/admin/skills', label: '技能管理' },
  { href: '/admin/maps', label: '地图管理' },
  { href: '/admin/accounts', label: '账号管理' },
  { href: '/admin/config', label: '系统参数' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen">
      {/* 侧边导航（不滚动） */}
      <aside className="w-48 shrink-0 bg-bg-secondary border-r border-border-primary p-3 flex flex-col">
        <h1 className="text-lg font-bold mb-4 text-accent-blue">管理后台</h1>
        <nav className="space-y-1 flex-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-bg-tertiary text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="pt-4 border-t border-border-primary">
          <Link href="/" className="text-xs text-text-muted hover:text-text-secondary">
            ← 返回游戏
          </Link>
        </div>
      </aside>

      {/* 主内容（可滚动） */}
      <main className="flex-1 overflow-y-auto p-4">
        {children}
      </main>
    </div>
  );
}
