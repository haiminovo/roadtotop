'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Chat from "@/components/chat";
import { getMaxHealth, type ActivityConfig, type ActivityKey, type BodySlotType, type ClassKey, type MapConfig, type MapKey, type PanelKey, type RaceKey } from "@/lib/game-config";
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
import {
  GiCardExchange,
  GiCash,
  GiCrossedSwords,
  GiDoorway,
  GiKeyring,
  GiKnapsack,
  GiPathDistance,
  GiServerRack,
  GiShop,
  GiCharacter,
} from "react-icons/gi";

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
    white: "border-slate-700/60 bg-[#0d1117]",
    green: "border-emerald-800/50 bg-emerald-950/20",
    blue: "border-sky-800/50 bg-sky-950/20",
    purple: "border-fuchsia-800/50 bg-fuchsia-950/20",
    orange: "border-amber-800/50 bg-amber-950/20",
  }[rarity] ?? "border-slate-700/60 bg-[#0d1117]";
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
        "rounded-lg border border-[#30363d] bg-[#161b22] shadow-[0_0_20px_rgba(0,0,0,0.2)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{children}</p>;
}

function OverlayModal({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/75 backdrop-blur-sm px-2 py-2 sm:px-4 sm:py-4">
      <div className="mx-auto flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#161b22] shadow-[0_0_60px_rgba(0,0,0,0.5)] sm:max-h-[calc(100dvh-2rem)]">
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function TopStatusBar({
  barClassName = "h-3",
  className = "",
  label,
  labelClassName = "text-slate-400",
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
    <div className={["rounded-md border border-[#30363d] bg-[#0d1117] p-3", className].join(" ")}>
      <div className={`mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] ${labelClassName}`}>
        <span>{label}</span>
        <span>{valueLabel ?? `${Math.max(0, Math.floor(safeValue))}%`}</span>
      </div>
      <div className={`${barClassName} progress-shine overflow-hidden rounded-full bg-[#21262d]`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${tone}`}
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
        "min-w-0 rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5",
        className,
      ].join(" ")}
    >
      <p className={["text-[10px] uppercase tracking-[0.16em] text-slate-500", labelClassName].join(" ")}>{label}</p>
      <p className={["mt-0.5 break-words text-sm font-medium leading-5 text-slate-200 sm:truncate", valueClassName].join(" ")}>{value}</p>
    </div>
  );
}

function InlineStat({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={["flex items-center justify-between gap-2 rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5", className].join(" ")}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  );
}

function CompactStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1">
      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-200 sm:text-sm">{value}</span>
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
    danger: "border-rose-900 bg-rose-900/20 text-rose-300",
    emerald: "border-emerald-900 bg-emerald-900/20 text-emerald-300",
    neutral: "border-[#30363d] bg-[#21262d] text-slate-300",
    sky: "border-sky-900 bg-sky-900/20 text-sky-300",
    warning: "border-amber-900 bg-amber-900/20 text-amber-300",
  }[tone];

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${toneClassName}`}>
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
    danger: "border-rose-800/60 bg-rose-900/20 text-rose-300 hover:bg-rose-900/40 hover:text-rose-200",
    neutral: "border-[#30363d] bg-[#21262d] text-slate-200 hover:bg-[#30363d]",
    primary: "border-emerald-800/60 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/40 hover:text-emerald-200",
    secondary: "border-[#1f6feb]/40 bg-[#1f6feb]/10 text-[#58a6ff] hover:bg-[#1f6feb]/20",
  }[tone];

  return (
    <button
      className={[
        "min-h-9 min-w-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 sm:px-3 sm:py-2",
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

function MetaBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "amber" | "emerald" | "neutral" | "sky" | "violet";
}) {
  const toneClassName = {
    amber: "border-amber-900 bg-amber-900/20 text-amber-300",
    emerald: "border-emerald-900 bg-emerald-900/20 text-emerald-300",
    neutral: "border-[#30363d] bg-[#21262d] text-slate-300",
    sky: "border-sky-900 bg-sky-900/20 text-sky-300",
    violet: "border-fuchsia-900 bg-fuchsia-900/20 text-fuchsia-300",
  }[tone];

  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${toneClassName}`}>
      {children}
    </span>
  );
}

type CompactDropdownOption<T extends string> = {
  label: string;
  value: T;
};

function CompactDropdown<T extends string>({
  ariaLabel,
  className = "",
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: T) => void;
  options: CompactDropdownOption<T>[];
  value: T;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className={["relative min-w-0", className].join(" ")} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:border-[#3d444d] hover:bg-[#11161d] focus-visible:border-[#58a6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/20"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <span
          aria-hidden="true"
          className={[
            "shrink-0 text-[10px] text-slate-500 transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          v
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-30 w-full min-w-[7rem] overflow-hidden rounded-md border border-[#30363d] bg-[#11161d] shadow-[0_14px_30px_rgba(0,0,0,0.28)]">
          <div aria-label={ariaLabel} className="max-h-56 overflow-y-auto p-1" role="listbox">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  aria-selected={selected}
                  className={[
                    "flex min-h-9 w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition",
                    selected
                      ? "bg-[#1f6feb]/14 text-[#8cc8ff]"
                      : "text-slate-300 hover:bg-white/6 hover:text-white",
                  ].join(" ")}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
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
    <div className={["rounded-lg border border-[#30363d] bg-[#0d1117] p-3 sm:p-4", className].join(" ")}>
      {children}
    </div>
  );
}

function SkillSlot({
  badge,
  body,
  tooltipAlign = "center",
  meta,
  status,
  toneClassName,
  title,
}: {
  badge: React.ReactNode;
  body: React.ReactNode;
  tooltipAlign?: "center" | "left" | "right";
  meta: React.ReactNode;
  status: React.ReactNode;
  title: React.ReactNode;
  toneClassName: string;
}) {
  const tooltipPositionClassName = {
    center: "left-1/2 -translate-x-1/2",
    left: "left-0 translate-x-0",
    right: "right-0 translate-x-0",
  }[tooltipAlign];

  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
  const [isTooltipReady, setIsTooltipReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;

  useEffect(() => {
    if (!isTooltipOpen) {
      setIsTooltipReady(false);
      setTooltipStyle(null);
      return;
    }

    const updateTooltipPosition = () => {
      if (!triggerRef.current || !tooltipRef.current) {
        return;
      }

      const viewportPadding = 12;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const maxWidth = Math.min(224, window.innerWidth - viewportPadding * 2);
      const nextWidth = Math.max(168, maxWidth);

      const alignedLeft = tooltipAlign === "left"
        ? triggerRect.left
        : tooltipAlign === "right"
          ? triggerRect.right - nextWidth
          : triggerRect.left + (triggerRect.width / 2) - (nextWidth / 2);
      const clampedLeft = Math.min(
        window.innerWidth - nextWidth - viewportPadding,
        Math.max(viewportPadding, alignedLeft),
      );

      const gap = 8;
      const placeAbove = triggerRect.top >= tooltipRect.height + gap + viewportPadding;
      const nextTop = placeAbove
        ? triggerRect.top - tooltipRect.height - gap
        : Math.min(window.innerHeight - tooltipRect.height - viewportPadding, triggerRect.bottom + gap);

      setTooltipStyle({
        left: clampedLeft,
        position: "fixed",
        top: Math.max(viewportPadding, nextTop),
        width: nextWidth,
      });
      setIsTooltipReady(true);
    };

    const frame = window.requestAnimationFrame(updateTooltipPosition);
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (triggerRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return;
      }

      setIsTooltipOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isTooltipOpen, tooltipAlign]);

  return (
    <div className="group relative min-w-0">
      <button
        ref={triggerRef}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition ${toneClassName}`}
        onClick={() => isTouchDevice && setIsTooltipOpen((v) => !v)}
        onMouseEnter={() => !isTouchDevice && setIsTooltipOpen(true)}
        onMouseLeave={() => !isTouchDevice && setIsTooltipOpen(false)}
        type="button"
      >
        <span className="text-[10px] font-semibold text-white">{badge}</span>
      </button>
      <div
        ref={tooltipRef}
        className={[
          "z-40 rounded-lg border border-[#30363d] bg-[#161b22] p-3 shadow-[0_14px_30px_rgba(0,0,0,0.32)] transition duration-150 ease-out",
          tooltipPositionClassName,
          isTooltipOpen && isTooltipReady ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        style={tooltipStyle ?? { position: "fixed", top: 12, left: 12, width: "min(14rem,calc(100vw-1.5rem))" }}
      >
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-[11px] text-slate-400">{meta}</p>
        <p className="mt-2 text-xs leading-6 text-slate-300">{body}</p>
        {status ? <p className="mt-1 text-[11px] text-slate-400">{status}</p> : null}
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
      <div className="flex flex-wrap gap-2 px-0.5">
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
              tooltipAlign={side === "player" ? "left" : "right"}
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
  const { messages } = useI18n();
  const copy = messages.game.dashboard;
  const effects = Array.isArray(combatant.activeEffects) ? combatant.activeEffects : [];

  if (effects.length === 0) {
    return (
      <span className="text-[10px] text-slate-600">{copy.statusBarEmpty}</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1" title={effects.map((e) => `${e.name} · ${e.summary || e.description} · 剩余 ${e.remainingTurns} 回合`).join("\n")}>
      {effects.map((effect) => {
        const isDebuff = effect.effectType.includes("down") || effect.effectType === "damage_over_time";
        return (
          <span
            key={effect.key}
            className={[
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              isDebuff
                ? "border-rose-800 bg-rose-900/30 text-rose-300"
                : "border-emerald-800 bg-emerald-900/30 text-emerald-300",
            ].join(" ")}
            title={`${effect.name} · ${effect.summary || effect.description} · 剩余 ${effect.remainingTurns} 回合`}
          >
            <span>{effect.name}</span>
            <span className="opacity-60">{effect.remainingTurns}T</span>
          </span>
        );
      })}
    </div>
  );
}

function RailButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count?: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "group flex min-h-12 w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition sm:min-h-14 sm:px-3 sm:py-2",
        active
          ? "border-sky-500/50 bg-sky-500/10 text-white glow-border-sky"
          : "border-[#30363d] bg-transparent text-slate-300 hover:border-[#484f58] hover:text-white",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {Icon ? (
        <Icon className={`h-4 w-4 shrink-0 transition sm:h-5 sm:w-5 ${active ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`} />
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
        <span className="min-w-0 truncate text-xs font-medium leading-5 sm:text-sm">{label}</span>
        {count ? (
          <span
            className={[
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] sm:px-2",
              active ? "bg-sky-500/20 text-sky-400" : "bg-[#21262d] text-slate-500",
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
        "group relative flex aspect-square flex-col overflow-hidden rounded-lg border p-1 text-left transition-all sm:p-1.5",
        itemAccent(rarity),
        active ? "ring-2 ring-sky-400/50 glow-border-sky" : "hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
      ].join(" ")}
      onClick={onClick}
      title={itemName}
      type="button"
    >
      {equippedCount > 0 ? (
        <span className="absolute right-1.5 top-1.5 rounded-full border border-emerald-800 bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-medium leading-none text-emerald-300">
          {messages.game.dashboard.equippedBadge}
        </span>
      ) : null}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <span className="flex h-[min(2.45rem,34%)] w-[min(2.45rem,34%)] items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117] text-slate-200">
          <Icon className="h-[min(1.25rem,52%)] w-[min(1.25rem,52%)]" />
        </span>
      </div>
      <span className="pointer-events-none absolute bottom-1 left-1.5 right-7 line-clamp-2 text-[9px] font-medium leading-3.5 text-slate-300/80 sm:bottom-1.5 sm:left-2 sm:right-8 sm:line-clamp-1 sm:text-[10px]">
        {itemName}
      </span>
      <span className="absolute bottom-1 right-1 rounded-full bg-[#0d1117]/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 sm:bottom-1.5 sm:right-1.5">
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
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-slate-100 sm:px-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 glow-border-sky animate-pulse-glow sm:h-20 sm:w-20">
            <GiCrossedSwords className="h-8 w-8 text-sky-400 sm:h-10 sm:w-10" />
          </div>
          <h1 className="bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Road To Top
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            网页放置冒险
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] shadow-[0_0_40px_rgba(56,189,248,0.06)]">
          {/* Tabs */}
          <div className="flex border-b border-[#30363d]">
            <button
              className={[
                "relative flex-1 py-3 text-sm font-medium transition",
                loginMode === "guest"
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
              onClick={() => setLoginMode("guest")}
              type="button"
            >
              {copy.landing.guestLogin}
              {loginMode === "guest" ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-sky-400" />
              ) : null}
            </button>
            <button
              className={[
                "relative flex-1 py-3 text-sm font-medium transition",
                loginMode === "account"
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
              onClick={() => setLoginMode("account")}
              type="button"
            >
              {copy.landing.accountLogin}
              {loginMode === "account" ? (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-emerald-400" />
              ) : null}
            </button>
          </div>

          {/* Form */}
          <div className="p-4 sm:p-5">
            {loginMode === "guest" ? (
              <button
                className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:from-sky-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status === "booting" || status === "saving"}
                onClick={() => {
                  void guestLogin();
                }}
                type="button"
              >
                <GiDoorway className="h-4 w-4" />
                {status === "booting" ? copy.landing.guestLoading : copy.landing.guestEnter}
              </button>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-400">
                    {copy.landing.username}
                  </span>
                  <input
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-600"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={copy.landing.usernamePlaceholder}
                    value={username}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-slate-400">
                    {copy.landing.password}
                  </span>
                  <input
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-600"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={copy.landing.passwordPlaceholder}
                    type="password"
                    value={password}
                  />
                </label>
                <button
                  className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:from-sky-500 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={status === "booting" || status === "saving" || !username.trim() || !password}
                  onClick={() => {
                    void accountLogin({
                      password,
                      username,
                    });
                  }}
                  type="button"
                >
                  <GiKeyring className="h-4 w-4" />
                  {status === "booting" ? copy.landing.accountChecking : copy.landing.accountEnter}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Feature tags */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-[11px] text-slate-400">
            <GiServerRack className="h-3 w-3 text-sky-500/70" />
            服务端驱动
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-[11px] text-slate-400">
            <GiCash className="h-3 w-3 text-emerald-500/70" />
            离线收益
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1.5 text-[11px] text-slate-400">
            <GiCardExchange className="h-3 w-3 text-amber-500/70" />
            装备交易
          </span>
        </div>
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
    <main className="min-h-screen bg-[#0d1117] px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard className="px-5 py-6 md:px-8 md:py-7">
          <SectionEyebrow>{copy.createRole.setup}</SectionEyebrow>
          <h1 className="mt-4 bg-gradient-to-r from-white via-sky-100 to-cyan-200 bg-clip-text text-4xl font-semibold tracking-[-0.04em] text-transparent md:text-5xl">{copy.createRole.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300/76">
            先决定种族与职业倾向，再从右侧预览你的开局构筑和基础生存能力。
          </p>

          <label className="mt-8 block">
            <span className="text-sm font-medium text-slate-300">{copy.createRole.roleName}</span>
            <input
              className="mt-3 w-full rounded-md border border-[#30363d] bg-[#0d1117] px-4 py-4 text-base text-slate-200 outline-none transition focus:border-[#484f58]"
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
                    "rounded-lg border p-4 text-left transition-all",
                    race.key === raceKey
                      ? "border-sky-500/50 bg-sky-500/10 glow-border-sky"
                      : "border-[#30363d] bg-[#0d1117] hover:border-[#484f58] hover:bg-[#11161d]",
                  ].join(" ")}
                  onClick={() => setRaceKey(race.key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const RaceIcon = raceIconByConfig(race.key, race.iconKey);
                        return (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${race.key === raceKey ? "border-sky-500/40 bg-sky-500/15" : "border-[#30363d] bg-[#0d1117]"}`}>
                            <RaceIcon className={`h-5 w-5 transition ${race.key === raceKey ? "text-sky-400" : "text-[#58a6ff]/60"}`} />
                          </div>
                        );
                      })()}
                      <p className="text-lg font-semibold text-white">{localizeRaceLabel(race.key, race.label, locale)}</p>
                    </div>
                    <MetaBadge tone="sky">
                      {race.key}
                    </MetaBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeRaceSummary(race.key, race.summary, locale)}</p>
                  <p className="mt-3 text-xs text-slate-500">
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
                    "rounded-lg border p-4 text-left transition-all",
                    roleClass.key === classKey
                      ? "border-emerald-500/50 bg-emerald-500/10 glow-border-emerald"
                      : "border-[#30363d] bg-[#0d1117] hover:border-[#484f58] hover:bg-[#11161d]",
                  ].join(" ")}
                  onClick={() => setClassKey(roleClass.key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const ClassIcon = classIconByConfig(roleClass.key, roleClass.iconKey);
                        return (
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${roleClass.key === classKey ? "border-emerald-500/40 bg-emerald-500/15" : "border-[#30363d] bg-[#0d1117]"}`}>
                            <ClassIcon className={`h-5 w-5 transition ${roleClass.key === classKey ? "text-emerald-400" : "text-emerald-300/60"}`} />
                          </div>
                        );
                      })()}
                      <p className="text-lg font-semibold text-white">{localizeClassLabel(roleClass.key, roleClass.label, locale)}</p>
                    </div>
                    <MetaBadge tone="emerald">
                      {roleClass.key}
                    </MetaBadge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeClassSummary(roleClass.key, roleClass.summary, locale)}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {statLabel("strength", messages)} {roleClass.stats.strength} · {statLabel("agility", messages)} {roleClass.stats.agility} · {statLabel("intelligence", messages)}{" "}
                    {roleClass.stats.intelligence} · {statLabel("vitality", messages)} {roleClass.stats.vitality}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard className="overflow-hidden px-5 py-6 md:px-6 md:py-7">
          <SectionEyebrow>{copy.createRole.preview}</SectionEyebrow>
          <PanelSubsection className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{copy.createRole.currentBuild}</p>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-emerald-500/10 sm:h-24 sm:w-24">
                {selectedRace ? (() => {
                  const RaceIcon = raceIconByConfig(selectedRace.key, selectedRace.iconKey);
                  return <RaceIcon className="h-10 w-10 text-sky-400 sm:h-12 sm:w-12" />;
                })() : null}
                {selectedClass ? (() => {
                  const ClassIcon = classIconByConfig(selectedClass.key, selectedClass.iconKey);
                  return <ClassIcon className="absolute -right-1.5 -bottom-1.5 h-7 w-7 rounded-lg border border-[#30363d] bg-[#161b22] p-1 text-emerald-400 sm:-right-2 sm:-bottom-2 sm:h-8 sm:w-8" />;
                })() : null}
              </div>
            </div>
            <h2 className="mt-4 text-center text-3xl font-semibold text-white">{name || copy.createRole.unnamed}</h2>
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
            className="relative mt-6 w-full overflow-hidden rounded-lg bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-5 py-4 text-base font-semibold text-white transition hover:from-sky-500 hover:via-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status === "saving" || name.trim().length < 2}
            onClick={() => {
              void createRole({ classKey, name, raceKey });
            }}
            type="button"
          >
            <span className="relative z-10">{status === "saving" ? copy.createRole.createLoading : copy.createRole.createSubmit}</span>
            {status !== "saving" && name.trim().length >= 2 ? (
              <span className="animate-shimmer absolute inset-0 z-0" />
            ) : null}
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
    <div className="space-y-3">
      {sectionOrder.map((itemType) => {
        const items = groupedItems[itemType] ?? [];

        if (items.length <= 0) {
          return null;
        }

        return (
          <div key={itemType} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-2.5 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 min-h-6 items-center gap-2">
                <p className="truncate text-[11px] uppercase leading-none tracking-[0.18em] text-slate-300/78">{itemTypeLabel(itemType, messages)}</p>
                <span className="shrink-0 text-[10px] leading-none text-slate-500">{formatNumber(items.length, locale)} {messages.common.speciesUnit}</span>
              </div>
              <MetaBadge tone={itemCategoryTone(itemType)}>{itemTypeLabel(itemType, messages)}</MetaBadge>
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 sm:gap-2 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9">
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
  activities,
  maps,
  onRequestBuyMarketListing,
  onConfigureSkillLoadout,
  onDeleteRole,
  onUnequipItem,
  onSelectItem,
  role,
  selectedBackpackId,
  selectedActivityKey,
  selectActivity,
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
  activities: ActivityConfig[];
  maps: MapConfig[];
  onRequestBuyMarketListing: (listingId: string) => void;
  onConfigureSkillLoadout: (skillKey: string, action: "equip" | "unequip") => void;
  onDeleteRole: () => void;
  onUnequipItem: (backpackId: string) => void;
  onSelectItem: (backpackId: string) => void;
  role: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["role"];
  selectedBackpackId: string | null;
  selectedActivityKey: ActivityKey;
  selectActivity: (activityKey: ActivityKey) => void;
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
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<"all" | "equipment" | "skill_book" | "material">("all");
  const [marketRarityFilter, setMarketRarityFilter] = useState<"all" | "white" | "green" | "blue" | "purple" | "orange">("all");
  const [marketSlotFilter] = useState<"all" | BodySlotType>("all");
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
  const selectedActivity = activities.find((activity) => activity.key === selectedActivityKey) ?? activities[0] ?? null;
  const selectedMap = maps.find((map) => map.key === selectedMapKey) ?? null;

  if (!role) {
    return null;
  }

  if (activePanel === "backpack") {
    const equippedBackpackCount = backpack.reduce((total, item) => total + (item.equippedCount ?? 0), 0);

    return (
      <SectionCard className="flex min-h-[22rem] flex-col overflow-hidden xl:h-full xl:min-h-0">
        <div className="border-b border-[#30363d] px-3 py-2.5 sm:px-4 sm:py-3">
          <SectionEyebrow>{copy.dashboard.inventory}</SectionEyebrow>
          <div className="mt-2 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white sm:text-xl">{copy.dashboard.backpackTitle}</h2>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              <CompactStat label={copy.dashboard.inventoryCount} value={formatNumber(backpack.length, locale)} />
              <CompactStat label={copy.dashboard.equipmentCount} value={formatNumber(equipmentCount, locale)} />
              <CompactStat label={copy.dashboard.equippedCount} value={formatNumber(equippedBackpackCount, locale)} />
              <CompactStat label={copy.dashboard.skillBookCount} value={formatNumber(skillBookCount, locale)} />
              <CompactStat label={copy.dashboard.materialCount} value={formatNumber(materialCount, locale)} />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3">
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
    const availableSkills = learnedSkills.filter((skill) => !skill.equipped);

    return (
      <SectionCard className="flex min-h-[20rem] flex-col overflow-hidden sm:min-h-[24rem] xl:h-full xl:min-h-0">
        <div className="border-b border-[#30363d] px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white sm:text-xl">{role.name}</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {race ? localizeRaceLabel(race.key, race.label, locale) : copy.createRole.noRace} · {roleClass ? localizeClassLabel(roleClass.key, roleClass.label, locale) : copy.createRole.noClass} · Lv.{role.level}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {race ? (() => {
                const RaceIcon = raceIconByConfig(race.key, race.iconKey);
                return <RaceIcon className="h-4 w-4 text-[#58a6ff]" />;
              })() : null}
              {roleClass ? (() => {
                const ClassIcon = classIconByConfig(roleClass.key, roleClass.iconKey);
                return <ClassIcon className="h-4 w-4 text-emerald-300" />;
              })() : null}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-2.5 sm:gap-3 sm:p-3 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
          <PanelSubsection className="bg-[#0d1117]">
            <div className="flex items-center gap-3">
              <TopStatusBar
                className="flex-1 border-none bg-transparent p-0"
                label={copy.dashboard.currentHealth}
                labelClassName="text-slate-500"
                tone="from-rose-500 via-orange-400 to-emerald-300"
                valueLabel={`${formatNumber(role.currentHealth, locale)} / ${formatNumber(role.maxHealth, locale)}`}
                value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-4">
              <InlineStat label={copy.dashboard.level} value={formatNumber(role.level, locale)} />
              <InlineStat label={statLabel("strength", messages)} value={formatNumber(role.stats.strength, locale)} />
              <InlineStat label={statLabel("agility", messages)} value={formatNumber(role.stats.agility, locale)} />
              <InlineStat label={statLabel("vitality", messages)} value={formatNumber(role.stats.vitality, locale)} />
            </div>
          </PanelSubsection>

          <PanelSubsection className="grid grid-cols-2 gap-1.5 p-2.5 min-[420px]:grid-cols-3 sm:p-3">
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-2 text-center transition hover:border-[#484f58]">
              <p className="text-[10px] text-slate-500">{statLabel("intelligence", messages)}</p>
              <p className="mt-0.5 text-sm font-semibold text-sky-300">{formatNumber(role.stats.intelligence, locale)}</p>
            </div>
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-2 text-center transition hover:border-[#484f58]">
              <p className="text-[10px] text-slate-500">{statLabel("critChance", messages)}</p>
              <p className="mt-0.5 text-sm font-semibold text-amber-300">{formatSecondaryStatPercent(role.secondaryStats.critChance, locale)}</p>
            </div>
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-2 text-center transition hover:border-[#484f58]">
              <p className="text-[10px] text-slate-500">{statLabel("critDamage", messages)}</p>
              <p className="mt-0.5 text-sm font-semibold text-orange-300">{formatSecondaryStatMultiplier(role.secondaryStats.critDamage, locale)}</p>
            </div>
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-2 text-center transition hover:border-[#484f58]">
              <p className="text-[10px] text-slate-500">{statLabel("dodgeChance", messages)}</p>
              <p className="mt-0.5 text-sm font-semibold text-cyan-300">{formatSecondaryStatPercent(role.secondaryStats.dodgeChance, locale)}</p>
            </div>
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-2 text-center transition hover:border-[#484f58]">
              <p className="text-[10px] text-slate-500">{statLabel("blockChance", messages)}</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-300">{formatSecondaryStatPercent(role.secondaryStats.blockChance, locale)}</p>
            </div>
            <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-2 text-center transition hover:border-[#484f58]">
              <p className="text-[10px] text-slate-500">{statLabel("healthRegenRate", messages)}</p>
              <p className="mt-0.5 text-sm font-semibold text-rose-300">{formatSecondaryStatPercent(role.secondaryStats.healthRegenRate, locale)}</p>
            </div>
          </PanelSubsection>

          <PanelSubsection className="md:col-span-2 xl:col-span-2">
            <div className="flex items-center justify-between">
              <SectionEyebrow>{copy.dashboard.bodySlots}</SectionEyebrow>
              <span className="text-[10px] text-slate-500">{bodySlots.filter((s) => s.item).length} / {bodySlots.length}</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 min-[420px]:grid-cols-2 sm:gap-1.5 xl:grid-cols-3">
              {bodySlots.map((slot) => (
                <div
                  key={slot.key}
                  className={[
                    "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5",
                    slot.item
                      ? marketItemCardAccent(slot.item.rarity)
                      : "border-[#30363d] bg-[#0d1117]/50",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{bodySlotKeyLabel(slot.key, messages)}</p>
                    <p className="text-xs font-medium text-slate-200">{slot.item ? localizeItemName(slot.item.itemId, slot.item.name, locale) : copy.dashboard.emptySlot}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {slot.item ? (
                      <>
                        <span className="text-[10px] text-slate-400">{rarityLabel(slot.item.rarity, messages)}</span>
                        <button
                          className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-slate-300 transition hover:border-sky-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!isRealtimeReady || status === "saving"}
                          onClick={() => onUnequipItem(slot.item!.backpackId)}
                          type="button"
                        >
                          {copy.dashboard.unequip}
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-600">{slotLabel(slot.slotType, messages)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PanelSubsection>

          <PanelSubsection className="md:col-span-2 xl:col-span-2">
            <div className="flex items-center justify-between">
              <SectionEyebrow>{copy.dashboard.skillPanelTitle}</SectionEyebrow>
              <MetaBadge tone="sky">
                {formatMessage(copy.dashboard.skillSlotsSummary, {
                  remaining: formatNumber(role.skillSlots.remaining, locale),
                  total: formatNumber(role.skillSlots.total, locale),
                  used: formatNumber(role.skillSlots.used, locale),
                })}
              </MetaBadge>
            </div>

            {equippedSkills.length > 0 && (
              <div className="mt-2">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">{copy.dashboard.equippedSkillsTitle}</p>
                <div className="grid gap-1.5 min-[420px]:grid-cols-2 xl:grid-cols-3">
                  {equippedSkills.map((skill) => (
                    <div
                      key={`equipped-${skill.key}`}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${skillQualityTone(skill.quality)}`}
                    >
                      <div className="min-w-0">
                        <p className="break-words text-xs font-semibold leading-4 text-white sm:truncate">{skill.name}</p>
                        <p className="text-[10px] text-slate-300/70">{skillCategoryLabel(skill.category, messages)} · Lv.{formatNumber(skill.level, locale)}</p>
                      </div>
                      <button
                        className="shrink-0 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!isRealtimeReady || status === "saving"}
                        onClick={() => onConfigureSkillLoadout(skill.key, "unequip")}
                        type="button"
                      >
                        {copy.dashboard.skillUnequipAction}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableSkills.length > 0 && (
              <div className="mt-2">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">{copy.dashboard.learnedSkillsTitle}</p>
                <div className="grid gap-1.5 min-[420px]:grid-cols-2 xl:grid-cols-3">
                  {availableSkills.map((skill) => (
                    <div
                      key={`learned-${skill.key}`}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${skillQualityTone(skill.quality)}`}
                    >
                      <div className="min-w-0">
                        <p className="break-words text-xs font-semibold leading-4 text-white sm:truncate">{skill.name}</p>
                        <p className="text-[10px] text-slate-300/70">{skillCategoryLabel(skill.category, messages)} · Lv.{formatNumber(skill.level, locale)}</p>
                      </div>
                      <button
                        className="shrink-0 rounded border border-[#1f6feb]/30 bg-[#1f6feb]/10 px-1.5 py-0.5 text-[10px] text-[#58a6ff] transition hover:bg-[#1f6feb]/20 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!isRealtimeReady || status === "saving" || role.skillSlots.remaining <= 0}
                        onClick={() => onConfigureSkillLoadout(skill.key, "equip")}
                        type="button"
                      >
                        {copy.dashboard.skillEquipAction}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableSkills.length === 0 && learnedSkills.length > 0 && (
              <p className="mt-2 text-sm text-slate-400">{copy.dashboard.learnedSkillsAllEquipped}</p>
            )}

            {equippedSkills.length === 0 && learnedSkills.length === 0 && (
              <p className="mt-2 text-sm text-slate-400">{copy.dashboard.equippedSkillsEmpty}</p>
            )}
          </PanelSubsection>
        </div>

        <div className="border-t border-[#30363d] px-3 py-2 sm:px-4 sm:py-2.5">
          <button
            className="w-full rounded-md border border-rose-800/60 bg-rose-900/20 px-3 py-1.5 text-xs text-rose-300/80 transition hover:bg-rose-900/40 hover:text-rose-200"
            disabled={status === "saving"}
            onClick={onDeleteRole}
            type="button"
          >
            {copy.dashboard.deleteRole}
          </button>
        </div>
      </SectionCard>
    );
  }

  if (activePanel === "market") {
    const marketCategoryOptions = [
      { label: messages.common.all, value: "all" },
      ...snapshot.market.categoryOptions.map((option) => ({ label: option.label, value: option.key })),
    ] as CompactDropdownOption<"all" | "equipment" | "skill_book" | "material">[];
    const marketRarityOptions = [
      { label: messages.common.all, value: "all" },
      ...snapshot.market.rarityOptions.map((rarity) => ({ label: rarityLabel(rarity, messages), value: rarity })),
    ] as CompactDropdownOption<"all" | "white" | "green" | "blue" | "purple" | "orange">[];
    const marketListings = snapshot.market.listings.filter((listing) => (
      (marketCategoryFilter === "all" || listing.categoryKey === marketCategoryFilter)
      && (marketRarityFilter === "all" || listing.rarity === marketRarityFilter)
      && (marketSlotFilter === "all" || listing.slot === marketSlotFilter)
    ));

    return (
      <SectionCard className="flex min-h-[20rem] flex-col overflow-hidden sm:min-h-[24rem] xl:h-full xl:min-h-0">
        <div className="border-b border-[#30363d] px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white sm:text-xl">{copy.market.title}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatNumber(marketListings.length, locale)} {messages.common.speciesUnit}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
              <CompactDropdown
                ariaLabel={copy.market.filters.category}
                className="min-w-0 sm:w-32"
                onChange={setMarketCategoryFilter}
                options={marketCategoryOptions}
                value={marketCategoryFilter}
              />
              <CompactDropdown
                ariaLabel={copy.market.filters.rarity}
                className="min-w-0 sm:w-28"
                onChange={setMarketRarityFilter}
                options={marketRarityOptions}
                value={marketRarityFilter}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          {marketListings.length > 0 ? (
            <div className="grid gap-1.5 min-[420px]:grid-cols-2 sm:gap-2 xl:grid-cols-3 2xl:grid-cols-4">
              {marketListings.map((listing) => (
                <div key={listing.listingId} className={`rounded-lg border p-2 ${marketItemCardAccent(listing.rarity)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-5 text-white sm:truncate">{localizeItemName(listing.itemId, listing.name, locale)}</p>
                      <p className="mt-0.5 break-all text-[10px] leading-4 text-slate-500 sm:truncate">{listing.sellerName}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${itemAccent(listing.rarity)}`}>
                      {formatNumber(listing.price, locale)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="text-[10px] text-slate-500">{slotLabel(listing.slot, messages)}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-400">{rarityLabel(listing.rarity, messages)}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500">x{formatNumber(listing.availableCount, locale)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-sky-100/60 sm:line-clamp-1">{formatStatsSummary(listing.stats, locale, messages)}</p>
                  <div className="mt-1.5 flex items-center justify-end gap-2">
                    <button
                      className="min-h-8 shrink-0 rounded-md border border-[#1f6feb]/30 bg-[#1f6feb]/10 px-2.5 py-1 text-[11px] font-medium text-[#58a6ff] transition hover:bg-[#1f6feb]/20 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!isRealtimeReady || status === "saving" || listing.isOwnListing}
                      onClick={() => onRequestBuyMarketListing(listing.listingId)}
                      type="button"
                    >
                      {listing.isOwnListing ? copy.market.ownListing : copy.market.buyNow}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
              {copy.market.empty}
            </div>
          )}
        </div>
      </SectionCard>
    );
  }

  if (activeBattle) {
    const isPvpBattle = activeBattle.mode === "pvp";

    return (
      <SectionCard className="flex min-h-[20rem] flex-col overflow-hidden sm:min-h-[24rem] xl:h-full xl:min-h-0">
        <div className="border-b border-[#30363d] px-3 py-2 sm:px-3.5 sm:py-2.5">
          <SectionEyebrow>{isPvpBattle ? copy.dashboard.pvpBattleTitle : copy.dashboard.battleTitle}</SectionEyebrow>
          <div className="mt-1 flex flex-col gap-2 sm:gap-2.5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-[-0.04em] text-white sm:text-[1.35rem]">{isPvpBattle ? copy.dashboard.pvpBattleTitle : copy.dashboard.battleTitle}</h2>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-5 text-slate-300/72 sm:text-xs">{isPvpBattle ? copy.dashboard.pvpBattleSummary : copy.dashboard.battleSummary}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
              <DataPill className="px-2 py-1.5 sm:px-2.5" label={copy.dashboard.battleStatus} value={battleStatusCopy} />
              <DataPill className="px-2 py-1.5 sm:px-2.5" label={copy.dashboard.battleTurns} value={formatNumber(activeBattle.turnCount, locale)} />
              <DataPill className="col-span-2 px-2 py-1.5 sm:col-span-1 sm:px-2.5" label={copy.dashboard.currentRound} value={copy.dashboard.battlePausedShort} />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
            <div className={`rounded-lg border border-[#30363d] bg-[#0d1117] p-3 sm:p-4 transition-all duration-300 border-l-[3px] border-l-emerald-500 ${isPlayerHit ? "scale-[0.985] border-l-red-500" : ""} ${isBattleTurnFlashing ? "border-[#484f58]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold leading-5 text-white sm:truncate">{activeBattle.player.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{copy.dashboard.selfInfo}</p>
                </div>
                <BattleStatusBar combatant={activeBattle.player} />
              </div>
              <div className="mt-2">
                <TopStatusBar
                  barClassName={`h-2.5 ${isPlayerHit ? "animate-pulse" : ""}`}
                  label={copy.dashboard.lifeBar}
                  labelClassName="text-slate-500"
                  tone="from-emerald-500 to-emerald-300"
                  valueLabel={`${formatNumber(activeBattle.player.currentHealth, locale)} / ${formatNumber(activeBattle.player.maxHealth, locale)}`}
                  value={(activeBattle.player.currentHealth / Math.max(1, activeBattle.player.maxHealth)) * 100}
                />
              </div>
              <div className="mt-2">
                <TopStatusBar
                  barClassName={`h-1.5 ${isPlayerPulsing ? "animate-pulse" : ""}`}
                  label={copy.dashboard.actionBar}
                  labelClassName="text-slate-500"
                  tone="from-sky-500 to-sky-300"
                  value={activeBattle.player.actionBar}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4 sm:gap-2">
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("critChance", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.player.secondaryStats.critChance, locale)}</span>
                </div>
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("dodgeChance", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.player.secondaryStats.dodgeChance, locale)}</span>
                </div>
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("blockChance", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.player.secondaryStats.blockChance, locale)}</span>
                </div>
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("healthRegenRate", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.player.secondaryStats.healthRegenRate, locale)}</span>
                </div>
              </div>
              <div className="mt-2">
                <BattleSkillSlots combatant={activeBattle.player} side="player" />
              </div>
            </div>

            <div className={`rounded-lg border border-[#30363d] bg-[#0d1117] p-3 sm:p-4 transition-all duration-300 border-l-[3px] border-l-red-500 ${isEnemyHit ? "scale-[0.985]" : ""} ${isBattleTurnFlashing ? "border-[#484f58]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold leading-5 text-white sm:truncate">{activeBattle.enemy.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Lv.{formatNumber(activeBattle.enemy.level, locale)} · {copy.dashboard.enemyInfo}</p>
                </div>
                <BattleStatusBar combatant={activeBattle.enemy} />
              </div>
              <div className="mt-2">
                <TopStatusBar
                  barClassName={`h-2.5 ${isEnemyHit ? "animate-pulse" : ""}`}
                  label={copy.dashboard.lifeBar}
                  labelClassName="text-slate-500"
                  tone="from-rose-500 to-amber-400"
                  valueLabel={`${formatNumber(activeBattle.enemy.currentHealth, locale)} / ${formatNumber(activeBattle.enemy.maxHealth, locale)}`}
                  value={(activeBattle.enemy.currentHealth / Math.max(1, activeBattle.enemy.maxHealth)) * 100}
                />
              </div>
              <div className="mt-2">
                <TopStatusBar
                  barClassName={`h-1.5 ${isEnemyPulsing ? "animate-pulse" : ""}`}
                  label={copy.dashboard.actionBar}
                  labelClassName="text-slate-500"
                  tone="from-amber-400 to-rose-400"
                  value={activeBattle.enemy.actionBar}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] sm:grid-cols-4 sm:gap-2">
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("critChance", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.critChance, locale)}</span>
                </div>
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("dodgeChance", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.dodgeChance, locale)}</span>
                </div>
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("blockChance", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.blockChance, locale)}</span>
                </div>
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-center">
                  <span className="block text-slate-500">{statLabel("healthRegenRate", messages)}</span>
                  <span className="mt-0.5 block font-medium text-slate-200">{formatSecondaryStatPercent(activeBattle.enemy.secondaryStats.healthRegenRate, locale)}</span>
                </div>
              </div>
              <div className="mt-2">
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
      <div className="border-b border-[#30363d] px-3 py-2.5 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionEyebrow>{copy.dashboard.afkControl}</SectionEyebrow>
            <h2 className="mt-1 truncate text-base font-semibold text-white sm:text-lg">
              {selectedActivity?.label ?? copy.dashboard.afkTitle}
              {selectedMap ? ` · ${localizeMapLabel(selectedMap.key, selectedMap.label, locale)}` : ""}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-slate-400">{snapshot.afk.status === "active" ? messages.common.active : messages.common.idle}</p>
            <p className="mt-1 text-sm font-semibold text-sky-100">{formatPercentValue(taskProgressPercent / 100, locale)}</p>
          </div>
        </div>
        <div className="mt-2">
          <TopStatusBar
            className="border-none bg-transparent p-0"
            barClassName="h-2.5"
            label={copy.dashboard.executionProgress}
            tone="from-sky-400 via-cyan-300 to-emerald-300"
            value={taskProgressPercent}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-2 sm:gap-3 sm:p-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {activities.map((activity) => (
            <button
              key={activity.key}
              className={[
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                selectedActivityKey === activity.key
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 glow-border-sky"
                  : "border border-[#30363d] text-slate-400 hover:border-white/20 hover:text-slate-200",
              ].join(" ")}
              onClick={() => {
                selectActivity(activity.key);
                const firstMap = maps.find((m) => m.activityKey === activity.key);
                if (firstMap) {
                  selectMap(firstMap.key);
                }
              }}
              type="button"
            >
              {activity.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {maps
            .filter((map) => map.activityKey === selectedActivityKey)
            .map((map) => {
              const isUnlocked = role.level >= map.minLevel;
              const isSelected = map.key === selectedMapKey;
              return (
                <button
                  key={map.key}
                  className={[
                    "relative rounded-lg border p-2.5 text-left transition-all sm:p-3",
                    isSelected
                      ? "border-sky-500/40 bg-sky-500/10 glow-border-sky"
                      : "border-[#30363d] bg-[#0d1117] hover:border-[#484f58] hover:bg-[#11161d]",
                    !isUnlocked && "opacity-50",
                  ].join(" ")}
                  disabled={!isUnlocked}
                  onClick={() => selectMap(map.key)}
                  type="button"
                >
                  <p className="text-sm font-semibold text-white">{localizeMapLabel(map.key, map.label, locale)}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{map.summary}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 ${isUnlocked ? "text-emerald-400" : "text-amber-400"}`}>
                      {isUnlocked ? null : (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      )}
                      Lv.{map.minLevel}
                    </span>
                    <span className="text-slate-500">
                      {formatDecimal(map.goldPerMinute, locale)}金/分
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                  )}
                </button>
              );
            })}
        </div>

        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-2.5 sm:p-3">
          {maps
            .filter((map) => map.key === selectedMapKey)
            .map((map) => (
              <div key={map.key}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InlineStat label={copy.dashboard.currentRound} value={`${formatClock(taskProgress)} / ${formatClock(taskDuration)}`} />
                  <InlineStat label={copy.dashboard.remaining} value={formatDuration(Math.max(0, taskDuration - taskProgress))} />
                  <InlineStat label={copy.dashboard.roundGold} value={formatNumber(currentTaskReward.gold, locale)} />
                  <InlineStat label={copy.dashboard.roundAether} value={formatNumber(currentTaskReward.aetherCrystal, locale)} />
                  <InlineStat className="col-span-2 sm:col-span-1" label={copy.dashboard.roundExp} value={formatNumber(currentTaskReward.exp, locale)} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <CommandButton
                    disabled={snapshot.afk.status === "active" || status === "saving" || !isRealtimeReady || role.level < map.minLevel}
                    onClick={() => {
                      void startAfk().catch(() => { });
                    }}
                    tone="primary"
                  >
                    {status === "saving" && snapshot.afk.status === "idle" ? messages.common.submit : copy.dashboard.startAfk}
                  </CommandButton>
                  <CommandButton
                    disabled={snapshot.afk.status === "idle" || status === "saving" || !isRealtimeReady || Boolean(activeBattle)}
                    onClick={() => {
                      void stopAfk().catch(() => { });
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
    selectedActivityKey,
    selectedMapKey,
    selectActivity,
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

  const menuItems: Array<{ key: PanelKey; label: string; count?: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: "afk", label: copy.dashboard.menu.afk.label, count: activeBattle ? messages.common.fighting : snapshot.afk.status === "active" ? copy.dashboard.menu.afk.running : messages.common.idle, icon: GiPathDistance },
    { key: "backpack", label: copy.dashboard.menu.backpack.label, count: String(backpack.length), icon: GiKnapsack },
    { key: "market", label: copy.dashboard.menu.market.label, count: String(snapshot.market.listings.length), icon: GiShop },
    { key: "role", label: copy.dashboard.menu.role.label, count: `${messages.common.levelShort}${role.level}`, icon: GiCharacter },
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
    <main className="min-h-screen min-w-0 bg-[#0d1117] px-2 py-2 text-slate-100 sm:px-3 sm:py-3 md:px-4 md:py-4 xl:h-screen xl:overflow-hidden">
      {uiNotice ? (
        <div
          className={[
            "fixed right-3 top-3 z-50 w-[min(94vw,28rem)] rounded-lg border px-3 py-2 text-sm sm:right-4 sm:top-4 sm:px-4 sm:py-3",
            uiNotice.tone === "danger"
              ? "border-rose-800 bg-rose-900/30 text-rose-200"
              : "border-emerald-800 bg-emerald-900/30 text-emerald-200",
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
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[1.7rem]">{copy.dashboard.registerTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {formatMessage(copy.dashboard.registerSummary, { roleName: role.name })}
          </p>
          <form
            className="mt-4 space-y-3"
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
              }).catch(() => { });
            }}
          >
            <label className="block">
              <span className="text-xs font-medium tracking-[0.08em] text-emerald-100/90">{copy.landing.username}</span>
              <input
                className="mt-1.5 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300"
                onChange={(event) => setRegisterUsername(event.target.value)}
                placeholder={copy.dashboard.registerUsernamePlaceholder}
                value={registerUsername}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium tracking-[0.08em] text-emerald-100/90">{copy.landing.password}</span>
              <input
                className="mt-1.5 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300"
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder={copy.dashboard.registerPasswordPlaceholder}
                type="password"
                value={registerPassword}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium tracking-[0.08em] text-emerald-100/90">{copy.dashboard.registerConfirmPassword}</span>
              <input
                className="mt-1.5 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300"
                onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                placeholder={copy.dashboard.registerConfirmPasswordPlaceholder}
                type="password"
                value={registerConfirmPassword}
              />
            </label>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <button
                className="flex-1 rounded-md bg-[#1f6feb] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-md border border-[#30363d] bg-[#21262d] px-3 py-2.5 text-sm text-slate-200 transition hover:bg-[#30363d]"
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
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[1.7rem]">{copy.dashboard.deleteRoleTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {formatMessage(copy.dashboard.deleteRoleSummary, {
              roleName: role.name,
              username: snapshot.account.username ?? messages.common.boundAccount,
            })}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="flex-1 rounded-md bg-rose-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status === "saving"}
              onClick={() => {
                void deleteAccountRole().then(() => {
                  setShowDeleteRoleConfirm(false);
                }).catch(() => { });
              }}
              type="button"
            >
                {status === "saving" ? copy.dashboard.deleteRoleLoading : copy.dashboard.deleteRoleSubmit}
              </button>
            <button
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200"
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
          <div className="mt-3 flex items-start gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border text-2xl font-semibold sm:h-16 sm:w-16 sm:text-3xl ${itemAccent(actionItem.rarity)}`}>
              {(() => {
                const ActionItemIcon = getGameIconByKey(
                  actionItem.iconKey,
                  getItemTypeFallbackIconKey(actionItem.itemType),
                );
                return <ActionItemIcon className="h-7 w-7 sm:h-8 sm:w-8" />;
              })()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-6 text-white sm:text-xl">{localizeItemName(actionItem.itemId, actionItem.name, locale)}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">
                {formatMessage(copy.dashboard.actionItemMeta, {
                  equippedCount: actionItem.equippedCount ?? 0,
                  itemType: itemTypeLabel(actionItem.itemType, messages),
                  quantity: actionItem.quantity,
                  rarity: rarityLabel(actionItem.rarity, messages),
                  slot: slotLabel(actionItem.slot, messages),
                })}
              </p>
              <p className="mt-1.5 text-sm leading-5 text-slate-300">{localizeItemDescription(actionItem.itemId, actionItem.description, locale)}</p>
              <p className="mt-1.5 text-xs leading-5 text-sky-100/75">{formatStatsSummary(actionItem.stats, locale, messages)}</p>
              {actionItem.itemType === "equipment" ? (
                <p className="mt-1.5 text-xs leading-5 text-slate-400">{formatMessage(copy.dashboard.occupiedSlots, { slots: formatEquippedGroupSummary(actionItem.equippedSlotGroups, messages) })}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {getAvailableItemActions(actionItem, messages).map((action) => (
              <button
                key={action.actionKey}
                className={[
                  "w-full rounded-md border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
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
                    }).catch(() => { });
                    return;
                  }

                  if (action.actionKey === "unequip") {
                    void unequipBackpackItem(actionItem.backpackId).then(() => {
                      setItemActionBackpackId(null);
                    }).catch(() => { });
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
                <p className="text-sm font-semibold leading-5">{action.label}</p>
                <p className="mt-0.5 text-xs leading-4.5 text-current/75">{action.summary}</p>
              </button>
            ))}
            <button
              className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200"
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
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[1.7rem]">
            {pendingActionDefinition.confirmTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {formatMessage(copy.dashboard.pendingActionSummary, {
              extra: pendingActionDefinition.confirmCopy,
              itemName: localizeItemName(pendingActionItem.itemId, pendingActionItem.name, locale),
              quantity: pendingActionItem.quantity,
            })}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DataPill label={messages.common.type} value={itemTypeLabel(pendingActionItem.itemType, messages)} />
            <DataPill label={messages.common.rarity} value={rarityLabel(pendingActionItem.rarity, messages)} />
            <DataPill label={messages.common.sellPrice} value={formatNumber(pendingActionItem.sellPrice, locale)} />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className={[
                "flex-1 rounded-md px-3 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50",
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
                  }).catch(() => { });
                }

                if (pendingItemAction?.actionKey === "learn") {
                  void learnSkillBook(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => { });
                }

                if (pendingItemAction?.actionKey === "equip") {
                  void equipBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => { });
                }

                if (pendingItemAction?.actionKey === "unequip") {
                  void unequipBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  }).catch(() => { });
                }
              }}
              type="button"
            >
              {status === "saving" ? messages.common.processing : pendingActionDefinition.confirmVerb}
            </button>
            <button
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200"
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
          <h2 className="mt-2 break-words text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[1.7rem]">{localizeItemName(marketSellItem.itemId, marketSellItem.name, locale)}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {formatMessage(copy.market.sellSummary, {
              feeRate: snapshot.market.feeRatePercent,
              itemName: localizeItemName(marketSellItem.itemId, marketSellItem.name, locale),
            })}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DataPill label={messages.common.rarity} value={rarityLabel(marketSellItem.rarity, messages)} />
            <DataPill label={messages.common.slot} value={slotLabel(marketSellItem.slot, messages)} />
            <DataPill label={copy.market.sellableQuantity} value={formatNumber(marketSellableQuantity, locale)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium tracking-[0.08em] text-amber-100/90">{copy.market.sellPriceLabel}</span>
              <input
                className="mt-1.5 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300"
                inputMode="numeric"
                onChange={(event) => setMarketSellPrice(event.target.value.replace(/[^\d]/g, ""))}
                placeholder={marketReferencePrice === null ? copy.market.sellPricePlaceholderEmpty : copy.market.sellPricePlaceholder}
                value={marketSellPrice}
              />
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
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
              <span className="text-xs font-medium tracking-[0.08em] text-amber-100/90">{copy.market.sellQuantityLabel}</span>
              <input
                className="mt-1.5 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300"
                inputMode="numeric"
                onChange={(event) => setMarketSellQuantity(event.target.value.replace(/[^\d]/g, ""))}
                placeholder={copy.market.sellQuantityPlaceholder}
                value={marketSellQuantity}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-xs leading-5 text-slate-400">
                  {formatMessage(copy.market.sellQuantityHint, { quantity: formatNumber(marketSellableQuantity, locale) })}
                </p>
                <button
                  className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-300/18"
                  onClick={() => setMarketSellQuantity(String(marketSellableQuantity))}
                  type="button"
                >
                  {copy.market.sellAll}
                </button>
              </div>
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DataPill label={messages.common.sellPrice} value={formatNumber(marketSellItem.sellPrice, locale)} />
            <DataPill label={copy.market.feePreview} value={formatNumber(Math.floor((Number(marketSellPrice || 0) * snapshot.market.feeRatePercent) / 100), locale)} />
            <DataPill label={copy.market.receivePreview} value={formatNumber(Math.max(0, Number(marketSellPrice || 0) - Math.floor((Number(marketSellPrice || 0) * snapshot.market.feeRatePercent) / 100)), locale)} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="flex-1 rounded-md bg-amber-400 px-3 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                }).catch(() => { });
              }}
              type="button"
              >
              {copy.market.confirmSell}
            </button>
            <button
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200"
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
          <h2 className="mt-2 break-words text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[1.7rem]">{localizeItemName(pendingMarketPurchase.itemId, pendingMarketPurchase.name, locale)}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {formatMessage(copy.market.buySummary, {
              price: formatNumber(pendingMarketPurchase.price, locale),
              sellerName: pendingMarketPurchase.sellerName,
            })}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DataPill label={copy.market.lowestPrice} value={formatNumber(pendingMarketPurchase.price, locale)} />
            <DataPill label={copy.market.availableCount} value={formatNumber(pendingMarketPurchase.availableCount, locale)} />
            <DataPill label={copy.market.feeRule} value={`${snapshot.market.feeRatePercent}%`} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="flex-1 rounded-md bg-[#1f6feb] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRealtimeActionDisabled}
              onClick={() => {
                void buyMarketListing(pendingMarketPurchase.listingId).then(() => {
                  setPendingMarketPurchaseListingId(null);
                }).catch(() => { });
              }}
              type="button"
              >
              {copy.market.confirmBuy}
            </button>
            <button
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200"
              onClick={() => setPendingMarketPurchaseListingId(null)}
              type="button"
            >
              {messages.common.cancel}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      <div className="mx-auto flex max-w-[1760px] flex-col gap-2 sm:gap-3 xl:h-full xl:overflow-hidden">
        <SectionCard className="overflow-hidden">
          <div className="px-2 py-1.5 sm:px-2.5 sm:py-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-gradient-to-br from-sky-500/20 to-emerald-500/10 text-[10px] font-bold text-sky-300 sm:h-8 sm:w-8 sm:text-[11px]">
                  {role.avatarSeed}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:gap-x-2">
                    <span className="break-words text-[13px] font-medium leading-4 text-white sm:truncate sm:text-sm">{role.name}</span>
                    <StatusChip tone={activeBattle ? "warning" : snapshot.afk.status === "active" ? "emerald" : "neutral"}>
                      {activeBattle ? messages.common.fighting : snapshot.afk.status === "active" ? copy.dashboard.menu.afk.running : messages.common.idle}
                    </StatusChip>
                    <span className="text-[10px] leading-none text-slate-500">Lv.{role.level}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-none sm:text-[11px]">
                    <span className="text-slate-500">{localizeRaceLabel(role.raceKey, snapshot.config.races.find((item) => item.key === role.raceKey)?.label ?? role.raceKey, locale)} · {localizeClassLabel(role.classKey, snapshot.config.classes.find((item) => item.key === role.classKey)?.label ?? role.classKey, locale)}</span>
                    <span className="text-amber-300">金：{formatNumber(role.gold, locale)}</span>
                    <span className="text-sky-300">以太：{formatNumber(role.aetherCrystal, locale)}</span>
                    <span className="text-emerald-300">经验：{formatNumber(role.exp, locale)}</span>
                  </div>
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                {isGuestUser ? (
                  <button
                    className="rounded-md border border-[#30363d] bg-[#21262d] px-2 py-1 text-[11px] text-slate-200 transition hover:bg-[#30363d] sm:px-3 sm:py-1.5 sm:text-xs"
                    disabled={status === "saving"}
                    onClick={() => setShowRegisterAccountModal(true)}
                    type="button"
                  >
                    {copy.dashboard.registerAccount}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-2 sm:gap-3 xl:min-h-0 xl:flex-1">
          <SectionCard className="overflow-hidden p-1.5 sm:p-2">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {menuItems.map((item) => (
                <RailButton
                  key={item.key}
                  active={activePanel === item.key}
                  count={item.count}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => setActivePanel(item.key)}
                />
              ))}
            </div>
          </SectionCard>

          {/* Mobile/Tablet: stacked; Desktop: side-by-side with chat on right */}
          <div className="grid gap-2 sm:gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <CenterPanel
              activePanel={activePanel}
              backpack={backpack}
              isRealtimeReady={isRealtimeReady}
              currentTaskReward={currentTaskReward}
              activities={snapshot.config.activities}
              maps={maps}
              onRequestBuyMarketListing={(listingId) => {
                setPendingMarketPurchaseListingId(listingId);
              }}
              onConfigureSkillLoadout={(skillKey, action) => {
                void configureSkillLoadout(skillKey, action).then(() => {
                  pushNotice(action === "equip" ? "技能已加入携带栏。" : "技能已移出携带栏。", "success");
                }).catch(() => { });
              }}
              onDeleteRole={() => setShowDeleteRoleConfirm(true)}
              onUnequipItem={(backpackId) => {
                void unequipBackpackItem(backpackId).catch(() => { });
              }}
              onSelectItem={handleSelectBackpackItem}
              role={role}
              selectedBackpackId={selectedBackpackId}
              selectedActivityKey={selectedActivityKey}
              selectActivity={selectActivity}
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
            {/* Desktop: chat as fixed-height side panel; Mobile: full width below */}
            <div className="hidden xl:block xl:min-h-0">
              <Chat />
            </div>
          </div>

          {/* Mobile/Tablet: chat below main content */}
          <div className="xl:hidden">
            <Chat />
          </div>
        </div>

        <div className="rounded-md border border-[#30363d] bg-[#161b22] px-2.5 py-1.5 sm:px-3 sm:py-2">
          <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <span>{copy.dashboard.levelBar}</span>
            <span>{copy.dashboard.levelProgress} {progressCopy}</span>
          </div>
          <div className="progress-shine mt-1 h-1.5 overflow-hidden rounded-full bg-[#21262d]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 transition-[width] duration-500 ease-out"
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
