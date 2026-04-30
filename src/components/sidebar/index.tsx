'use client';

import type { SidebarItem as SidebarItemType } from "@/types/navigation";
import { useI18n } from "@/lib/i18n/provider";

type SidebarProps = {
  items: SidebarItemType[];
};

function SidebarItem({ icon, menuName, progress }: SidebarItemType) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="mb-3 flex w-full items-center rounded-2xl border border-white/8 bg-white/4 p-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
        {icon}
      </div>
      <div className="ml-4 flex grow flex-col">
        <div className="mb-1 flex justify-between text-sm font-medium text-slate-100">
          <span>{menuName}</span>
          <span className="text-cyan-200">{clampedProgress}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#3b82f6_100%)] transition-all duration-300"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ items }: SidebarProps) {
  const { messages } = useI18n();
  const copy = messages.sidebar;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-cyan-400/10 bg-slate-950 p-5 text-white">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/65">
          {copy.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {copy.summary}
        </p>
      </div>
      <div className="overflow-y-auto">
        {items.map((item) => (
          <SidebarItem
            key={item.menuName}
            icon={item.icon}
            menuName={item.menuName}
            progress={item.progress}
          />
        ))}
      </div>
    </aside>
  );
}
