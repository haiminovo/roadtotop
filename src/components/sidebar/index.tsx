import type { SidebarItem as SidebarItemType } from "@/types/navigation";

type SidebarProps = {
  items: SidebarItemType[];
};

function SidebarItem({ icon, menuName, progress }: SidebarItemType) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="mb-3 flex w-full items-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50">
        {icon}
      </div>
      <div className="ml-4 flex grow flex-col">
        <div className="mb-1 flex justify-between text-sm font-medium text-slate-700">
          <span>{menuName}</span>
          <span>{clampedProgress}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-5">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Road To Top
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Learning Progress</h2>
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
