'use client';

import { useMemo, useState } from "react";
import {
  GAME_ICON_OPTIONS,
  getGameIconByKey,
  type GameIconOption,
} from "@/lib/ui/game-icons";

type IconPickerProps = {
  className?: string;
  title?: string;
  value: string | null | undefined;
  onChange: (nextIconKey: string | null) => void;
  filterGroup?: GameIconOption["group"] | "all";
};

function optionVisible(option: GameIconOption, keyword: string, filterGroup: IconPickerProps["filterGroup"]) {
  if (filterGroup && filterGroup !== "all" && option.group !== filterGroup) {
    return false;
  }

  if (!keyword) {
    return true;
  }

  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return option.key.toLowerCase().includes(normalizedKeyword)
    || option.label.toLowerCase().includes(normalizedKeyword)
    || option.group.toLowerCase().includes(normalizedKeyword);
}

export function IconPicker({
  className,
  filterGroup = "all",
  onChange,
  title = "图标选择",
  value,
}: IconPickerProps) {
  const [keyword, setKeyword] = useState("");

  const selectedIcon = getGameIconByKey(value ?? undefined);

  const options = useMemo(
    () => GAME_ICON_OPTIONS.filter((option) => optionVisible(option, keyword, filterGroup)),
    [filterGroup, keyword],
  );

  return (
    <div className={className ?? "rounded-2xl border border-slate-200 bg-white p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{title}</p>
          <p className="mt-1 text-sm text-slate-600">当前：{value || "未设置（将使用默认回退）"}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
          {(() => {
            const SelectedIcon = selectedIcon;
            return <SelectedIcon className="h-5 w-5" />;
          })()}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索图标 key / 名称"
          value={keyword}
        />
        <button
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          onClick={() => onChange(null)}
          type="button"
        >
          清空
        </button>
      </div>

      <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto md:grid-cols-3 lg:grid-cols-4">
        {options.map((option) => {
          const Icon = getGameIconByKey(option.key);
          const active = option.key === value;

          return (
            <button
              key={option.key}
              className={`rounded-xl border px-2 py-2 text-left transition ${
                active
                  ? "border-[#1677ff] bg-cyan-500/8"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              onClick={() => onChange(option.key)}
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate text-xs font-medium text-slate-800">{option.label}</span>
              </div>
              <p className="mt-1 truncate text-[11px] text-slate-500">{option.key}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
