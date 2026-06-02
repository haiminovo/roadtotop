'use client';

import { useEffect } from "react";
import { getClassCopy, getRaceCopy } from "@/lib/i18n";
import type { ChatRoleProfile } from "@/features/chat/types";
import { useI18n } from "@/lib/i18n/provider";
import { getGameIconByKey, getItemTypeFallbackIconKey } from "@/lib/ui/game-icons";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.floor(value)));
}

function rarityAccent(rarity: string) {
  return {
    white: { text: "text-slate-300", bg: "bg-slate-400/10", border: "border-slate-600/30", dot: "bg-slate-400" },
    green: { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-600/30", dot: "bg-emerald-400" },
    blue: { text: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-600/30", dot: "bg-sky-400" },
    purple: { text: "text-fuchsia-400", bg: "bg-fuchsia-400/10", border: "border-fuchsia-600/30", dot: "bg-fuchsia-400" },
    orange: { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-600/30", dot: "bg-amber-400" },
  }[rarity] ?? { text: "text-slate-300", bg: "bg-slate-400/10", border: "border-slate-600/30", dot: "bg-slate-400" };
}

function statLabel(statKey: string, messages: ReturnType<typeof useI18n>["messages"]) {
  return messages.stats[statKey as keyof typeof messages.stats] ?? statKey;
}

/** Equipment slot layout positions — left column / center / right column */
const SLOT_LAYOUT: Array<{ slot: string; col: "left" | "right" }> = [
  { slot: "head", col: "left" },
  { slot: "neck", col: "right" },
  { slot: "hand", col: "left" },
  { slot: "torso", col: "right" },
  { slot: "legs", col: "left" },
  { slot: "feet", col: "right" },
  { slot: "accessory", col: "left" },
];

function EquipmentSlot({
  item,
  messages,
}: {
  item: ChatRoleProfile["equippedItems"][number] | null;
  messages: ReturnType<typeof useI18n>["messages"];
}) {
  const slotName = item ? messages.slots[item.slot as keyof typeof messages.slots] ?? item.slot : "";
  const accent = item ? rarityAccent(item.rarity) : null;
  const Icon = item ? getGameIconByKey(item.iconKey, getItemTypeFallbackIconKey("equipment")) : null;

  if (!item) {
    return (
      <div className="game-subpanel flex min-h-8 items-center gap-1.5 rounded border-dashed px-2 py-1 opacity-75">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/[0.08] bg-white/[0.04]">
          <span className="text-[8px] text-slate-700">—</span>
        </div>
        <span className="text-[9px] text-slate-700">{slotName || "空"}</span>
      </div>
    );
  }

  return (
    <div className={`flex min-h-8 items-center gap-1.5 rounded border ${accent!.border} ${accent!.bg} px-2 py-1`}>
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${accent!.border} bg-black/20`}>
        {Icon ? <Icon className={`h-3 w-3 ${accent!.text}`} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[10px] font-medium leading-tight ${accent!.text}`}>{item.name}</p>
      </div>
      {item.equippedCount > 1 ? (
        <span className="shrink-0 text-[8px] text-slate-500">×{item.equippedCount}</span>
      ) : null}
    </div>
  );
}

export default function RoleProfileCard({
  onChallenge,
  onClose,
  role,
  isChallenging = false,
}: {
  onChallenge?: ((roleId: string) => void) | null;
  onClose: () => void;
  role: ChatRoleProfile | null;
  isChallenging?: boolean;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.chat;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!role) return null;

  const raceLabel = getRaceCopy(locale, role.raceKey)?.label ?? role.raceKey;
  const classLabel = getClassCopy(locale, role.classKey)?.label ?? role.classKey;
  const canChallenge = Boolean(role.roleId && onChallenge);

  // Build slot → item map
  const slotItemMap = new Map<string, ChatRoleProfile["equippedItems"][number]>();
  for (const item of role.equippedItems) {
    // Only map the primary slot (first occurrence)
    if (!slotItemMap.has(item.slot)) {
      slotItemMap.set(item.slot, item);
    }
  }

  const statEntries: Array<{ key: string; color: string }> = [
    { key: "strength", color: "text-rose-400" },
    { key: "agility", color: "text-emerald-400" },
    { key: "intelligence", color: "text-sky-400" },
    { key: "vitality", color: "text-amber-400" },
  ];

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end justify-center overflow-hidden bg-black/75 px-2 pb-2 pt-10 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="game-panel w-full max-w-[min(96vw,26rem)] overflow-hidden rounded-t-xl shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
          <div className="relative shrink-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/25 bg-linear-to-br from-cyan-300/16 to-emerald-300/10 text-xs font-bold text-cyan-200">
              {role.avatarSeed}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#161b22] px-1 text-[8px] font-bold text-amber-300 ring-1 ring-[#30363d]">{role.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-white">{role.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="rounded bg-sky-900/30 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">{raceLabel}</span>
              <span className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">{classLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canChallenge ? (
              <button
                className="shrink-0 rounded-md p-1.5 text-rose-500/70 transition hover:bg-rose-500/15 hover:text-rose-400 disabled:opacity-40"
                aria-label={copy.pkAction}
                disabled={isChallenging}
                onClick={() => role.roleId && onChallenge?.(role.roleId)}
                type="button"
                title={copy.pkAction}
              >
                {isChallenging ? (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2.5l-4 4L7 6l-1.5 4.5L10 12l-3 5h2.5l3-3 3 3H22l-3-5 4.5-1.5L22 6l-3.5.5-4-4z" /></svg>
                )}
              </button>
            ) : null}
            <button
              className="shrink-0 rounded-md p-1 text-slate-600 transition hover:text-slate-300"
              aria-label="关闭"
              onClick={onClose}
              type="button"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="max-h-[min(72svh,30rem)] overflow-y-auto">
          {/* Stats — colored cards */}
          <div className="grid grid-cols-4 gap-1 border-b border-white/[0.06] px-3 py-2">
            {statEntries.map(({ key, color }) => (
              <div key={key} className="flex min-w-0 flex-col items-center gap-0.5 rounded-md border border-white/[0.04] bg-white/[0.02] px-1 py-1.5">
                <span className={`text-sm font-bold tabular-nums ${color}`}>
                  {role.stats[key as keyof typeof role.stats]}
                </span>
                <span className="text-[7px] uppercase tracking-wider text-slate-600">{statLabel(key, messages)}</span>
              </div>
            ))}
          </div>

          {/* Currency */}
          <div className="flex items-center justify-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
            <span className="flex items-center gap-1 rounded-md bg-amber-300/8 px-2 py-0.5 text-[10px]">
              <span className="text-amber-400">💰</span>
              <span className="font-semibold tabular-nums text-amber-300">{formatNumber(role.gold, locale)}</span>
            </span>
            <span className="flex items-center gap-1 rounded-md bg-cyan-300/8 px-2 py-0.5 text-[10px]">
              <span className="text-cyan-400">💎</span>
              <span className="font-semibold tabular-nums text-sky-300">{formatNumber(role.aetherCrystal, locale)}</span>
            </span>
          </div>

          {/* Equipment */}
          <div className="px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-slate-600">{copy.equippedItems}</span>
              <span className="text-[9px] text-slate-600">{role.equippedItems.length} 件</span>
            </div>
            <div className="grid grid-cols-1 gap-1 min-[360px]:grid-cols-2 min-[360px]:gap-x-1.5">
              {SLOT_LAYOUT.map(({ slot }) => (
                <EquipmentSlot
                  key={slot}
                  item={slotItemMap.get(slot) ?? null}
                  messages={messages}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
