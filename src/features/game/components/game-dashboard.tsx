'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Chat from "@/components/chat";
import { getMaxHealth, type BodySlotType, type ClassKey, type MapConfig, type MapKey, type PanelKey, type RaceKey } from "@/lib/game-config";
import { useGameSession } from "@/features/game/context/game-session-provider";
import {
  formatMessage,
  getClassCopy,
  getItemCopy,
  getMapCopy,
  getMessages,
  getRaceCopy,
  type SupportedLocale,
} from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import {
  getClassFallbackIconKey,
  getGameIconByKey,
  getItemTypeFallbackIconKey,
  getRaceFallbackIconKey,
} from "@/lib/ui/game-icons";

type I18nMessages = ReturnType<typeof getMessages>;
const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
const DEFAULT_MESSAGES = getMessages(DEFAULT_LOCALE);
const BATTLE_ATTACK_DAMAGE_MULTIPLIER = 2;
const BATTLE_PLAYER_GUARD_COOLDOWN_TURNS = 2;
const BATTLE_ENEMY_GUARD_COOLDOWN_TURNS = 3;
const BATTLE_SPELL_HIGH_INTELLIGENCE_THRESHOLD = 12;
const BATTLE_HIGH_INTELLIGENCE_SPELL_CHANCE = 0.7;
const BATTLE_DEFAULT_SPELL_CHANCE = 0.35;

function raceIconByConfig(raceKey: string, iconKey?: string | null) {
  return getGameIconByKey(iconKey, getRaceFallbackIconKey(raceKey));
}

function classIconByConfig(classKey: string, iconKey?: string | null) {
  return getGameIconByKey(iconKey, getClassFallbackIconKey(classKey));
}

function formatNumber(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.floor(value)));
}

function formatDecimal(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}小时 ${minutes}分`;
  }

  if (minutes > 0) {
    return `${minutes}分 ${remainingSeconds}秒`;
  }

  return `${remainingSeconds}秒`;
}

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatPercent(current: number, total: number, messages: I18nMessages = DEFAULT_MESSAGES) {
  if (total <= 0) {
    return messages.common.max;
  }

  return `${Math.min(100, Math.floor((current / total) * 100))}%`;
}

function formatPercentValue(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(0, value * 100))}%`;
}

function localizeRaceLabel(raceKey: string, fallback: string, locale: SupportedLocale) {
  return getRaceCopy(locale, raceKey)?.label ?? fallback;
}

function localizeRaceSummary(raceKey: string, fallback: string, locale: SupportedLocale) {
  return getRaceCopy(locale, raceKey)?.summary ?? fallback;
}

function localizeClassLabel(classKey: string, fallback: string, locale: SupportedLocale) {
  return getClassCopy(locale, classKey)?.label ?? fallback;
}

function localizeClassSummary(classKey: string, fallback: string, locale: SupportedLocale) {
  return getClassCopy(locale, classKey)?.summary ?? fallback;
}

function localizeMapLabel(mapKey: string, fallback: string, locale: SupportedLocale) {
  return getMapCopy(locale, mapKey)?.label ?? fallback;
}

function localizeItemName(itemId: string, fallback: string, locale: SupportedLocale) {
  return getItemCopy(locale, itemId)?.name ?? fallback;
}

function localizeItemDescription(itemId: string, fallback: string, locale: SupportedLocale) {
  return getItemCopy(locale, itemId)?.description ?? fallback;
}

function rarityLabel(rarity: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.rarity[rarity as keyof I18nMessages["rarity"]] ?? rarity;
}

function formatStatsSummary(
  stats: Record<string, number>,
  locale: SupportedLocale = DEFAULT_LOCALE,
  messages: I18nMessages = DEFAULT_MESSAGES,
) {
  const entries = Object.entries(stats).filter(([, value]) => Number(value) > 0);

  if (entries.length === 0) {
    return messages.common.empty;
  }

  return entries
    .map(([key, value]) => `${statLabel(key, messages)} +${formatNumber(value, locale)}`)
    .join(" · ");
}

function skillCategoryLabel(category: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.game.dashboard.skillCategory?.[category as keyof typeof messages.game.dashboard.skillCategory] ?? category;
}

function skillQualityTone(quality: string) {
  return {
    white: "border-slate-300/20 bg-slate-200/6 text-slate-100",
    green: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    blue: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    purple: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100",
    orange: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  }[quality] ?? "border-slate-300/20 bg-slate-200/6 text-slate-100";
}

function calculateBattlePhysicalDamagePreview(strength: number) {
  return Math.max(1, Math.round(Math.max(0, Number(strength) || 0) * BATTLE_ATTACK_DAMAGE_MULTIPLIER));
}

function calculateBattleSpellChancePreview(intelligence: number) {
  return intelligence >= BATTLE_SPELL_HIGH_INTELLIGENCE_THRESHOLD
    ? BATTLE_HIGH_INTELLIGENCE_SPELL_CHANCE
    : BATTLE_DEFAULT_SPELL_CHANCE;
}

function formatSecondaryStatPercent(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return formatPercentValue(Math.max(0, value), locale);
}

function formatSecondaryStatMultiplier(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return `${formatDecimal(Math.max(0, value), locale)}x`;
}

function slotLabel(slot: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.slots[slot as keyof I18nMessages["slots"]] ?? slot;
}

function statLabel(statKey: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.stats[statKey as keyof I18nMessages["stats"]] ?? statKey;
}

function itemTypeLabel(itemType: BackpackItem["itemType"], messages: I18nMessages = DEFAULT_MESSAGES) {
  return {
    equipment: messages.game.dashboard.itemTypeEquipment,
    skill_book: messages.game.dashboard.itemTypeSkillBook,
    material: messages.game.dashboard.itemTypeMaterial,
  }[itemType];
}

function itemCategoryTone(itemType: BackpackItem["itemType"]): "emerald" | "neutral" | "sky" {
  switch (itemType) {
    case "equipment":
      return "sky";
    case "skill_book":
      return "emerald";
    case "material":
    default:
      return "neutral";
  }
}

function bodySlotKeyLabel(
  slotKey: string,
  messages: I18nMessages = DEFAULT_MESSAGES,
) {
  const [slotType, indexText] = slotKey.split("-");
  const index = Number(indexText);
  const baseLabel = slotLabel(slotType, messages);

  if (!Number.isFinite(index)) {
    return baseLabel;
  }

  return `${baseLabel}${index}`;
}

function formatEquippedGroupSummary(
  groups: string[][] | null | undefined,
  messages: I18nMessages = DEFAULT_MESSAGES,
) {
  const safeGroups = Array.isArray(groups) ? groups : [];

  if (safeGroups.length === 0) {
    return messages.common.noneEquipped;
  }

  return safeGroups
    .map((group) => group.map((slotKey) => bodySlotKeyLabel(slotKey, messages)).join(" + "))
    .join(" / ");
}

function getSafeBodySlots(
  role: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["role"],
) {
  return Array.isArray(role?.bodySlots) ? role.bodySlots : [];
}

const EMPTY_BACKPACK: Array<{
  backpackId: string;
  itemId: string;
  itemType: "equipment" | "skill_book" | "material";
  skillKey: string | null;
  iconKey: string | null;
  quantity: number;
  equipped: boolean;
  equippedCount: number;
  equippedSlotGroups: string[][];
  name: string;
  rarity: string;
  slot: BodySlotType;
  slotUsage: number;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
}> = [];

type BackpackItem = typeof EMPTY_BACKPACK[number];
type ItemActionKey = "drop" | "equip" | "unequip" | "sell" | "learn";
type PendingItemAction = {
  actionKey: ItemActionKey;
  backpackId: string;
} | null;

function itemAccent(rarity: string) {
  return {
    white: "border-slate-300/20 bg-slate-200/8 text-slate-100",
    green: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
    blue: "border-sky-300/35 bg-sky-300/10 text-sky-100",
    purple: "border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-100",
    orange: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  }[rarity] ?? "border-slate-300/20 bg-slate-200/8 text-slate-100";
}

function marketItemCardAccent(rarity: string) {
  return {
    white: "border-slate-300/22 bg-[linear-gradient(180deg,rgba(148,163,184,0.16),rgba(15,23,42,0.26))]",
    green: "border-emerald-300/24 bg-[linear-gradient(180deg,rgba(52,211,153,0.18),rgba(15,23,42,0.26))]",
    blue: "border-sky-300/24 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(15,23,42,0.26))]",
    purple: "border-fuchsia-300/24 bg-[linear-gradient(180deg,rgba(217,70,239,0.18),rgba(15,23,42,0.26))]",
    orange: "border-amber-300/24 bg-[linear-gradient(180deg,rgba(251,191,36,0.2),rgba(15,23,42,0.26))]",
  }[rarity] ?? "border-slate-300/22 bg-[linear-gradient(180deg,rgba(148,163,184,0.16),rgba(15,23,42,0.26))]";
}

function rarityMetaBadgeTone(rarity: string): "amber" | "emerald" | "neutral" | "sky" | "violet" {
  switch (rarity) {
    case "green":
      return "emerald";
    case "blue":
      return "sky";
    case "purple":
      return "violet";
    case "orange":
      return "amber";
    case "white":
    default:
      return "neutral";
  }
}

function getItemActionDefinition(actionKey: ItemActionKey, messages: I18nMessages = DEFAULT_MESSAGES) {
  const copy = messages.game.itemActions[actionKey];
  return {
    actionKey,
    confirmCopy: copy.confirmCopy,
    confirmTitle: copy.confirmTitle,
    confirmVerb: copy.confirmVerb,
    label: copy.label,
    summary: copy.summary,
    tone: actionKey === "drop" ? "danger" as const : "primary" as const,
  };
}

function getAvailableItemActions(item: BackpackItem, messages: I18nMessages = DEFAULT_MESSAGES) {
  const actions = [];
  const equippedCount = item.equippedCount ?? 0;
  const sellableQuantity = Math.max(0, item.quantity - equippedCount);

  if (item.itemType === "equipment" && item.quantity > equippedCount) {
    actions.push(getItemActionDefinition("equip", messages));
  }

  if (item.itemType === "equipment" && equippedCount > 0) {
    actions.push(getItemActionDefinition("unequip", messages));
  }

  if (item.itemType === "skill_book" && sellableQuantity > 0) {
    actions.push(getItemActionDefinition("learn", messages));
  }

  if (sellableQuantity > 0) {
    actions.push(getItemActionDefinition("sell", messages));
  }

  actions.push(getItemActionDefinition("drop", messages));
  return actions;
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,23,40,0.94),rgba(9,13,27,0.98))] backdrop-blur-xl",
        "shadow-[0_18px_46px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-[0.32em] text-sky-100/55">{children}</p>;
}

function OverlayModal({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/72 px-4 py-6">
      <div className="mx-auto w-full max-w-lg max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:p-6">
        {children}
      </div>
    </div>
  );
}

function MobileDashboardCollapse({
  children,
  defaultOpen = true,
  summary,
  title,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  summary?: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <button
        aria-expanded={isOpen}
        className="flex min-h-11 w-full items-center justify-between rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-4 py-3 text-left text-white shadow-[0_12px_36px_rgba(0,0,0,0.22)] transition hover:border-sky-200/30 xl:hidden"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          {summary ? <p className="mt-1 text-xs text-slate-300/75">{summary}</p> : null}
        </div>
        <span className="ml-3 shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300">
          {isOpen ? "收起" : "展开"}
        </span>
      </button>

      <div className={`${isOpen ? "block" : "hidden"} xl:flex xl:min-h-0 xl:flex-1 xl:flex-col`}>
        {children}
      </div>
    </div>
  );
}

function TopStatusBar({
  barClassName = "h-3",
  className = "",
  label,
  labelClassName = "text-slate-300",
  valueLabel,
  tone,
  value,
}: {
  barClassName?: string;
  className?: string;
  label: string;
  labelClassName?: string;
  valueLabel?: React.ReactNode;
  tone: string;
  value: number;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={["rounded-[1rem] border border-white/8 bg-white/[0.035] p-3", className].join(" ")}>
      <div className={`mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] ${labelClassName}`}>
        <span>{label}</span>
        <span>{valueLabel ?? `${Math.max(0, Math.floor(safeValue))}%`}</span>
      </div>
      <div className={`${barClassName} overflow-hidden rounded-full border border-white/6 bg-slate-950/90`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r shadow-[0_0_22px_rgba(125,211,252,0.2)] transition-[width] duration-700 ease-out ${tone}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function DataPill({
  className = "",
  label,
  labelClassName = "",
  value,
  valueClassName = "",
}: {
  className?: string;
  label: string;
  labelClassName?: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div
      className={[
        "min-w-0 rounded-[0.95rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        className,
      ].join(" ")}
    >
      <p className={["text-[10px] uppercase tracking-[0.16em] text-slate-500", labelClassName].join(" ")}>{label}</p>
      <p className={["mt-1 truncate text-sm font-semibold leading-5 text-white", valueClassName].join(" ")}>{value}</p>
    </div>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-3 py-2.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "danger" | "emerald" | "neutral" | "sky" | "warning";
}) {
  const toneClassName = {
    danger: "border-rose-300/25 bg-rose-300/12 text-rose-50",
    emerald: "border-emerald-300/25 bg-emerald-300/12 text-emerald-50",
    neutral: "border-white/10 bg-white/[0.05] text-slate-100",
    sky: "border-sky-300/25 bg-sky-300/12 text-sky-50",
    warning: "border-amber-300/25 bg-amber-300/12 text-amber-50",
  }[tone];

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClassName}`}>
      {children}
    </span>
  );
}

function CommandButton({
  children,
  disabled = false,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "danger" | "neutral" | "primary" | "secondary";
}) {
  const toneClassName = {
    danger: "border-rose-300/25 bg-rose-400 text-white shadow-[0_14px_30px_rgba(244,63,94,0.24)] hover:bg-rose-300",
    neutral: "border-white/12 bg-white/[0.06] text-white hover:border-white/24 hover:bg-white/[0.12]",
    primary: "border-emerald-300/20 bg-emerald-500 text-white shadow-[0_14px_30px_rgba(16,185,129,0.28)] hover:bg-emerald-400",
    secondary: "border-cyan-300/30 bg-cyan-300/10 text-cyan-50 hover:border-cyan-200/50 hover:bg-cyan-300/16",
  }[tone];

  return (
    <button
      className={[
        "min-h-11 min-w-0 whitespace-nowrap rounded-[1rem] border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1",
        toneClassName,
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function OverviewMetricCard({
  detail,
  label,
  tone = "neutral",
  value,
}: {
  detail?: React.ReactNode;
  label: string;
  tone?: "amber" | "emerald" | "neutral" | "sky";
  value: React.ReactNode;
}) {
  const toneClassName = {
    amber: "border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(251,191,36,0.03))]",
    emerald: "border-emerald-300/18 bg-[linear-gradient(180deg,rgba(52,211,153,0.12),rgba(52,211,153,0.03))]",
    neutral: "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]",
    sky: "border-sky-300/18 bg-[linear-gradient(180deg,rgba(56,189,248,0.12),rgba(56,189,248,0.03))]",
  }[tone];

  return (
    <div className={`rounded-[1rem] border px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${toneClassName}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300/72">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-300/70">{detail}</p> : null}
    </div>
  );
}

function MetaBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "amber" | "emerald" | "neutral" | "sky" | "violet";
}) {
  const toneClassName = {
    amber: "border-amber-300/20 bg-amber-300/12 text-amber-50",
    emerald: "border-emerald-300/20 bg-emerald-300/12 text-emerald-50",
    neutral: "border-white/10 bg-white/[0.05] text-slate-200",
    sky: "border-sky-300/20 bg-sky-300/12 text-sky-50",
    violet: "border-fuchsia-300/24 bg-fuchsia-300/14 text-fuchsia-50",
  }[tone];

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClassName}`}>
      {children}
    </span>
  );
}

function PanelSubsection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["rounded-[1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4", className].join(" ")}>
      {children}
    </div>
  );
}

function SkillSlot({
  badge,
  body,
  meta,
  status,
  toneClassName,
  title,
}: {
  badge: React.ReactNode;
  body: React.ReactNode;
  meta: React.ReactNode;
  status: React.ReactNode;
  title: React.ReactNode;
  toneClassName: string;
}) {
  return (
    <div className="group relative min-w-0">
      <div className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-[0.95rem] border px-2 py-2 text-center transition ${toneClassName}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-950/40 text-[11px] font-semibold text-white">
          {badge}
        </div>
        <p className="mt-1 text-[10px] font-semibold tracking-[0.08em] text-white">{title}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-slate-300">{status}</p>
      </div>
      <div className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-30 w-56 -translate-x-1/2 rounded-[0.95rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-3 opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.38)] transition duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-[11px] text-slate-400">{meta}</p>
        <p className="mt-2 text-xs leading-6 text-slate-300">{body}</p>
      </div>
    </div>
  );
}

function BattleSkillSlots({
  combatant,
  side,
}: {
  combatant: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["afk"]["battle"] extends infer TBattle
    ? TBattle extends { player: infer TPlayer; enemy: infer TEnemy }
      ? TPlayer | TEnemy
      : never
    : never;
  side: "player" | "enemy";
}) {
  const { locale, messages } = useI18n();
  const copy = messages.game.dashboard;
  const visibleSkills = Array.isArray(combatant.skills) && combatant.skills.length > 0
    ? combatant.skills
    : [
      {
        key: "fallback-attack",
        name: copy.skillAttackShort,
        iconText: "ATK",
        description: copy.skillAttackMeta,
        category: "attack" as const,
        level: 1,
        quality: "white" as const,
        acquisitionHint: copy.skillAttackMeta,
        trigger: "random",
        damage: calculateBattlePhysicalDamagePreview(combatant.stats.strength),
        heal: 0,
        reduction: 0,
        cooldownTurns: 0,
        maxUses: 0,
        usesRemaining: 0,
        source: side,
      },
    ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span>{formatMessage(copy.skillBattleUseLimit, { count: formatNumber(combatant.totalSkillUseLimit, locale) })}</span>
        <span>{formatMessage(copy.skillBattleUseRemaining, { count: formatNumber(combatant.totalSkillUsesRemaining, locale) })}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {visibleSkills.map((skill) => {
          const isGuard = skill.category === "guard";
          const isSpell = skill.category === "spell";
          const body = isGuard
            ? formatMessage(copy.skillGuardDetail, {
              cooldown: formatNumber(skill.cooldownTurns || (side === "player" ? BATTLE_PLAYER_GUARD_COOLDOWN_TURNS : BATTLE_ENEMY_GUARD_COOLDOWN_TURNS), locale),
              heal: formatNumber(skill.heal, locale),
              reduction: formatPercentValue(skill.reduction, locale),
              remaining: formatNumber(skill.usesRemaining, locale),
            })
            : isSpell
              ? formatMessage(copy.skillSpellDetail, {
                chance: formatPercentValue(calculateBattleSpellChancePreview(combatant.stats.intelligence), locale),
                damage: formatNumber(skill.damage, locale),
                intelligence: formatNumber(combatant.stats.intelligence, locale),
                remaining: formatNumber(skill.usesRemaining, locale),
              })
              : formatMessage(copy.skillAttackDetail, {
                blockChance: formatSecondaryStatPercent(combatant.secondaryStats.blockChance, locale),
                critChance: formatSecondaryStatPercent(combatant.secondaryStats.critChance, locale),
                critDamage: formatSecondaryStatMultiplier(combatant.secondaryStats.critDamage, locale),
                damage: formatNumber(skill.damage, locale),
                dodgeChance: formatSecondaryStatPercent(combatant.secondaryStats.dodgeChance, locale),
                strength: formatNumber(combatant.stats.strength, locale),
              });
          const meta = `${rarityLabel(skill.quality, messages)} · ${skillCategoryLabel(skill.category, messages)} · Lv.${formatNumber(skill.level, locale)}`;
          const status = isGuard
            ? combatant.defenseTurns > 0 ? copy.skillActive : formatMessage(copy.skillRemainingValue, { count: formatNumber(skill.usesRemaining, locale) })
            : isSpell || skill.category === "attack"
              ? formatMessage(copy.skillDamageShortValue, { amount: formatNumber(skill.damage, locale) })
              : copy.skillReady;

          return (
            <SkillSlot
              key={skill.key}
              badge={skill.iconText}
              body={body}
              meta={meta}
              status={status}
              title={skill.name}
              toneClassName={skillQualityTone(skill.quality)}
            />
          );
        })}
      </div>
    </div>
  );
}

function BattleStatusBar({
  combatant,
}: {
  combatant: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["afk"]["battle"] extends infer TBattle
    ? TBattle extends { player: infer TPlayer; enemy: infer TEnemy }
      ? TPlayer | TEnemy
      : never
    : never;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.game.dashboard;
  const effects = Array.isArray(combatant.activeEffects) ? combatant.activeEffects : [];

  if (effects.length === 0) {
    return (
      <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
        <div className="font-medium text-slate-300">{copy.statusBarTitle}</div>
        <div className="mt-1">{copy.statusBarEmpty}</div>
      </div>
    );
  }

  return (
    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="text-xs font-medium text-slate-300">{copy.statusBarTitle}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {effects.map((effect) => {
          const isDebuff = effect.effectType.includes("down") || effect.effectType === "damage_over_time";

          return (
            <div
              key={effect.key}
              className={[
                "min-w-[140px] rounded-[0.85rem] border px-2.5 py-2 text-xs",
                isDebuff
                  ? "border-rose-300/25 bg-rose-300/10 text-rose-50"
                  : "border-emerald-300/25 bg-emerald-300/10 text-emerald-50",
              ].join(" ")}
            >
              <div className="font-semibold">{effect.name}</div>
              <div className="mt-1 text-[11px] opacity-85">{effect.summary || effect.description}</div>
              <div className="mt-1 text-[10px] opacity-70">
                {formatMessage(copy.statusTurnsRemaining, { count: formatNumber(effect.remainingTurns, locale) })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  value,
  children,
}: {
  label: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="rounded-[0.95rem] border border-white/8 bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1 relative">
        <select
          className="w-full appearance-none bg-transparent pr-7 text-sm font-semibold text-white outline-none"
          onChange={onChange}
          value={value}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-xs text-slate-400">▾</span>
      </div>
    </label>
  );
}

function RailButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "group w-full rounded-[1rem] border px-4 py-3 text-left transition duration-200",
        active
          ? "border-sky-300/45 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(56,189,248,0.06))] shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18),0_10px_28px_rgba(14,165,233,0.12)]"
          : "border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] hover:border-sky-200/30 hover:bg-white/[0.05]",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold text-white">{label}</p>
        {count ? (
          <span
            className={[
              "rounded-full border px-2 py-0.5 text-[10px]",
              active ? "border-sky-200/20 bg-sky-300/12 text-sky-50" : "border-white/10 bg-white/[0.05] text-slate-300",
            ].join(" ")}
          >
            {count}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ItemTile({
  active,
  equippedCount,
  iconKey,
  itemName,
  itemType,
  onClick,
  quantity,
  rarity,
}: {
  active: boolean;
  equippedCount: number;
  iconKey: string | null;
  itemName: string;
  itemType: BackpackItem["itemType"];
  onClick: () => void;
  quantity: number;
  rarity: string;
}) {
  const { messages } = useI18n();
  const Icon = getGameIconByKey(iconKey, getItemTypeFallbackIconKey(itemType));

  return (
    <button
      className={[
        "group relative flex aspect-square flex-col overflow-hidden rounded-[1rem] border p-3 text-left transition",
        itemAccent(rarity),
        active ? "ring-2 ring-sky-300/60" : "hover:translate-y-[-1px]",
      ].join(" ")}
      onClick={onClick}
      title={itemName}
      type="button"
    >
      {equippedCount > 0 ? (
        <span className="absolute right-2 top-2 rounded-full border border-emerald-300/35 bg-emerald-300/14 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-100">
          {messages.game.dashboard.equippedBadge}
        </span>
      ) : null}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-black/20 text-white">
          <Icon className="h-8 w-8" />
        </span>
      </div>
      <span className="pointer-events-none absolute bottom-2 left-3 right-10 truncate text-xs font-medium leading-5 text-white/72">
        {itemName}
      </span>
      <span className="absolute bottom-2 right-2 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold text-white/90">
        {quantity}
      </span>
    </button>
  );
}

function LandingView() {
  const { messages } = useI18n();
  const copy = messages.game;
  const { accountLogin, guestLogin, status } = useGameSession();
  const [loginMode, setLoginMode] = useState<"guest" | "account">("guest");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#25336f_0%,#11173a_36%,#050716_100%)] px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard className="overflow-hidden border-white/6 bg-[linear-gradient(135deg,rgba(59,79,170,0.9),rgba(17,25,58,0.98)_54%,rgba(7,10,23,0.98))] px-5 py-6 md:px-8 md:py-7">
          <SectionEyebrow>{copy.landing.eyebrow}</SectionEyebrow>
          <div className="mt-4 max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
              伊洛纳风格挂机旅程
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-200/76">
              从游客试玩到账号常驻，从离线收益到装备整理，整套循环都围绕轻量但有成长反馈的冒险节奏展开。
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <StatusChip tone="sky">Server Driven</StatusChip>
            <StatusChip tone="emerald">Offline Reward</StatusChip>
            <StatusChip tone="warning">Loot & Market</StatusChip>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [copy.landing.cards.server.title, copy.landing.cards.server.summary],
              [copy.landing.cards.offline.title, copy.landing.cards.offline.summary],
              [copy.landing.cards.backpack.title, copy.landing.cards.backpack.summary],
            ].map(([title, summary]) => (
              <PanelSubsection key={title} className="bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-100/55">{title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{summary}</p>
              </PanelSubsection>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="px-5 py-6 md:px-6 md:py-7">
          <SectionEyebrow>{copy.landing.access}</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{copy.landing.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300/76">
            先选择进入方式，再决定是快速试玩还是绑定长期进度。
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              className={[
                "rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition",
                loginMode === "guest"
                  ? "border-sky-300/45 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(56,189,248,0.05))] text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-300",
              ].join(" ")}
              onClick={() => setLoginMode("guest")}
              type="button"
            >
              <span className="block">{copy.landing.guestLogin}</span>
              <span className="mt-1 block text-[11px] font-medium text-current/75">立即进入，适合快速体验</span>
            </button>
            <button
              className={[
                "rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition",
                loginMode === "account"
                  ? "border-emerald-300/45 bg-[linear-gradient(180deg,rgba(52,211,153,0.18),rgba(52,211,153,0.05))] text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-300",
              ].join(" ")}
              onClick={() => setLoginMode("account")}
              type="button"
            >
              <span className="block">{copy.landing.accountLogin}</span>
              <span className="mt-1 block text-[11px] font-medium text-current/75">保存角色进度，长期游玩</span>
            </button>
          </div>

          {loginMode === "guest" ? (
            <button
              className="mt-8 w-full rounded-[1.1rem] bg-[linear-gradient(90deg,#60a5fa_0%,#34d399_100%)] px-5 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "booting" || status === "saving"}
              onClick={() => {
                void guestLogin();
              }}
              type="button"
            >
              {status === "booting" ? copy.landing.guestLoading : copy.landing.guestEnter}
            </button>
          ) : (
            <>
              <label className="mt-8 block">
                <span className="text-sm font-medium text-emerald-100">{copy.landing.username}</span>
                <input
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={copy.landing.usernamePlaceholder}
                  value={username}
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-emerald-100">{copy.landing.password}</span>
                <input
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={copy.landing.passwordPlaceholder}
                  type="password"
                  value={password}
                />
              </label>

              <button
                className="mt-8 w-full rounded-[1.1rem] bg-[linear-gradient(90deg,#34d399_0%,#60a5fa_100%)] px-5 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status === "booting" || status === "saving" || !username.trim() || !password}
                onClick={() => {
                  void accountLogin({
                    password,
                    username,
                  });
                }}
                type="button"
              >
                {status === "booting" ? copy.landing.accountChecking : copy.landing.accountEnter}
              </button>
            </>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

function CreateRoleView() {
  const { locale, messages } = useI18n();
  const copy = messages.game;
  const { createRole, snapshot, status } = useGameSession();
  const [name, setName] = useState<string>(copy.createRole.unnamed);
  const [raceKey, setRaceKey] = useState<RaceKey>("human");
  const [classKey, setClassKey] = useState<ClassKey>("warrior");

  const races = snapshot?.config.races ?? [];
  const classes = snapshot?.config.classes ?? [];
  const selectedRace = races.find((item) => item.key === raceKey);
  const selectedClass = classes.find((item) => item.key === classKey);
  const fusedStats = {
    agility: (selectedRace?.stats.agility ?? 0) + (selectedClass?.stats.agility ?? 0),
    intelligence: (selectedRace?.stats.intelligence ?? 0) + (selectedClass?.stats.intelligence ?? 0),
    strength: (selectedRace?.stats.strength ?? 0) + (selectedClass?.stats.strength ?? 0),
    vitality: (selectedRace?.stats.vitality ?? 0) + (selectedClass?.stats.vitality ?? 0),
  };
  const previewHealth = getMaxHealth(fusedStats.vitality, 1);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#283365_0%,#101533_40%,#050716_100%)] px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard className="px-5 py-6 md:px-8 md:py-7">
          <SectionEyebrow>{copy.createRole.setup}</SectionEyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">{copy.createRole.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300/76">
            先决定种族与职业倾向，再从右侧预览你的开局构筑和基础生存能力。
          </p>

          <label className="mt-8 block">
            <span className="text-sm font-medium text-sky-100">{copy.createRole.roleName}</span>
            <input
              className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-sky-300"
              maxLength={12}
              onChange={(event) => setName(event.target.value)}
              placeholder={copy.createRole.roleNamePlaceholder}
              value={name}
            />
          </label>

          <div className="mt-8">
            <SectionEyebrow>{copy.createRole.race}</SectionEyebrow>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {races.map((race) => (
                <button
                  key={race.key}
                  className={[
                    "rounded-[1rem] border p-4 text-left transition",
                    race.key === raceKey
                      ? "border-sky-300/45 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(56,189,248,0.05))] shadow-[0_10px_30px_rgba(14,165,233,0.12)]"
                      : "border-white/8 bg-white/[0.03] hover:border-sky-200/25",
                  ].join(" ")}
                  onClick={() => setRaceKey(race.key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {(() => {
                        const RaceIcon = raceIconByConfig(race.key, race.iconKey);
                        return <RaceIcon className="h-5 w-5 text-sky-200" />;
                      })()}
                      <p className="text-lg font-semibold text-white">{localizeRaceLabel(race.key, race.label, locale)}</p>
                    </div>
                    <MetaBadge tone="sky">
                      {race.key}
                    </MetaBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeRaceSummary(race.key, race.summary, locale)}</p>
                  <p className="mt-3 text-xs text-sky-100/70">
                    {statLabel("strength", messages)} {race.stats.strength} · {statLabel("agility", messages)} {race.stats.agility} · {statLabel("intelligence", messages)} {race.stats.intelligence} · {statLabel("vitality", messages)}{" "}
                    {race.stats.vitality}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <SectionEyebrow>{copy.createRole.class}</SectionEyebrow>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {classes.map((roleClass) => (
                <button
                  key={roleClass.key}
                  className={[
                    "rounded-[1rem] border p-4 text-left transition",
                    roleClass.key === classKey
                      ? "border-emerald-300/45 bg-[linear-gradient(180deg,rgba(52,211,153,0.18),rgba(52,211,153,0.05))] shadow-[0_10px_30px_rgba(16,185,129,0.12)]"
                      : "border-white/8 bg-white/[0.03] hover:border-emerald-200/25",
                  ].join(" ")}
                  onClick={() => setClassKey(roleClass.key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {(() => {
                        const ClassIcon = classIconByConfig(roleClass.key, roleClass.iconKey);
                        return <ClassIcon className="h-5 w-5 text-emerald-200" />;
                      })()}
                      <p className="text-lg font-semibold text-white">{localizeClassLabel(roleClass.key, roleClass.label, locale)}</p>
                    </div>
                    <MetaBadge tone="emerald">
                      {roleClass.key}
                    </MetaBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeClassSummary(roleClass.key, roleClass.summary, locale)}</p>
                  <p className="mt-3 text-xs text-emerald-100/70">
                    {statLabel("strength", messages)} {roleClass.stats.strength} · {statLabel("agility", messages)} {roleClass.stats.agility} · {statLabel("intelligence", messages)}{" "}
                    {roleClass.stats.intelligence} · {statLabel("vitality", messages)} {roleClass.stats.vitality}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(12,16,34,0.98))] px-5 py-6 md:px-6 md:py-7">
          <SectionEyebrow>{copy.createRole.preview}</SectionEyebrow>
          <PanelSubsection className="mt-4 bg-[linear-gradient(135deg,rgba(59,79,170,0.2),rgba(255,255,255,0.03))]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100/55">{copy.createRole.currentBuild}</p>
            <div className="mt-3 flex items-center gap-2.5">
              {selectedRace ? (() => {
                const RaceIcon = raceIconByConfig(selectedRace.key, selectedRace.iconKey);
                return <RaceIcon className="h-5 w-5 text-sky-200" />;
              })() : null}
              {selectedClass ? (() => {
                const ClassIcon = classIconByConfig(selectedClass.key, selectedClass.iconKey);
                return <ClassIcon className="h-5 w-5 text-emerald-200" />;
              })() : null}
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-white">{name || copy.createRole.unnamed}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {(selectedRace ? localizeRaceLabel(selectedRace.key, selectedRace.label, locale) : copy.createRole.noRace)} / {(selectedClass ? localizeClassLabel(selectedClass.key, selectedClass.label, locale) : copy.createRole.noClass)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip tone="sky">{selectedRace ? localizeRaceLabel(selectedRace.key, selectedRace.label, locale) : copy.createRole.noRace}</StatusChip>
              <StatusChip tone="emerald">{selectedClass ? localizeClassLabel(selectedClass.key, selectedClass.label, locale) : copy.createRole.noClass}</StatusChip>
            </div>
          </PanelSubsection>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DataPill label={statLabel("strength", messages)} value={fusedStats.strength} />
            <DataPill label={statLabel("agility", messages)} value={fusedStats.agility} />
            <DataPill label={statLabel("intelligence", messages)} value={fusedStats.intelligence} />
            <DataPill label={statLabel("vitality", messages)} value={fusedStats.vitality} />
            <DataPill label={copy.dashboard.currentHealth} value={formatNumber(previewHealth, locale)} />
          </div>

          <button
            className="mt-6 w-full rounded-[1.1rem] bg-[linear-gradient(90deg,#60a5fa_0%,#34d399_100%)] px-5 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status === "saving" || name.trim().length < 2}
            onClick={() => {
              void createRole({ classKey, name, raceKey });
            }}
            type="button"
          >
            {status === "saving" ? copy.createRole.createLoading : copy.createRole.createSubmit}
          </button>
        </SectionCard>
      </div>
    </main>
  );
}

function BackpackSectionList({
  backpack,
  onSelectItem,
  selectedBackpackId,
}: {
  backpack: BackpackItem[];
  onSelectItem: (backpackId: string) => void;
  selectedBackpackId: string | null;
}) {
  const { locale, messages } = useI18n();
  const groupedItems = backpack.reduce<Record<BackpackItem["itemType"], BackpackItem[]>>((accumulator, item) => {
    const current = accumulator[item.itemType] ?? [];
    current.push(item);
    accumulator[item.itemType] = current;
    return accumulator;
  }, {
    equipment: [],
    skill_book: [],
    material: [],
  });
  const sectionOrder: Array<BackpackItem["itemType"]> = ["equipment", "skill_book", "material"];

  return (
    <div className="space-y-4">
      {sectionOrder.map((itemType) => {
        const items = groupedItems[itemType] ?? [];

        if (items.length <= 0) {
          return null;
        }

        return (
          <div key={itemType} className="rounded-[1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300/78">{itemTypeLabel(itemType, messages)}</p>
              <p className="mt-1 text-[11px] text-slate-500">{formatNumber(items.length, locale)} {messages.common.speciesUnit}</p>
            </div>
              <MetaBadge tone={itemCategoryTone(itemType)}>{itemTypeLabel(itemType, messages)}</MetaBadge>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {items.map((item) => (
              <ItemTile
                key={item.backpackId}
                active={selectedBackpackId === item.backpackId}
                equippedCount={item.equippedCount ?? 0}
                iconKey={item.iconKey}
                itemName={localizeItemName(item.itemId, item.name, locale)}
                itemType={item.itemType}
                onClick={() => onSelectItem(item.backpackId)}
                quantity={item.quantity}
                rarity={item.rarity}
              />
            ))}
          </div>
          </div>
        );
      })}
    </div>
  );
}

function CenterPanel({
  activePanel,
  backpack,
  isRealtimeReady,
  currentTaskReward,
  maps,
  onRequestBuyMarketListing,
  onConfigureSkillLoadout,
  onUnequipItem,
  onSelectItem,
  role,
  selectedBackpackId,
  selectedMapKey,
  selectMap,
  snapshot,
  startAfk,
  status,
  stopAfk,
  taskDuration,
  taskProgress,
  taskProgressPercent,
}: {
  activePanel: PanelKey;
  backpack: BackpackItem[];
  isRealtimeReady: boolean;
  currentTaskReward: {
    aetherCrystal: number;
    exp: number;
    gold: number;
  };
  maps: MapConfig[];
  onRequestBuyMarketListing: (listingId: string) => void;
  onConfigureSkillLoadout: (skillKey: string, action: "equip" | "unequip") => void;
  onUnequipItem: (backpackId: string) => void;
  onSelectItem: (backpackId: string) => void;
  role: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["role"];
  selectedBackpackId: string | null;
  selectedMapKey: MapKey;
  selectMap: (mapKey: MapKey) => void;
  snapshot: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>;
  startAfk: ReturnType<typeof useGameSession>["startAfk"];
  status: ReturnType<typeof useGameSession>["status"];
  stopAfk: ReturnType<typeof useGameSession>["stopAfk"];
  taskDuration: number;
  taskProgress: number;
  taskProgressPercent: number;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.game;
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<"all" | "equipment" | "skill_book" | "material">("equipment");
  const [marketRarityFilter, setMarketRarityFilter] = useState<"all" | "white" | "green" | "blue" | "purple" | "orange">("all");
  const [marketSlotFilter, setMarketSlotFilter] = useState<"all" | BodySlotType>("all");
  const [battleFxState, setBattleFxState] = useState({
    enemyHitAt: 0,
    enemyPulseAt: 0,
    playerHitAt: 0,
    playerPulseAt: 0,
    turnFlashAt: 0,
  });
  const previousBattleRef = useRef<NonNullable<typeof snapshot.afk.battle> | null>(null);
  const activeBattle = snapshot.afk.battle?.active ? snapshot.afk.battle : null;
  const battleStatusCopy = activeBattle
    ? copy.dashboard.battleOngoing
    : snapshot.afk.battle?.winner === "player"
      ? copy.dashboard.battleVictory
      : snapshot.afk.battle?.winner === "enemy"
        ? copy.dashboard.battleDefeat
        : messages.common.idle;

  useEffect(() => {
    if (!activeBattle) {
      previousBattleRef.current = null;
      return;
    }

    const previousBattle = previousBattleRef.current;

    if (previousBattle && previousBattle.battleId === activeBattle.battleId) {
      const nextFxState = { ...battleFxState };
      let shouldUpdateFx = false;

      if (activeBattle.turnCount !== previousBattle.turnCount) {
        nextFxState.turnFlashAt = Date.now();
        shouldUpdateFx = true;
      }

      if (activeBattle.player.currentHealth < previousBattle.player.currentHealth) {
        nextFxState.playerHitAt = Date.now();
        shouldUpdateFx = true;
      }

      if (activeBattle.enemy.currentHealth < previousBattle.enemy.currentHealth) {
        nextFxState.enemyHitAt = Date.now();
        shouldUpdateFx = true;
      }

      if (activeBattle.player.actionBar > previousBattle.player.actionBar) {
        nextFxState.playerPulseAt = Date.now();
        shouldUpdateFx = true;
      }

      if (activeBattle.enemy.actionBar > previousBattle.enemy.actionBar) {
        nextFxState.enemyPulseAt = Date.now();
        shouldUpdateFx = true;
      }

      if (shouldUpdateFx) {
        setBattleFxState(nextFxState);
      }
    }

    previousBattleRef.current = activeBattle;
  }, [activeBattle, battleFxState]);

  const battleFxNow = Date.now();
  const isBattleTurnFlashing = Boolean(activeBattle) && battleFxNow - battleFxState.turnFlashAt < 420;
  const isPlayerHit = Boolean(activeBattle) && battleFxNow - battleFxState.playerHitAt < 380;
  const isEnemyHit = Boolean(activeBattle) && battleFxNow - battleFxState.enemyHitAt < 380;
  const isPlayerPulsing = Boolean(activeBattle) && battleFxNow - battleFxState.playerPulseAt < 520;
  const isEnemyPulsing = Boolean(activeBattle) && battleFxNow - battleFxState.enemyPulseAt < 520;
  const equipmentCount = backpack.filter((item) => item.itemType === "equipment").length;
  const skillBookCount = backpack.filter((item) => item.itemType === "skill_book").length;
  const materialCount = backpack.filter((item) => item.itemType === "material").length;

  if (!role) {
    return null;
  }

  if (activePanel === "backpack") {
    return (
      <SectionCard className="flex min-h-[24rem] flex-col overflow-hidden xl:h-full xl:min-h-0">
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-3">
          <SectionEyebrow>{copy.dashboard.inventory}</SectionEyebrow>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.dashboard.backpackTitle}</h2>
              <p className="mt-1 text-sm text-slate-300/72">
                按物品类型分组查看库存，点选任意物品后在右侧快速比较属性与用途。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <DataPill label={copy.dashboard.inventoryCount} value={formatNumber(backpack.length, locale)} />
              <DataPill label={copy.dashboard.equipmentCount} value={formatNumber(equipmentCount, locale)} />
              <DataPill
                label={copy.dashboard.equippedCount}
                value={formatNumber(backpack.reduce((total, item) => total + (item.equippedCount ?? 0), 0), locale)}
              />
              <DataPill label={copy.dashboard.skillBookCount} value={formatNumber(skillBookCount, locale)} />
              <DataPill label={copy.dashboard.materialCount} value={formatNumber(materialCount, locale)} />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <BackpackSectionList
            backpack={backpack}
            onSelectItem={onSelectItem}
            selectedBackpackId={selectedBackpackId}
          />
        </div>
      </SectionCard>
    );
  }

  if (activePanel === "role") {
    const race = snapshot.config.races.find((item) => item.key === role.raceKey);
    const roleClass = snapshot.config.classes.find((item) => item.key === role.classKey);
    const bodySlots = getSafeBodySlots(role);
    const equippedSkills = Array.isArray(role.equippedSkills) ? role.equippedSkills : [];
    const learnedSkills = Array.isArray(role.learnedSkills) ? role.learnedSkills : [];

    return (
      <SectionCard className="flex min-h-[24rem] flex-col overflow-hidden xl:h-full xl:min-h-0">
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-3">
          <SectionEyebrow>{copy.dashboard.characterSheet}</SectionEyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{copy.dashboard.roleTitle}</h2>
          <p className="mt-1 text-sm text-slate-300/72">
            汇总角色状态、当前装备和技能编成，方便快速调整战斗构筑。
          </p>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 xl:grid-cols-[1.05fr_0.95fr]">
          <PanelSubsection className="bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]">
            <div className="flex items-center gap-2.5">
              {race ? (() => {
                const RaceIcon = raceIconByConfig(race.key, race.iconKey);
                return <RaceIcon className="h-5 w-5 text-sky-200" />;
              })() : null}
              {roleClass ? (() => {
                const ClassIcon = classIconByConfig(roleClass.key, roleClass.iconKey);
                return <ClassIcon className="h-5 w-5 text-emerald-200" />;
              })() : null}
              <p className="text-2xl font-semibold text-white">{role.name}</p>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {race ? localizeRaceLabel(race.key, race.label, locale) : copy.createRole.noRace} / {roleClass ? localizeClassLabel(roleClass.key, roleClass.label, locale) : copy.createRole.noClass}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{race ? localizeRaceSummary(race.key, race.summary, locale) : ""}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{roleClass ? localizeClassSummary(roleClass.key, roleClass.summary, locale) : ""}</p>
          </PanelSubsection>

          <PanelSubsection className="border-rose-300/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(15,23,42,0.18))]">
            <TopStatusBar
              className="border-none bg-transparent p-0"
              label={copy.dashboard.healthStatus}
              tone="from-rose-500 via-orange-400 to-emerald-300"
              value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DataPill label={copy.dashboard.currentHealth} value={`${formatNumber(role.currentHealth, locale)} / ${formatNumber(role.maxHealth, locale)}`} />
              <DataPill label={copy.dashboard.deathPenalty} value={copy.dashboard.deathPenaltyValue} />
            </div>
          </PanelSubsection>

          <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
            <DataPill label={copy.dashboard.level} value={formatNumber(role.level, locale)} />
            <DataPill label={copy.dashboard.exp} value={formatNumber(role.exp, locale)} />
            <DataPill label={copy.dashboard.maxHealth} value={formatNumber(role.maxHealth, locale)} />
            <DataPill label={statLabel("strength", messages)} value={formatNumber(role.stats.strength, locale)} />
            <DataPill label={statLabel("agility", messages)} value={formatNumber(role.stats.agility, locale)} />
            <DataPill label={statLabel("intelligence", messages)} value={formatNumber(role.stats.intelligence, locale)} />
            <DataPill label={statLabel("vitality", messages)} value={formatNumber(role.stats.vitality, locale)} />
            <DataPill label={statLabel("critChance", messages)} value={formatSecondaryStatPercent(role.secondaryStats.critChance, locale)} />
            <DataPill label={statLabel("critDamage", messages)} value={formatSecondaryStatMultiplier(role.secondaryStats.critDamage, locale)} />
            <DataPill label={statLabel("dodgeChance", messages)} value={formatSecondaryStatPercent(role.secondaryStats.dodgeChance, locale)} />
            <DataPill label={statLabel("blockChance", messages)} value={formatSecondaryStatPercent(role.secondaryStats.blockChance, locale)} />
            <DataPill label={statLabel("blockDamageReduction", messages)} value={formatSecondaryStatPercent(role.secondaryStats.blockDamageReduction, locale)} />
            <DataPill label={statLabel("healthRegenRate", messages)} value={formatSecondaryStatPercent(role.secondaryStats.healthRegenRate, locale)} />
          </div>

          <PanelSubsection className="xl:col-span-2">
            <SectionEyebrow>{copy.dashboard.bodySlots}</SectionEyebrow>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bodySlots.map((slot) => (
                <div
                  key={slot.key}
                  className={[
                    "rounded-[0.95rem] border p-4",
                    slot.item
                      ? marketItemCardAccent(slot.item.rarity)
                      : "border-white/8 bg-[linear-gradient(180deg,rgba(2,6,23,0.44),rgba(2,6,23,0.22))]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{bodySlotKeyLabel(slot.key, messages)}</p>
                    <MetaBadge tone={slot.item ? rarityMetaBadgeTone(slot.item.rarity) : "neutral"}>
                      {slot.item ? rarityLabel(slot.item.rarity, messages) : slotLabel(slot.slotType, messages)}
                    </MetaBadge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{slot.item ? localizeItemName(slot.item.itemId, slot.item.name, locale) : copy.dashboard.emptySlot}</p>
                  {slot.item ? (
                    <button
                      className="mt-3 min-h-11 rounded-[0.8rem] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 transition hover:border-sky-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!isRealtimeReady || status === "saving"}
                      onClick={() => onUnequipItem(slot.item!.backpackId)}
                      type="button"
                    >
                      {copy.dashboard.unequip}
                    </button>
                  ) : null}
                </div>
              ))}
              {bodySlots.length === 0 ? (
                <div className="rounded-[0.95rem] border border-dashed border-white/10 bg-slate-950/25 p-4 text-sm text-slate-400 sm:col-span-2 lg:col-span-3">
                  {copy.dashboard.bodySlotsSyncing}
                </div>
              ) : null}
            </div>
          </PanelSubsection>

          <PanelSubsection className="xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionEyebrow>{copy.dashboard.skillPanelTitle}</SectionEyebrow>
              <MetaBadge tone="sky">
                {formatMessage(copy.dashboard.skillSlotsSummary, {
                  remaining: formatNumber(role.skillSlots.remaining, locale),
                  total: formatNumber(role.skillSlots.total, locale),
                  used: formatNumber(role.skillSlots.used, locale),
                })}
              </MetaBadge>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{copy.dashboard.equippedSkillsTitle}</p>
              {equippedSkills.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {equippedSkills.map((skill) => (
                    <div
                      key={`equipped-${skill.key}`}
                      className={`rounded-[0.95rem] border p-3 ${skillQualityTone(skill.quality)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{skill.name}</p>
                          <p className="mt-1 text-xs text-slate-300/85">{skillCategoryLabel(skill.category, messages)} · Lv.{formatNumber(skill.level, locale)}</p>
                        </div>
                        <button
                          className="min-h-10 shrink-0 rounded-[0.7rem] border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!isRealtimeReady || status === "saving"}
                          onClick={() => onConfigureSkillLoadout(skill.key, "unequip")}
                          type="button"
                        >
                          {messages.game.itemActions.unequip.label}
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-300/78">{skill.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">{copy.dashboard.equippedSkillsEmpty}</p>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{copy.dashboard.learnedSkillsTitle}</p>
              {learnedSkills.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {learnedSkills.map((skill) => (
                    <div
                      key={`learned-${skill.key}`}
                      className={`rounded-[0.95rem] border p-3 ${skillQualityTone(skill.quality)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{skill.name}</p>
                          <p className="mt-1 text-xs text-slate-300/85">{skillCategoryLabel(skill.category, messages)} · Lv.{formatNumber(skill.level, locale)}</p>
                        </div>
                        {skill.equipped ? (
                          <MetaBadge tone="emerald">{copy.dashboard.skillEquippedBadge}</MetaBadge>
                        ) : (
                          <button
                            className="min-h-10 shrink-0 rounded-[0.7rem] border border-cyan-200/25 bg-cyan-300/12 px-2.5 py-1 text-xs text-cyan-50 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!isRealtimeReady || status === "saving" || role.skillSlots.remaining <= 0}
                            onClick={() => onConfigureSkillLoadout(skill.key, "equip")}
                            type="button"
                          >
                            {messages.game.itemActions.equip.label}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-300/78">{skill.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">{copy.dashboard.learnedSkillsEmpty}</p>
              )}
            </div>
          </PanelSubsection>
        </div>
      </SectionCard>
    );
  }

  if (activePanel === "market") {
    const marketListings = snapshot.market.listings.filter((listing) => (
      (marketCategoryFilter === "all" || listing.categoryKey === marketCategoryFilter)
      && (marketRarityFilter === "all" || listing.rarity === marketRarityFilter)
      && (marketSlotFilter === "all" || listing.slot === marketSlotFilter)
    ));

    return (
      <SectionCard className="flex min-h-[24rem] flex-col overflow-hidden xl:h-full xl:min-h-0">
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-3">
          <SectionEyebrow>{copy.market.eyebrow}</SectionEyebrow>
          <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.market.title}</h2>
              <p className="mt-1 text-sm text-slate-300/72">{copy.market.summary}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <FilterSelect
                label={copy.market.filters.category}
                onChange={(event) => setMarketCategoryFilter(event.target.value as "all" | "equipment" | "skill_book" | "material")}
                value={marketCategoryFilter}
              >
                <option value="all">{messages.common.all}</option>
                {snapshot.market.categoryOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={copy.market.filters.rarity}
                onChange={(event) => setMarketRarityFilter(event.target.value as typeof marketRarityFilter)}
                value={marketRarityFilter}
              >
                <option value="all">{messages.common.all}</option>
                {snapshot.market.rarityOptions.map((rarity) => (
                  <option key={rarity} value={rarity}>{rarityLabel(rarity, messages)}</option>
                ))}
              </FilterSelect>
              <FilterSelect
                label={copy.market.filters.slot}
                onChange={(event) => setMarketSlotFilter(event.target.value as "all" | BodySlotType)}
                value={marketSlotFilter}
              >
                <option value="all">{messages.common.all}</option>
                {snapshot.market.slotOptions.map((slot) => (
                  <option key={slot} value={slot}>{slotLabel(slot, messages)}</option>
                ))}
              </FilterSelect>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {marketListings.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {marketListings.map((listing) => (
                <div key={listing.listingId} className={`rounded-[1rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${marketItemCardAccent(listing.rarity)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{localizeItemName(listing.itemId, listing.name, locale)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <MetaBadge tone="amber">{slotLabel(listing.slot, messages)}</MetaBadge>
                        <MetaBadge tone={rarityMetaBadgeTone(listing.rarity)}>{rarityLabel(listing.rarity, messages)}</MetaBadge>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] ${itemAccent(listing.rarity)}`}>
                      {formatNumber(listing.price, locale)} {copy.market.goldUnit}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeItemDescription(listing.itemId, listing.description, locale)}</p>
                  <p className="mt-3 text-xs leading-6 text-sky-100/75">{formatStatsSummary(listing.stats, locale, messages)}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <DataPill label={copy.market.lowestPrice} value={formatNumber(listing.price, locale)} />
                    <DataPill label={copy.market.availableCount} value={formatNumber(listing.availableCount, locale)} />
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {formatMessage(copy.market.sellerHint, { sellerName: listing.sellerName })}
                  </p>
                  <button
                    className="mt-4 w-full rounded-[0.95rem] bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!isRealtimeReady || status === "saving" || listing.isOwnListing}
                    onClick={() => onRequestBuyMarketListing(listing.listingId)}
                    type="button"
                  >
                    {listing.isOwnListing ? copy.market.ownListing : copy.market.buyNow}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm leading-7 text-slate-400">
              {copy.market.empty}
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  if (activeBattle) {
    return (
      <SectionCard className="flex min-h-[24rem] flex-col overflow-hidden xl:h-full xl:min-h-0">
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-3">
          <SectionEyebrow>{copy.dashboard.battleTitle}</SectionEyebrow>
          <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-[1.5rem] font-semibold tracking-[-0.04em] text-white">{copy.dashboard.battleTitle}</h2>
              <p className="mt-1 text-sm text-slate-300/72">{copy.dashboard.battleSummary}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <DataPill label={copy.dashboard.battleStatus} value={battleStatusCopy} />
              <DataPill label={copy.dashboard.battleTurns} value={formatNumber(activeBattle.turnCount, locale)} />
              <DataPill label={copy.dashboard.currentRound} value={copy.dashboard.battlePausedShort} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-4 xl:col-span-2">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <InlineStat label={copy.dashboard.status} value={messages.common.fighting} />
                <InlineStat label={copy.dashboard.executed} value={formatNumber(activeBattle.turnCount, locale)} />
                <InlineStat
                  label={copy.dashboard.skillBattleUseLimit}
                  value={formatNumber(activeBattle.player.totalSkillUseLimit, locale)}
                />
                <InlineStat
                  label={copy.dashboard.skillBattleUseRemaining}
                  value={formatNumber(activeBattle.player.totalSkillUsesRemaining, locale)}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300/72">{copy.dashboard.battlePausedHint}</p>
            </div>

            <div className={`rounded-[1rem] border border-emerald-300/20 bg-[linear-gradient(180deg,rgba(52,211,153,0.12),rgba(52,211,153,0.03))] p-4 transition-all duration-300 ${isPlayerHit ? "scale-[0.985] border-rose-300/45 bg-rose-300/12 shadow-[0_0_28px_rgba(251,113,133,0.18)]" : isPlayerPulsing ? "shadow-[0_0_24px_rgba(45,212,191,0.14)]" : ""} ${isBattleTurnFlashing ? "shadow-[inset_0_0_0_1px_rgba(125,211,252,0.14)]" : ""}`}>
              <SectionEyebrow>{copy.dashboard.selfInfo}</SectionEyebrow>
              <p className="mt-1.5 text-lg font-semibold text-white">{activeBattle.player.name}</p>
              <div className="mt-3">
                <TopStatusBar
                  barClassName={`h-3 ${isPlayerHit ? "animate-pulse" : ""}`}
                  label={copy.dashboard.lifeBar}
                  tone="from-emerald-400 via-cyan-300 to-sky-300"
                  valueLabel={`${formatNumber(activeBattle.player.currentHealth, locale)} / ${formatNumber(activeBattle.player.maxHealth, locale)}`}
                  value={(activeBattle.player.currentHealth / Math.max(1, activeBattle.player.maxHealth)) * 100}
                />
              </div>
              <div className="mt-3">
                <TopStatusBar
                  barClassName={`h-2.5 ${isPlayerPulsing ? "animate-pulse" : ""}`}
                  label={copy.dashboard.actionBar}
                  tone="from-sky-400 via-cyan-300 to-teal-300"
                  value={activeBattle.player.actionBar}
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DataPill label={copy.dashboard.skillBattleUseLimit} value={formatNumber(activeBattle.player.totalSkillUseLimit, locale)} />
                <DataPill label={copy.dashboard.skillBattleUseRemaining} value={formatNumber(activeBattle.player.totalSkillUsesRemaining, locale)} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DataPill label={statLabel("critChance", messages)} value={formatSecondaryStatPercent(activeBattle.player.secondaryStats.critChance, locale)} />
                <DataPill label={statLabel("dodgeChance", messages)} value={formatSecondaryStatPercent(activeBattle.player.secondaryStats.dodgeChance, locale)} />
                <DataPill label={statLabel("blockChance", messages)} value={formatSecondaryStatPercent(activeBattle.player.secondaryStats.blockChance, locale)} />
                <DataPill label={statLabel("healthRegenRate", messages)} value={formatSecondaryStatPercent(activeBattle.player.secondaryStats.healthRegenRate, locale)} />
              </div>
              <div className="mt-3">
                <BattleStatusBar combatant={activeBattle.player} />
              </div>
              <div className="mt-3">
                <BattleSkillSlots combatant={activeBattle.player} side="player" />
              </div>
            </div>

            <div className={`rounded-[1rem] border border-rose-300/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(244,63,94,0.03))] p-4 transition-all duration-300 ${isEnemyHit ? "scale-[0.985] border-amber-200/55 bg-amber-300/10 shadow-[0_0_28px_rgba(251,191,36,0.18)]" : isEnemyPulsing ? "shadow-[0_0_24px_rgba(251,146,60,0.14)]" : ""} ${isBattleTurnFlashing ? "shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]" : ""}`}>
              <SectionEyebrow>{copy.dashboard.enemyInfo}</SectionEyebrow>
              <p className="mt-1.5 text-lg font-semibold text-white">{activeBattle.enemy.name}</p>
              <div className="mt-3">
                <TopStatusBar
                  barClassName={`h-3 ${isEnemyHit ? "animate-pulse" : ""}`}
                  label={copy.dashboard.lifeBar}
                  tone="from-rose-500 via-orange-400 to-amber-300"
                  valueLabel={`${formatNumber(activeBattle.enemy.currentHealth, locale)} / ${formatNumber(activeBattle.enemy.maxHealth, locale)}`}
                  value={(activeBattle.enemy.currentHealth / Math.max(1, activeBattle.enemy.maxHealth)) * 100}
                />
              </div>
              <div className="mt-3">
                <TopStatusBar
                  barClassName={`h-2.5 ${isEnemyPulsing ? "animate-pulse" : ""}`}
                  label={copy.dashboard.actionBar}
                  tone="from-amber-300 via-orange-300 to-rose-300"
                  value={activeBattle.enemy.actionBar}
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DataPill label={copy.dashboard.enemyLevel} value={formatNumber(activeBattle.enemy.level, locale)} />
                <DataPill label={copy.dashboard.defenseActive} value={activeBattle.enemy.defenseTurns > 0 ? messages.common.now : messages.common.idle} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DataPill label={statLabel("critChance", messages)} value={formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.critChance, locale)} />
                <DataPill label={statLabel("dodgeChance", messages)} value={formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.dodgeChance, locale)} />
                <DataPill label={statLabel("blockChance", messages)} value={formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.blockChance, locale)} />
                <DataPill label={statLabel("healthRegenRate", messages)} value={formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.healthRegenRate, locale)} />
              </div>
              <div className="mt-3">
                <BattleStatusBar combatant={activeBattle.enemy} />
              </div>
              <div className="mt-3">
                <BattleSkillSlots combatant={activeBattle.enemy} side="enemy" />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="flex min-h-[24rem] flex-col overflow-hidden xl:h-full xl:min-h-0">
      <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-4 py-3">
        <SectionEyebrow>{copy.dashboard.afkControl}</SectionEyebrow>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">{copy.dashboard.afkTitle}</h2>
            <p className="mt-1 text-sm text-slate-300/72">
              {copy.dashboard.executionProgress} {formatPercentValue(taskProgressPercent / 100, locale)}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <DataPill label={copy.dashboard.cycle} value={formatClock(taskDuration)} />
            <DataPill
              label={copy.dashboard.currentRound}
              value={`${formatClock(taskProgress)} / ${formatClock(taskDuration)}`}
            />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3">
        <div className="rounded-[1.15rem] border border-sky-300/25 bg-[linear-gradient(180deg,rgba(56,189,248,0.1),rgba(15,23,42,0.4))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          {maps
            .filter((map) => map.key === selectedMapKey)
            .map((map) => (
              <div key={map.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{localizeMapLabel(map.key, map.label, locale)}</p>
                    <p className="mt-1 text-sm text-slate-300/72">{copy.dashboard.executionProgress} {formatPercentValue(taskProgressPercent / 100, locale)}</p>
                  </div>
                  <button
                    className="min-h-11 rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300 transition hover:border-sky-200/30 hover:text-white"
                    onClick={() => selectMap(map.key)}
                    type="button"
                  >
                    {copy.dashboard.currentMapButton}
                  </button>
                </div>
                <div className="mt-3">
                  <TopStatusBar
                    className="border-none bg-transparent p-0"
                    label={copy.dashboard.executionProgress}
                    tone="from-sky-400 via-cyan-300 to-emerald-300"
                    value={taskProgressPercent}
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <InlineStat label={copy.dashboard.status} value={snapshot.afk.status === "active" ? messages.common.active : messages.common.idle} />
                  <InlineStat label={copy.dashboard.remaining} value={formatDuration(Math.max(0, taskDuration - taskProgress))} />
                  <InlineStat label={copy.dashboard.executed} value={formatDuration(taskProgress)} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <InlineStat label={copy.dashboard.roundGold} value={formatNumber(currentTaskReward.gold, locale)} />
                  <InlineStat label={copy.dashboard.roundAether} value={formatNumber(currentTaskReward.aetherCrystal, locale)} />
                  <InlineStat label={copy.dashboard.roundExp} value={formatNumber(currentTaskReward.exp, locale)} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <DataPill label={copy.dashboard.goldPerMinute} value={formatDecimal(map.goldPerMinute, locale)} />
                  <DataPill label={copy.dashboard.aetherPerMinute} value={formatDecimal(map.aetherPerMinute, locale)} />
                  <DataPill label={copy.dashboard.expPerMinute} value={formatDecimal(map.expPerMinute, locale)} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <CommandButton
                    disabled={snapshot.afk.status === "active" || status === "saving" || !isRealtimeReady}
                    onClick={() => {
                      void startAfk().catch(() => {});
                    }}
                    tone="primary"
                  >
                    {status === "saving" && snapshot.afk.status === "idle" ? messages.common.submit : copy.dashboard.startAfk}
                  </CommandButton>
                  <CommandButton
                    disabled={snapshot.afk.status === "idle" || status === "saving" || !isRealtimeReady || Boolean(activeBattle)}
                    onClick={() => {
                      void stopAfk().catch(() => {});
                    }}
                    tone="danger"
                  >
                    {status === "saving" && snapshot.afk.status === "active" ? messages.common.submit : copy.dashboard.stopAfk}
                  </CommandButton>
                </div>
              </div>
            ))}
        </div>
      </div>
    </SectionCard>
  );
}

function MainDashboard() {
  const { locale, messages } = useI18n();
  const copy = messages.game;
  const {
    activePanel,
    buyMarketListing,
    createMarketListing,
    dropBackpackItem,
    deleteAccountRole,
    dismissError,
    configureSkillLoadout,
    equipBackpackItem,
    error,
    registerAccount,
    isRealtimeReady,
    learnSkillBook,
    selectedMapKey,
    selectMap,
    setActivePanel,
    snapshot,
    startAfk,
    status,
    stopAfk,
    unequipBackpackItem,
  } = useGameSession();
  const [displayNow, setDisplayNow] = useState(() => Date.now());
  const [itemActionBackpackId, setItemActionBackpackId] = useState<string | null>(null);
  const [marketSellBackpackId, setMarketSellBackpackId] = useState<string | null>(null);
  const [marketSellPrice, setMarketSellPrice] = useState("");
  const [marketSellQuantity, setMarketSellQuantity] = useState("1");
  const [pendingMarketPurchaseListingId, setPendingMarketPurchaseListingId] = useState<string | null>(null);
  const [pendingItemAction, setPendingItemAction] = useState<PendingItemAction>(null);
  const [showDeleteRoleConfirm, setShowDeleteRoleConfirm] = useState(false);
  const [showRegisterAccountModal, setShowRegisterAccountModal] = useState(false);
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [selectedBackpackId, setSelectedBackpackId] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<{
    id: string;
    message: string;
    tone: "danger" | "success";
  } | null>(null);
  const role = snapshot?.role;
  const backpack = snapshot?.backpack ?? EMPTY_BACKPACK;
  const maps = snapshot?.config.maps ?? [];
  const equippedItems = useMemo(
    () => backpack.filter((item) => item.equipped),
    [backpack],
  );

  useEffect(() => {
    if (backpack.length === 0) {
      setSelectedBackpackId(null);
      setItemActionBackpackId(null);
      setPendingItemAction(null);
      return;
    }

    if (selectedBackpackId && backpack.some((item) => item.backpackId === selectedBackpackId)) {
      return;
    }

    setSelectedBackpackId(equippedItems[0]?.backpackId ?? backpack[0]?.backpackId ?? null);
  }, [backpack, equippedItems, selectedBackpackId]);

  useEffect(() => {
    if (itemActionBackpackId && !backpack.some((item) => item.backpackId === itemActionBackpackId)) {
      setItemActionBackpackId(null);
    }

    if (marketSellBackpackId && !backpack.some((item) => item.backpackId === marketSellBackpackId)) {
      setMarketSellBackpackId(null);
    }

    if (pendingItemAction && !backpack.some((item) => item.backpackId === pendingItemAction.backpackId)) {
      setPendingItemAction(null);
    }
  }, [backpack, itemActionBackpackId, marketSellBackpackId, pendingItemAction]);

  useEffect(() => {
    if (pendingMarketPurchaseListingId && !snapshot?.market.listings.some((listing) => listing.listingId === pendingMarketPurchaseListingId)) {
      setPendingMarketPurchaseListingId(null);
    }
  }, [pendingMarketPurchaseListingId, snapshot]);

  useEffect(() => {
    if (!snapshot?.role || snapshot.afk.status !== "active" || snapshot.afk.battle?.active) {
      return;
    }

    const timer = window.setInterval(() => {
      setDisplayNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [snapshot?.afk.battle?.active, snapshot?.afk.status, snapshot?.role]);

  useEffect(() => {
    setDisplayNow(Date.now());
  }, [
    snapshot?.afk.accruedSeconds,
    snapshot?.afk.battle?.active,
    snapshot?.afk.lastSettledAt,
    snapshot?.afk.startedAt,
    snapshot?.afk.status,
    snapshot?.afk.taskDurationSeconds,
    snapshot?.role?.roleId,
  ]);

  const actionItem = backpack.find((item) => item.backpackId === itemActionBackpackId);
  const marketSellItem = backpack.find((item) => item.backpackId === marketSellBackpackId);
  const marketListings = snapshot?.market.listings ?? [];
  const marketSellableQuantity = marketSellItem
    ? Math.max(0, marketSellItem.quantity - (marketSellItem.equippedCount ?? 0))
    : 0;
  const marketReferenceListing = marketSellItem
    ? marketListings.find((listing) => listing.itemId === marketSellItem.itemId) ?? null
    : null;
  const marketReferencePrice = marketReferenceListing?.price ?? null;
  const marketSellPriceValue = Number(marketSellPrice || 0);
  const marketPriceDelta = marketReferencePrice === null ? 0 : marketSellPriceValue - marketReferencePrice;
  const pendingMarketPurchase = snapshot?.market.listings.find((listing) => listing.listingId === pendingMarketPurchaseListingId) ?? null;
  const pendingActionItem = pendingItemAction
    ? backpack.find((item) => item.backpackId === pendingItemAction.backpackId)
    : undefined;
  const pendingActionDefinition = pendingItemAction
    ? getItemActionDefinition(pendingItemAction.actionKey, messages)
    : null;
  const isAccountUser = snapshot?.account.mode === "account";
  const isGuestUser = snapshot?.account.mode === "guest";
  const isRealtimeActionDisabled = status === "saving" || !isRealtimeReady;
  const progressCopy = role ? formatPercent(role.currentLevelExp, role.nextLevelExp, messages) : "0%";
  const taskDuration = snapshot?.afk.taskDurationSeconds ?? 0;
  const activeBattle = snapshot?.afk.battle?.active ? snapshot.afk.battle : null;
  const taskProgress = (() => {
    const baseProgress = Math.max(0, snapshot?.afk.accruedSeconds ?? 0);

    if (snapshot?.afk.status !== "active" || !snapshot?.role || activeBattle) {
      return baseProgress;
    }

    const serverTime = snapshot.serverTime ?? displayNow;
    const elapsedSeconds = Math.max(0, Math.floor((displayNow - serverTime) / 1000));
    return Math.min(taskDuration, baseProgress + elapsedSeconds);
  })();
  const taskProgressPercent = taskDuration > 0 ? (taskProgress / taskDuration) * 100 : 0;
  const currentTaskReward = snapshot?.afk.currentMap
    ? {
      aetherCrystal: Math.floor((snapshot.afk.currentMap.aetherPerMinute * taskDuration) / 60),
      exp: Math.floor((snapshot.afk.currentMap.expPerMinute * taskDuration) / 60),
      gold: Math.floor((snapshot.afk.currentMap.goldPerMinute * taskDuration) / 60),
    }
    : { aetherCrystal: 0, exp: 0, gold: 0 };

  const pushNotice = useCallback((message: string, tone: "danger" | "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setUiNotice({ id, message, tone });
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    pushNotice(error, "danger");
  }, [error, pushNotice]);

  useEffect(() => {
    if (!uiNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setUiNotice((current) => (current?.id === uiNotice.id ? null : current));
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [uiNotice]);

  if (!snapshot || !role) {
    return null;
  }

  const menuItems: Array<{ key: PanelKey; label: string; count?: string }> = [
    { key: "afk", label: copy.dashboard.menu.afk.label, count: activeBattle ? messages.common.fighting : snapshot.afk.status === "active" ? copy.dashboard.menu.afk.running : messages.common.idle },
    { key: "backpack", label: copy.dashboard.menu.backpack.label, count: String(backpack.length) },
    { key: "market", label: copy.dashboard.menu.market.label, count: String(snapshot.market.listings.length) },
    { key: "role", label: copy.dashboard.menu.role.label, count: `${messages.common.levelShort}${role.level}` },
  ];

  const handleSelectBackpackItem = (backpackId: string) => {
    const isSameItem = selectedBackpackId === backpackId;

    if (isSameItem) {
      setPendingItemAction(null);
      setItemActionBackpackId(backpackId);
      return;
    }

    setPendingItemAction(null);
    setItemActionBackpackId(null);
    setSelectedBackpackId(backpackId);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#334293_0%,#111630_30%,#050717_100%)] px-3 py-3 text-slate-100 md:px-4 md:py-4 xl:h-screen xl:overflow-hidden">
      {uiNotice ? (
        <div
          className={[
            "fixed right-4 top-4 z-50 w-[min(94vw,28rem)] rounded-[1rem] border px-4 py-3 text-sm shadow-[0_18px_55px_rgba(0,0,0,0.42)] backdrop-blur-xl",
            uiNotice.tone === "danger"
              ? "border-rose-300/35 bg-rose-500/22 text-rose-50"
              : "border-emerald-300/35 bg-emerald-500/22 text-emerald-50",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1 leading-6">{uiNotice.message}</span>
            <button
              className="shrink-0 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs"
              onClick={() => {
                setUiNotice(null);
                dismissError();
              }}
              type="button"
            >
              {messages.common.close}
            </button>
          </div>
        </div>
      ) : null}

      {showRegisterAccountModal && snapshot ? (
        <OverlayModal>
          <SectionEyebrow>{copy.dashboard.bindAccount}</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">{copy.dashboard.registerTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {formatMessage(copy.dashboard.registerSummary, { roleName: role.name })}
          </p>
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              void registerAccount({
                confirmPassword: registerConfirmPassword,
                password: registerPassword,
                username: registerUsername,
              }).then(() => {
                setShowRegisterAccountModal(false);
                setRegisterUsername("");
                setRegisterPassword("");
                setRegisterConfirmPassword("");
              }).catch(() => {});
            }}
          >
            <label className="mt-6 block">
              <span className="text-sm font-medium text-emerald-100">{copy.landing.username}</span>
              <input
                className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                onChange={(event) => setRegisterUsername(event.target.value)}
                placeholder={copy.dashboard.registerUsernamePlaceholder}
                value={registerUsername}
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-emerald-100">{copy.landing.password}</span>
              <input
                className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder={copy.dashboard.registerPasswordPlaceholder}
                type="password"
                value={registerPassword}
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-emerald-100">{copy.dashboard.registerConfirmPassword}</span>
              <input
                className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                placeholder={copy.dashboard.registerConfirmPasswordPlaceholder}
                type="password"
                value={registerConfirmPassword}
              />
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-[1rem] bg-[linear-gradient(90deg,#34d399_0%,#60a5fa_100%)] px-4 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  status === "saving"
                  || !registerUsername.trim()
                  || !registerPassword
                  || !registerConfirmPassword
                }
                type="submit"
              >
                {status === "saving" ? messages.common.submit : copy.dashboard.registerSubmit}
              </button>
              <button
                className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
                disabled={status === "saving"}
                onClick={() => {
                  setShowRegisterAccountModal(false);
                }}
                type="button"
              >
                {messages.common.cancel}
              </button>
            </div>
          </form>
        </OverlayModal>
      ) : null}

      {showDeleteRoleConfirm && snapshot ? (
        <OverlayModal>
          <SectionEyebrow>{copy.dashboard.deleteRole}</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">{copy.dashboard.deleteRoleTitle}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {formatMessage(copy.dashboard.deleteRoleSummary, {
              roleName: role.name,
              username: snapshot.account.username ?? messages.common.boundAccount,
            })}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-[1rem] bg-rose-500 px-4 py-4 text-base font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "saving"}
              onClick={() => {
                void deleteAccountRole().then(() => {
                  setShowDeleteRoleConfirm(false);
                }).catch(() => {});
              }}
              type="button"
            >
              {status === "saving" ? copy.dashboard.deleteRoleLoading : copy.dashboard.deleteRoleSubmit}
            </button>
            <button
              className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              disabled={status === "saving"}
              onClick={() => setShowDeleteRoleConfirm(false)}
              type="button"
            >
              {copy.dashboard.deleteRoleCancel}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {actionItem ? (
        <OverlayModal>
          <SectionEyebrow>{copy.dashboard.itemActions}</SectionEyebrow>
          <div className="mt-4 flex items-start gap-3 sm:gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1rem] border text-3xl font-semibold sm:h-[4.5rem] sm:w-[4.5rem] ${itemAccent(actionItem.rarity)}`}>
              {(() => {
                const ActionItemIcon = getGameIconByKey(
                  actionItem.iconKey,
                  getItemTypeFallbackIconKey(actionItem.itemType),
                );
                return <ActionItemIcon className="h-8 w-8" />;
              })()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-8 text-white sm:text-2xl">{localizeItemName(actionItem.itemId, actionItem.name, locale)}</h2>
              <p className="mt-2 text-xs leading-6 text-slate-300 sm:text-sm">
                {formatMessage(copy.dashboard.actionItemMeta, {
                  equippedCount: actionItem.equippedCount ?? 0,
                  itemType: itemTypeLabel(actionItem.itemType, messages),
                  quantity: actionItem.quantity,
                  rarity: rarityLabel(actionItem.rarity, messages),
                  slot: slotLabel(actionItem.slot, messages),
                })}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{localizeItemDescription(actionItem.itemId, actionItem.description, locale)}</p>
              <p className="mt-2 text-xs leading-6 text-sky-100/75">{formatStatsSummary(actionItem.stats, locale, messages)}</p>
              {actionItem.itemType === "equipment" ? (
                <p className="mt-2 text-xs leading-6 text-slate-400">{formatMessage(copy.dashboard.occupiedSlots, { slots: formatEquippedGroupSummary(actionItem.equippedSlotGroups, messages) })}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
            {getAvailableItemActions(actionItem, messages).map((action) => (
              <button
                key={action.actionKey}
                className={[
                  "w-full rounded-[1rem] border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  action.tone === "danger"
                    ? "border-rose-300/30 bg-rose-300/10 text-rose-100 hover:bg-rose-300/18"
                    : "border-white/10 bg-white/[0.04] text-white hover:border-sky-200/25",
                ].join(" ")}
                disabled={isRealtimeActionDisabled}
                onClick={() => {
                  if (action.actionKey === "learn") {
                    setItemActionBackpackId(null);
                    setPendingItemAction({
                      actionKey: action.actionKey,
                      backpackId: actionItem.backpackId,
                    });
                    return;
                  }

                  if (action.actionKey === "equip") {
                    void equipBackpackItem(actionItem.backpackId).then(() => {
                      setItemActionBackpackId(null);
                    }).catch(() => {});
                    return;
                  }

                  if (action.actionKey === "unequip") {
                    void unequipBackpackItem(actionItem.backpackId).then(() => {
                      setItemActionBackpackId(null);
                    }).catch(() => {});
                    return;
                  }

                if (action.actionKey === "sell") {
                  setItemActionBackpackId(null);
                  setMarketSellBackpackId(actionItem.backpackId);
                    const currentMarketPrice =
                      snapshot.market.listings.find((listing) => listing.itemId === actionItem.itemId)?.price
                      ?? null;
                    setMarketSellPrice(currentMarketPrice ? String(currentMarketPrice) : "");
                    setMarketSellQuantity("1");
                    return;
                  }

                  setItemActionBackpackId(null);
                  setPendingItemAction({
                    actionKey: action.actionKey,
                    backpackId: actionItem.backpackId,
                  });
                }}
                type="button"
              >
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-current/75">{action.summary}</p>
              </button>
            ))}
            <button
              className="w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200"
              onClick={() => setItemActionBackpackId(null)}
              type="button"
            >
              {copy.dashboard.actionClose}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {pendingActionItem && pendingActionDefinition && (pendingItemAction?.actionKey === "drop" || pendingItemAction?.actionKey === "learn") ? (
        <OverlayModal>
          <SectionEyebrow>{copy.dashboard.confirmAction}</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
            {pendingActionDefinition.confirmTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {formatMessage(copy.dashboard.pendingActionSummary, {
              extra: pendingActionDefinition.confirmCopy,
              itemName: localizeItemName(pendingActionItem.itemId, pendingActionItem.name, locale),
              quantity: pendingActionItem.quantity,
            })}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <DataPill label={messages.common.type} value={itemTypeLabel(pendingActionItem.itemType, messages)} />
            <DataPill label={messages.common.rarity} value={rarityLabel(pendingActionItem.rarity, messages)} />
            <DataPill label={messages.common.sellPrice} value={formatNumber(pendingActionItem.sellPrice, locale)} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className={[
                "flex-1 rounded-[1rem] px-4 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50",
                pendingActionDefinition.tone === "danger"
                  ? "bg-rose-500 hover:bg-rose-400"
                  : "bg-sky-500 hover:bg-sky-400",
              ].join(" ")}
              disabled={isRealtimeActionDisabled}
              onClick={() => {
                if (pendingItemAction?.actionKey === "drop") {
                  void dropBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => {});
                }

                if (pendingItemAction?.actionKey === "learn") {
                  void learnSkillBook(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => {});
                }

                if (pendingItemAction?.actionKey === "equip") {
                  void equipBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => {});
                }

                if (pendingItemAction?.actionKey === "unequip") {
                  void unequipBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => {});
                }
              }}
              type="button"
            >
              {status === "saving" ? messages.common.processing : pendingActionDefinition.confirmVerb}
            </button>
            <button
              className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              disabled={status === "saving"}
              onClick={() => {
                setPendingItemAction(null);
                setItemActionBackpackId(pendingActionItem.backpackId);
              }}
              type="button"
            >
              {copy.dashboard.pendingActionBack}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {marketSellItem ? (
        <OverlayModal>
          <SectionEyebrow>{copy.market.sellTitle}</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">{localizeItemName(marketSellItem.itemId, marketSellItem.name, locale)}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {formatMessage(copy.market.sellSummary, {
              feeRate: snapshot.market.feeRatePercent,
              itemName: localizeItemName(marketSellItem.itemId, marketSellItem.name, locale),
            })}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DataPill label={messages.common.rarity} value={rarityLabel(marketSellItem.rarity, messages)} />
            <DataPill label={messages.common.slot} value={slotLabel(marketSellItem.slot, messages)} />
            <DataPill label={copy.market.sellableQuantity} value={formatNumber(marketSellableQuantity, locale)} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-amber-100">{copy.market.sellPriceLabel}</span>
              <input
                className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-amber-300"
                inputMode="numeric"
                onChange={(event) => setMarketSellPrice(event.target.value.replace(/[^\d]/g, ""))}
                placeholder={marketReferencePrice === null ? copy.market.sellPricePlaceholderEmpty : copy.market.sellPricePlaceholder}
                value={marketSellPrice}
              />
              <p className="mt-2 text-xs leading-6 text-slate-400">
                {marketReferencePrice === null
                  ? copy.market.noMarketQuote
                  : marketSellPriceValue <= 0
                    ? formatMessage(copy.market.marketReference, { price: formatNumber(marketReferencePrice, locale) })
                    : marketPriceDelta === 0
                      ? formatMessage(copy.market.sameAsMarket, { price: formatNumber(marketReferencePrice, locale) })
                      : marketPriceDelta > 0
                        ? formatMessage(copy.market.aboveMarket, {
                          delta: formatNumber(Math.abs(marketPriceDelta), locale),
                          price: formatNumber(marketReferencePrice, locale),
                        })
                        : formatMessage(copy.market.belowMarket, {
                          delta: formatNumber(Math.abs(marketPriceDelta), locale),
                          price: formatNumber(marketReferencePrice, locale),
                        })}
              </p>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-amber-100">{copy.market.sellQuantityLabel}</span>
              <input
                className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-amber-300"
                inputMode="numeric"
                onChange={(event) => setMarketSellQuantity(event.target.value.replace(/[^\d]/g, ""))}
                placeholder={copy.market.sellQuantityPlaceholder}
                value={marketSellQuantity}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs leading-6 text-slate-400">
                  {formatMessage(copy.market.sellQuantityHint, { quantity: formatNumber(marketSellableQuantity, locale) })}
                </p>
                <button
                  className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-300/18"
                  onClick={() => setMarketSellQuantity(String(marketSellableQuantity))}
                  type="button"
                >
                  {copy.market.sellAll}
                </button>
              </div>
            </label>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DataPill label={messages.common.sellPrice} value={formatNumber(marketSellItem.sellPrice, locale)} />
            <DataPill label={copy.market.feePreview} value={formatNumber(Math.floor((Number(marketSellPrice || 0) * snapshot.market.feeRatePercent) / 100), locale)} />
            <DataPill label={copy.market.receivePreview} value={formatNumber(Math.max(0, Number(marketSellPrice || 0) - Math.floor((Number(marketSellPrice || 0) * snapshot.market.feeRatePercent) / 100)), locale)} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-[1rem] bg-amber-400 px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                isRealtimeActionDisabled
                || !marketSellItem
                || Number(marketSellPrice) <= 0
                || Number(marketSellQuantity) <= 0
                || Number(marketSellQuantity) > marketSellableQuantity
              }
              onClick={() => {
                void createMarketListing(marketSellItem.backpackId, Number(marketSellPrice), Number(marketSellQuantity)).then(() => {
                  pushNotice("上架成功。", "success");
                  setMarketSellBackpackId(null);
                  setMarketSellPrice("");
                  setMarketSellQuantity("1");
                }).catch(() => {});
              }}
              type="button"
            >
              {copy.market.confirmSell}
            </button>
            <button
              className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              onClick={() => {
                setMarketSellBackpackId(null);
                setMarketSellPrice("");
                setMarketSellQuantity("1");
              }}
              type="button"
            >
              {messages.common.cancel}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {pendingMarketPurchase ? (
        <OverlayModal>
          <SectionEyebrow>{copy.market.buyTitle}</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">{localizeItemName(pendingMarketPurchase.itemId, pendingMarketPurchase.name, locale)}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            {formatMessage(copy.market.buySummary, {
              price: formatNumber(pendingMarketPurchase.price, locale),
              sellerName: pendingMarketPurchase.sellerName,
            })}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DataPill label={copy.market.lowestPrice} value={formatNumber(pendingMarketPurchase.price, locale)} />
            <DataPill label={copy.market.availableCount} value={formatNumber(pendingMarketPurchase.availableCount, locale)} />
            <DataPill label={copy.market.feeRule} value={`${snapshot.market.feeRatePercent}%`} />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-[1rem] bg-emerald-400 px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRealtimeActionDisabled}
              onClick={() => {
                void buyMarketListing(pendingMarketPurchase.listingId).then(() => {
                  setPendingMarketPurchaseListingId(null);
                }).catch(() => {});
              }}
              type="button"
            >
              {copy.market.confirmBuy}
            </button>
            <button
              className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              onClick={() => setPendingMarketPurchaseListingId(null)}
              type="button"
            >
              {messages.common.cancel}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      <div className="mx-auto flex max-w-[1760px] flex-col gap-3 xl:h-full xl:overflow-hidden">
        <SectionCard className="overflow-hidden border-white/6 bg-[linear-gradient(135deg,rgba(59,79,170,0.92),rgba(17,25,58,0.98)_52%,rgba(7,10,23,0.98))]">
          <div className="relative px-4 py-4 md:px-5 md:py-5">
            <div className="pointer-events-none absolute inset-y-0 right-[-10%] hidden w-[38%] bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.22),transparent_60%)] xl:block" />
            <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionEyebrow>{copy.dashboard.overview}</SectionEyebrow>
                  <StatusChip tone={activeBattle ? "warning" : snapshot.afk.status === "active" ? "emerald" : "neutral"}>
                    {activeBattle ? messages.common.fighting : snapshot.afk.status === "active" ? copy.dashboard.menu.afk.running : messages.common.idle}
                  </StatusChip>
                  <StatusChip tone="sky">
                    {messages.common.levelShort}{role.level}
                  </StatusChip>
                </div>

                <div className="mt-4 flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] text-lg font-semibold text-sky-100 shadow-[0_12px_30px_rgba(8,47,73,0.28)]">
                    {role.avatarSeed}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-[1.65rem] font-semibold leading-none tracking-[-0.05em] text-white md:text-[2rem]">
                      {role.name}
                    </h1>
                    <p className="mt-2 text-sm text-slate-200/80">
                      {localizeRaceLabel(role.raceKey, snapshot.config.races.find((item) => item.key === role.raceKey)?.label ?? role.raceKey, locale)}
                      {" · "}
                      {localizeClassLabel(role.classKey, snapshot.config.classes.find((item) => item.key === role.classKey)?.label ?? role.classKey, locale)}
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/68">
                      {activeBattle
                        ? `${copy.dashboard.battleTitle} · ${copy.dashboard.battleStatus} ${messages.common.fighting}`
                        : snapshot.afk.status === "active"
                          ? `${copy.dashboard.executionProgress} ${formatPercentValue(taskProgressPercent / 100, locale)} · ${copy.dashboard.remaining} ${formatDuration(Math.max(0, taskDuration - taskProgress))}`
                          : copy.dashboard.settlementSummary}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <OverviewMetricCard
                    detail={copy.dashboard.pendingGold}
                    label={copy.dashboard.gold}
                    tone="amber"
                    value={formatNumber(role.gold, locale)}
                  />
                  <OverviewMetricCard
                    detail={copy.dashboard.pendingAether}
                    label={copy.dashboard.aetherCrystal}
                    tone="sky"
                    value={formatNumber(role.aetherCrystal, locale)}
                  />
                  <OverviewMetricCard
                    detail={copy.dashboard.levelProgress}
                    label={copy.dashboard.exp}
                    tone="emerald"
                    value={formatNumber(role.exp, locale)}
                  />
                  <OverviewMetricCard
                    detail={isAccountUser ? copy.dashboard.bound : messages.common.guest}
                    label={copy.dashboard.accountStatus}
                    tone="neutral"
                    value={isAccountUser ? (snapshot.account.username ?? copy.dashboard.bound) : messages.common.guest}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {isGuestUser ? (
                    <CommandButton
                      disabled={status === "saving"}
                      onClick={() => setShowRegisterAccountModal(true)}
                      tone="secondary"
                    >
                      {copy.dashboard.registerAccount}
                    </CommandButton>
                  ) : null}
                  {isAccountUser ? (
                    <CommandButton
                      disabled={status === "saving"}
                      onClick={() => setShowDeleteRoleConfirm(true)}
                      tone="danger"
                    >
                      {copy.dashboard.deleteRole}
                    </CommandButton>
                  ) : null}
                  <CommandButton
                    disabled={status === "saving"}
                    onClick={() => {
                      setActivePanel("afk");
                    }}
                    tone="neutral"
                  >
                    {copy.dashboard.afkControl}
                  </CommandButton>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[208px_minmax(0,1fr)]">
          <MobileDashboardCollapse
            defaultOpen={false}
            title="功能导航"
          >
            <SectionCard className="p-3 xl:min-h-0">
              <div className="mb-3 hidden xl:block">
                <SectionEyebrow>Control Rail</SectionEyebrow>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {menuItems.map((item) => (
                  <RailButton
                    key={item.key}
                    active={activePanel === item.key}
                    count={item.count}
                    label={item.label}
                    onClick={() => setActivePanel(item.key)}
                  />
                ))}
              </div>
            </SectionCard>
          </MobileDashboardCollapse>

          <MobileDashboardCollapse
            title="主面板"
          >
            <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-rows-[minmax(0,1fr)_220px]">
              <CenterPanel
                activePanel={activePanel}
                backpack={backpack}
                isRealtimeReady={isRealtimeReady}
                currentTaskReward={currentTaskReward}
                maps={maps}
                onRequestBuyMarketListing={(listingId) => {
                  setPendingMarketPurchaseListingId(listingId);
                }}
                onConfigureSkillLoadout={(skillKey, action) => {
                  void configureSkillLoadout(skillKey, action).then(() => {
                    pushNotice(action === "equip" ? "技能携带成功。" : "技能已卸下。", "success");
                  }).catch(() => {});
                }}
                onUnequipItem={(backpackId) => {
                  void unequipBackpackItem(backpackId).catch(() => {});
                }}
                onSelectItem={handleSelectBackpackItem}
                role={role}
                selectedBackpackId={selectedBackpackId}
                selectedMapKey={selectedMapKey}
                selectMap={selectMap}
                snapshot={snapshot}
                startAfk={startAfk}
                status={status}
                stopAfk={stopAfk}
                taskDuration={taskDuration}
                taskProgress={taskProgress}
                taskProgressPercent={taskProgressPercent}
              />
              <MobileDashboardCollapse
                defaultOpen={false}
                title="聊天与事件"
              >
                <Chat />
              </MobileDashboardCollapse>
            </div>
          </MobileDashboardCollapse>
        </div>

        <div className="rounded-[0.95rem] border border-white/6 bg-slate-950/45 px-4 py-2.5">
          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            <span>{copy.dashboard.levelBar}</span>
            <span>{copy.dashboard.levelProgress} {progressCopy}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-300/65 via-cyan-300/60 to-sky-400/70 transition-[width] duration-500 ease-out"
              style={{ width: `${role.nextLevelExp > 0 ? Math.max(0, Math.min(100, (role.currentLevelExp / role.nextLevelExp) * 100)) : 100}%` }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function GameDashboard() {
  const { snapshot } = useGameSession();

  if (!snapshot) {
    return <LandingView />;
  }

  if (!snapshot.role) {
    return <CreateRoleView />;
  }

  return <MainDashboard />;
}
