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
        "game-panel rounded-lg",
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
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
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
    <div className={["game-subpanel rounded-md p-3", className].join(" ")}>
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
        "game-subpanel min-w-0 rounded-md px-2.5 py-1.5",
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
    <div className={["game-subpanel flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5", className].join(" ")}>
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
    <div className="game-subpanel flex items-center gap-1.5 rounded-md px-2 py-1">
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
        className="flex min-h-8 w-full items-center justify-between gap-2 rounded-md border border-[#30363d] bg-[#0d1117] px-2 py-1 text-left text-[11px] text-slate-200 transition hover:border-[#3d444d] hover:bg-[#11161d] focus-visible:border-[#58a6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/20"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <svg
          aria-hidden="true"
          className={[
            "h-3 w-3 shrink-0 text-slate-500 transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
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
                    "flex min-h-7 w-full items-center rounded-md px-2 py-1 text-left text-[11px] transition",
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
    <div className={["game-subpanel rounded-lg p-3 sm:p-4", className].join(" ")}>
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
        "group flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-center transition sm:min-h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2.5 sm:text-left",
        active
          ? "border-cyan-300/[0.45] bg-cyan-300/10 text-white shadow-[0_0_18px_rgba(34,211,238,0.12)]"
          : "border-white/[0.08] bg-white/[0.025] text-slate-300 hover:border-white/[0.18] hover:bg-white/[0.045] hover:text-white",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {Icon ? (
        <Icon className={`h-3.5 w-3.5 shrink-0 transition ${active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} />
      ) : null}
      <div className="flex min-w-0 flex-col items-center gap-0.5 sm:flex-1 sm:flex-row sm:justify-between sm:gap-1.5">
        <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-4">{label}</span>
        {count ? (
          <span
            className={[
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none",
              active ? "bg-cyan-300/[0.18] text-cyan-200" : "bg-white/[0.055] text-slate-500",
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
          <div key={itemType} className="game-subpanel rounded-lg p-2.5 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 min-h-6 items-center gap-2">
                <p className="truncate text-[11px] uppercase leading-none tracking-[0.18em] text-slate-300/78">{itemTypeLabel(itemType, messages)}</p>
                <span className="shrink-0 text-[10px] leading-none text-slate-500">{formatNumber(items.length, locale)} {messages.common.speciesUnit}</span>
              </div>
              <MetaBadge tone={itemCategoryTone(itemType)}>{itemTypeLabel(itemType, messages)}</MetaBadge>
            </div>
            <div className="grid grid-cols-4 gap-1.5 min-[420px]:grid-cols-5 sm:grid-cols-6 sm:gap-2 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9">
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
  activities,
  maps,
  onCreateBuyOrder,
  onCreateMarketListing,
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
  taskProgressPercent,
}: {
  activePanel: PanelKey;
  backpack: BackpackItem[];
  isRealtimeReady: boolean;
  activities: ActivityConfig[];
  maps: MapConfig[];
  onCreateBuyOrder: (itemId: string, price: number, quantity: number) => Promise<void>;
  onCreateMarketListing: (backpackId: string, price: number, quantity: number) => Promise<void>;
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
  taskProgressPercent: number;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.game;
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<"all" | "equipment" | "skill_book" | "material">("all");
  const [marketRarityFilter, setMarketRarityFilter] = useState<"all" | "white" | "green" | "blue" | "purple" | "orange">("all");
  const [marketSlotFilter] = useState<"all" | BodySlotType>("all");
  const [marketSelectedItemId, setMarketSelectedItemId] = useState<string | null>(null);
  const [sellOrderPrice, setSellOrderPrice] = useState("");
  const [sellOrderQuantity, setSellOrderQuantity] = useState("1");
  const [buyOrderPrice, setBuyOrderPrice] = useState("");
  const [buyOrderQuantity, setBuyOrderQuantity] = useState("1");
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
    const healthPct = Math.max(0, Math.min(100, (role.currentHealth / Math.max(1, role.maxHealth)) * 100));

    return (
      <SectionCard className="flex min-h-[20rem] flex-col overflow-hidden sm:min-h-[24rem] xl:h-full xl:min-h-0">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ── Hero Character Card ── */}
          <div className="relative overflow-hidden border-b border-[#30363d] bg-linear-to-br from-[#0d1117] via-[#111827] to-[#0d1117] px-3 py-3 sm:px-4 sm:py-4">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.06),transparent_50%)]" />
            <div className="relative flex items-start gap-3">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-300/25 bg-linear-to-br from-cyan-300/16 via-emerald-300/10 to-amber-300/10 text-lg font-bold text-cyan-200 shadow-lg shadow-cyan-500/10 sm:h-16 sm:w-16 sm:text-xl">
                  {role.avatarSeed}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#30363d] bg-[#161b22] text-[9px] font-bold text-amber-300">
                  {role.level}
                </div>
              </div>
              {/* Identity */}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{role.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {race ? (() => {
                    const RaceIcon = raceIconByConfig(race.key, race.iconKey);
                    return (
                      <span className="inline-flex items-center gap-1 rounded-md border border-sky-800/40 bg-sky-900/20 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                        <RaceIcon className="h-3 w-3" />
                        {localizeRaceLabel(race.key, race.label, locale)}
                      </span>
                    );
                  })() : null}
                  {roleClass ? (() => {
                    const ClassIcon = classIconByConfig(roleClass.key, roleClass.iconKey);
                    return (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-800/40 bg-emerald-900/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                        <ClassIcon className="h-3 w-3" />
                        {localizeClassLabel(roleClass.key, roleClass.label, locale)}
                      </span>
                    );
                  })() : null}
                </div>
                {/* Health bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>{copy.dashboard.currentHealth}</span>
                    <span className="tabular-nums">{formatNumber(role.currentHealth, locale)} / {formatNumber(role.maxHealth, locale)}</span>
                  </div>
                  <div className="progress-shine mt-0.5 h-2 overflow-hidden rounded-full bg-[#21262d]">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ease-out ${healthPct > 60 ? "bg-linear-to-r from-emerald-500 to-emerald-400" : healthPct > 30 ? "bg-linear-to-r from-amber-500 to-amber-400" : "bg-linear-to-r from-rose-500 to-rose-400"}`}
                      style={{ width: `${healthPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Primary Stats ── */}
          <div className="border-b border-[#30363d] px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="mb-2 text-[9px] uppercase tracking-[0.16em] text-slate-600">{copy.dashboard.levelBar}</p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {[
                { key: "strength", color: "border-rose-800/40 bg-rose-950/30 text-rose-300", icon: "⚔" },
                { key: "agility", color: "border-emerald-800/40 bg-emerald-950/30 text-emerald-300", icon: "💨" },
                { key: "intelligence", color: "border-sky-800/40 bg-sky-950/30 text-sky-300", icon: "✦" },
                { key: "vitality", color: "border-amber-800/40 bg-amber-950/30 text-amber-300", icon: "♥" },
              ].map((s) => (
                <div key={s.key} className={`rounded-lg border px-2 py-2 text-center ${s.color}`}>
                  <span className="text-[10px]">{s.icon}</span>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-none sm:text-lg">{formatNumber(role.stats[s.key as keyof typeof role.stats], locale)}</p>
                  <p className="mt-0.5 text-[8px] uppercase tracking-wider opacity-70">{statLabel(s.key, messages)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Secondary Stats ── */}
          <div className="border-b border-[#30363d] px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="mb-2 text-[9px] uppercase tracking-[0.16em] text-slate-600">战斗属性</p>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[
                { key: "critChance", value: formatSecondaryStatPercent(role.secondaryStats.critChance, locale), color: "text-amber-300" },
                { key: "critDamage", value: formatSecondaryStatMultiplier(role.secondaryStats.critDamage, locale), color: "text-orange-300" },
                { key: "dodgeChance", value: formatSecondaryStatPercent(role.secondaryStats.dodgeChance, locale), color: "text-cyan-300" },
                { key: "blockChance", value: formatSecondaryStatPercent(role.secondaryStats.blockChance, locale), color: "text-emerald-300" },
                { key: "healthRegenRate", value: formatSecondaryStatPercent(role.secondaryStats.healthRegenRate, locale), color: "text-rose-300" },
              ].map((s) => (
                <div key={s.key} className="game-subpanel flex items-center justify-between rounded-md px-2 py-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500">{statLabel(s.key, messages)}</span>
                  <span className={`text-xs font-semibold tabular-nums ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Equipment Slots ── */}
          <div className="border-b border-[#30363d] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{copy.dashboard.bodySlots}</p>
              <span className="text-[9px] text-slate-600">{bodySlots.filter((s) => s.item).length}/{bodySlots.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-1 min-[420px]:grid-cols-2 sm:gap-1.5">
              {bodySlots.map((slot) => (
                <div
                  key={slot.key}
                  className={[
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 transition",
                    slot.item
                      ? marketItemCardAccent(slot.item.rarity)
                      : "border-[#30363d]/60 bg-[#0d1117]/40",
                  ].join(" ")}
                >
                  {(() => {
                    const SlotIcon = getGameIconByKey(null, getItemTypeFallbackIconKey("equipment"));
                    return (
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${slot.item ? "border-[#30363d] bg-[#0d1117] text-slate-200" : "border-white/[0.06] bg-white/[0.03] text-slate-700"}`}>
                        <SlotIcon className={slot.item ? "h-3.5 w-3.5" : "h-3 w-3 opacity-40"} />
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">{bodySlotKeyLabel(slot.key, messages)}</p>
                    <p className={`truncate text-xs font-medium ${slot.item ? "text-slate-200" : "text-slate-600"}`}>
                      {slot.item ? localizeItemName(slot.item.itemId, slot.item.name, locale) : copy.dashboard.emptySlot}
                    </p>
                  </div>
                  {slot.item ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`text-[9px] font-medium ${{
                        white: "text-slate-400",
                        green: "text-emerald-400",
                        blue: "text-sky-400",
                        purple: "text-fuchsia-400",
                        orange: "text-amber-400",
                      }[slot.item.rarity] ?? "text-slate-400"}`}>{rarityLabel(slot.item.rarity, messages)}</span>
                      <button
                        className="rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-300 transition hover:border-sky-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!isRealtimeReady || status === "saving"}
                        onClick={() => onUnequipItem(slot.item!.backpackId)}
                        type="button"
                      >
                        {copy.dashboard.unequip}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-700">{slotLabel(slot.slotType, messages)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Skills ── */}
          <div className="px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">{copy.dashboard.skillPanelTitle}</p>
              <span className="rounded-md bg-sky-900/30 px-1.5 py-0.5 text-[9px] font-medium text-sky-400">
                {formatMessage(copy.dashboard.skillSlotsSummary, {
                  remaining: formatNumber(role.skillSlots.remaining, locale),
                  total: formatNumber(role.skillSlots.total, locale),
                  used: formatNumber(role.skillSlots.used, locale),
                })}
              </span>
            </div>

            {equippedSkills.length > 0 && (
              <div className="mb-2">
                <p className="mb-1.5 text-[9px] uppercase tracking-wider text-slate-600">{copy.dashboard.equippedSkillsTitle}</p>
                <div className="grid gap-1 min-[420px]:grid-cols-2 sm:gap-1.5">
                  {equippedSkills.map((skill) => (
                    <div
                      key={`equipped-${skill.key}`}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${skillQualityTone(skill.quality)}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{skill.name}</p>
                        <p className="text-[9px] text-slate-400">{skillCategoryLabel(skill.category, messages)} · Lv.{formatNumber(skill.level, locale)}</p>
                      </div>
                      <button
                        className="shrink-0 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
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
              <div>
                <p className="mb-1.5 text-[9px] uppercase tracking-wider text-slate-600">{copy.dashboard.learnedSkillsTitle}</p>
                <div className="grid gap-1 min-[420px]:grid-cols-2 sm:gap-1.5">
                  {availableSkills.map((skill) => (
                    <div
                      key={`learned-${skill.key}`}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${skillQualityTone(skill.quality)}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{skill.name}</p>
                        <p className="text-[9px] text-slate-400">{skillCategoryLabel(skill.category, messages)} · Lv.{formatNumber(skill.level, locale)}</p>
                      </div>
                      <button
                        className="shrink-0 rounded border border-[#1f6feb]/30 bg-[#1f6feb]/10 px-1.5 py-0.5 text-[9px] text-[#58a6ff] transition hover:bg-[#1f6feb]/20 disabled:cursor-not-allowed disabled:opacity-50"
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
              <p className="mt-1 text-xs text-slate-500">{copy.dashboard.learnedSkillsAllEquipped}</p>
            )}
            {equippedSkills.length === 0 && learnedSkills.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">{copy.dashboard.equippedSkillsEmpty}</p>
            )}
          </div>

          {/* ── Danger Zone ── */}
          <div className="flex justify-end border-t border-[#30363d] px-3 py-1.5 sm:px-4 sm:py-2">
            <button
              className="rounded px-2 py-0.5 text-[10px] text-rose-500/50 transition hover:bg-rose-950/40 hover:text-rose-400"
              disabled={status === "saving"}
              onClick={onDeleteRole}
              type="button"
            >
              {copy.dashboard.deleteRole}
            </button>
          </div>
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
    const filteredListings = snapshot.market.listings.filter((listing) => (
      (marketCategoryFilter === "all" || listing.categoryKey === marketCategoryFilter)
      && (marketRarityFilter === "all" || listing.rarity === marketRarityFilter)
      && (marketSlotFilter === "all" || listing.slot === marketSlotFilter)
    ));

    // Group by itemId for the item grid view
    const itemGroups = new Map<string, {
      itemId: string;
      name: string;
      rarity: string;
      slot: string;
      categoryKey: string;
      stats: Record<string, number>;
      lowestPrice: number;
      totalCount: number;
      listings: typeof filteredListings;
    }>();
    for (const listing of filteredListings) {
      const existing = itemGroups.get(listing.itemId);
      if (existing) {
        existing.lowestPrice = Math.min(existing.lowestPrice, listing.price);
        existing.totalCount += listing.availableCount;
        existing.listings.push(listing);
      } else {
        itemGroups.set(listing.itemId, {
          itemId: listing.itemId,
          name: listing.name,
          rarity: listing.rarity,
          slot: listing.slot,
          categoryKey: listing.categoryKey,
          stats: listing.stats,
          lowestPrice: listing.price,
          totalCount: listing.availableCount,
          listings: [listing],
        });
      }
    }
    const uniqueItems = Array.from(itemGroups.values()).sort((a, b) => a.lowestPrice - b.lowestPrice);
    const selectedItem = marketSelectedItemId ? itemGroups.get(marketSelectedItemId) : null;
    const selectedItemListings = selectedItem
      ? selectedItem.listings.sort((a, b) => a.price - b.price)
      : [];

    const rarityTextMap: Record<string, string> = {
      white: "text-slate-400",
      green: "text-emerald-400",
      blue: "text-sky-400",
      purple: "text-fuchsia-400",
      orange: "text-amber-400",
    };

    return (
      <SectionCard className="flex min-h-[20rem] flex-col overflow-hidden sm:min-h-[24rem] xl:h-full xl:min-h-0">
        {/* Header */}
        <div className="border-b border-[#30363d] px-3 py-1.5 sm:px-4 sm:py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {selectedItem ? (
                <button
                  className="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-slate-300"
                  onClick={() => { setMarketSelectedItemId(null); setSellOrderPrice(""); setSellOrderQuantity("1"); setBuyOrderPrice(""); setBuyOrderQuantity("1"); }}
                  type="button"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.25-4.5a.75.75 0 010-1.08l4.25-4.5a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                  {copy.market.title}
                </button>
              ) : (
                <>
                  <h2 className="text-xs font-semibold tracking-tight text-white">{copy.market.title}</h2>
                  <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] text-slate-500">{uniqueItems.length}</span>
                </>
              )}
            </div>
            {!selectedItem && (
              <div className="flex items-center gap-1">
                <CompactDropdown
                  ariaLabel={copy.market.filters.category}
                  className="min-w-0 w-20"
                  onChange={setMarketCategoryFilter}
                  options={marketCategoryOptions}
                  value={marketCategoryFilter}
                />
                <CompactDropdown
                  ariaLabel={copy.market.filters.rarity}
                  className="min-w-0 w-16"
                  onChange={setMarketRarityFilter}
                  options={marketRarityOptions}
                  value={marketRarityFilter}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5 sm:p-2">
          {/* Level 2: Order book for selected item */}
          {selectedItem ? (() => {
            const sellOrders = [...selectedItemListings].sort((a, b) => a.price - b.price);
            const itemBuyOrders = (snapshot.market.buyOrders ?? [])
              .filter((o) => o.itemId === selectedItem.itemId)
              .sort((a, b) => b.price - a.price);

            const bestSell = sellOrders.length > 0 ? sellOrders[0].price : null;
            const bestBuy = itemBuyOrders.length > 0 ? itemBuyOrders[0].price : null;
            const spread = bestSell !== null && bestBuy !== null ? bestSell - bestBuy : null;

            const matchingBackpackItems = backpack.filter((item) => item.itemId === selectedItem.itemId);
            const sellableItem = matchingBackpackItems.find((item) => {
              const equipped = item.equippedCount ?? 0;
              return item.quantity - equipped > 0;
            }) ?? matchingBackpackItems[0] ?? null;
            const sellableQty = sellableItem
              ? Math.max(0, sellableItem.quantity - (sellableItem.equippedCount ?? 0))
              : 0;
            const sellPriceVal = Number(sellOrderPrice || 0);
            const sellFeeAmount = Math.floor((sellPriceVal * snapshot.market.feeRatePercent) / 100);
            const buyPriceVal = Number(buyOrderPrice || 0);
            const buyTotalCost = buyPriceVal * Number(buyOrderQuantity || 0);

            const OrderRow = ({
              name,
              qty,
              price,
              action,
              actionLabel,
              accentColor,
              disabled,
            }: {
              name: string;
              qty: number;
              price: number;
              action: () => void;
              actionLabel: string;
              accentColor: string;
              disabled: boolean;
            }) => (
              <div className="flex items-center gap-2 border-b border-white/[0.02] px-2 py-1 transition hover:bg-white/[0.02]">
                <p className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{name}</p>
                <span className="w-12 shrink-0 text-right text-[10px] text-slate-400 tabular-nums">{formatNumber(qty, locale)}</span>
                <span className="w-16 shrink-0 text-right text-[10px] font-semibold tabular-nums text-amber-300">{formatNumber(price, locale)}</span>
                <button
                  className={`w-8 shrink-0 rounded border px-1 py-0.5 text-[8px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${accentColor}`}
                  disabled={disabled}
                  onClick={action}
                  type="button"
                >
                  {actionLabel}
                </button>
              </div>
            );

            return (
              <div className="flex min-h-0 flex-col gap-1.5">
                {/* Spread bar */}
                <div className="flex items-center justify-between rounded-lg border border-[#30363d] bg-[#0d1117] px-2 py-1">
                  <div className="flex items-center gap-3 text-[9px]">
                    <span className="text-slate-500">最低卖</span>
                    <span className="font-semibold tabular-nums text-rose-300">{bestSell !== null ? formatNumber(bestSell, locale) : "—"}</span>
                    <span className="text-slate-700">|</span>
                    <span className="text-slate-500">最高买</span>
                    <span className="font-semibold tabular-nums text-emerald-300">{bestBuy !== null ? formatNumber(bestBuy, locale) : "—"}</span>
                    {spread !== null && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span className="text-slate-500">价差</span>
                        <span className="tabular-nums text-slate-400">{formatNumber(spread, locale)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Two order lists */}
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 md:flex-row">
                  {/* Sell orders (asks) */}
                  <div className="flex min-h-[6rem] flex-1 flex-col rounded-lg border border-[#30363d] bg-[#0d1117] md:min-h-0">
                    <div className="flex items-center justify-between border-b border-white/[0.04] px-2 py-1">
                      <span className="text-[10px] font-medium text-rose-400">卖出单 · {sellOrders.length}</span>
                      <span className="text-[8px] uppercase tracking-wider text-slate-600">价格 ↑</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {sellOrders.length > 0 ? (
                        <div>
                          <div className="sticky top-0 flex items-center gap-2 border-b border-white/[0.03] bg-[#0d1117] px-2 py-0.5 text-[8px] uppercase tracking-wider text-slate-600">
                            <span className="min-w-0 flex-1">卖家</span>
                            <span className="w-12 text-right">数量</span>
                            <span className="w-16 text-right">单价</span>
                            <span className="w-8" />
                          </div>
                          {sellOrders.map((order) => (
                            <OrderRow
                              key={order.listingId}
                              name={order.sellerName}
                              qty={order.availableCount}
                              price={order.price}
                              action={() => onRequestBuyMarketListing(order.listingId)}
                              actionLabel={order.isOwnListing ? "—" : "买"}
                              accentColor="border-sky-800/40 bg-sky-900/20 text-sky-300 hover:bg-sky-900/40"
                              disabled={!isRealtimeReady || status === "saving" || order.isOwnListing}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="py-6 text-center text-[10px] text-slate-600">暂无卖出单</p>
                      )}
                    </div>
                  </div>

                  {/* Buy orders (bids) */}
                  <div className="flex min-h-[6rem] flex-1 flex-col rounded-lg border border-[#30363d] bg-[#0d1117] md:min-h-0">
                    <div className="flex items-center justify-between border-b border-white/[0.04] px-2 py-1">
                      <span className="text-[10px] font-medium text-emerald-400">买入单 · {itemBuyOrders.length}</span>
                      <span className="text-[8px] uppercase tracking-wider text-slate-600">价格 ↓</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      {itemBuyOrders.length > 0 ? (
                        <div>
                          <div className="sticky top-0 flex items-center gap-2 border-b border-white/[0.03] bg-[#0d1117] px-2 py-0.5 text-[8px] uppercase tracking-wider text-slate-600">
                            <span className="min-w-0 flex-1">买家</span>
                            <span className="w-12 text-right">数量</span>
                            <span className="w-16 text-right">单价</span>
                            <span className="w-8" />
                          </div>
                          {itemBuyOrders.map((order) => (
                            <OrderRow
                              key={order.orderId}
                              name={order.buyerName}
                              qty={order.quantity - order.filledQuantity}
                              price={order.price}
                              action={() => {
                                // Sell to this buyer: create a matching sell listing
                                if (!sellableItem) return;
                                void onCreateMarketListing(sellableItem.backpackId, order.price, 1);
                              }}
                              actionLabel={order.isOwnOrder ? "—" : "卖"}
                              accentColor="border-emerald-800/40 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/40"
                              disabled={!isRealtimeReady || status === "saving" || order.isOwnOrder || !sellableItem}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="py-6 text-center text-[10px] text-slate-600">暂无买入单</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Place order forms */}
                <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                  {/* Sell order form */}
                  <div className="flex flex-1 items-end gap-1.5 rounded-lg border border-[#30363d] bg-[#0d1117] p-1.5">
                    <span className="text-[9px] font-medium text-rose-400">卖</span>
                    <label className="block">
                      <input
                        className="w-16 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-rose-500/40"
                        inputMode="numeric"
                        onChange={(e) => setSellOrderPrice(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder={bestSell !== null ? `${bestSell}` : "价格"}
                        value={sellOrderPrice}
                      />
                    </label>
                    <label className="block">
                      <input
                        className="w-12 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-rose-500/40"
                        inputMode="numeric"
                        onChange={(e) => setSellOrderQuantity(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder={`×${sellableQty}`}
                        value={sellOrderQuantity}
                      />
                    </label>
                    {sellPriceVal > 0 && (
                      <span className="text-[8px] text-slate-600">费{formatNumber(sellFeeAmount, locale)}</span>
                    )}
                    <button
                      className="shrink-0 rounded bg-rose-600 px-2 py-1 text-[9px] font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!isRealtimeReady || status === "saving" || !sellableItem || sellPriceVal <= 0 || Number(sellOrderQuantity) <= 0 || Number(sellOrderQuantity) > sellableQty}
                      onClick={() => {
                        if (!sellableItem) return;
                        void onCreateMarketListing(sellableItem.backpackId, sellPriceVal, Number(sellOrderQuantity)).then(() => { setSellOrderPrice(""); setSellOrderQuantity("1"); }).catch(() => {});
                      }}
                      type="button"
                    >
                      {status === "saving" ? "…" : "挂卖"}
                    </button>
                  </div>

                  {/* Buy order form */}
                  <div className="flex flex-1 items-end gap-1.5 rounded-lg border border-[#30363d] bg-[#0d1117] p-1.5">
                    <span className="text-[9px] font-medium text-emerald-400">买</span>
                    <label className="block">
                      <input
                        className="w-16 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-emerald-500/40"
                        inputMode="numeric"
                        onChange={(e) => setBuyOrderPrice(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder={bestBuy !== null ? `${bestBuy}` : "价格"}
                        value={buyOrderPrice}
                      />
                    </label>
                    <label className="block">
                      <input
                        className="w-12 rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-emerald-500/40"
                        inputMode="numeric"
                        onChange={(e) => setBuyOrderQuantity(e.target.value.replace(/[^\d]/g, ""))}
                        placeholder="数量"
                        value={buyOrderQuantity}
                      />
                    </label>
                    {buyPriceVal > 0 && (
                      <span className="text-[8px] text-slate-600">需{formatNumber(buyTotalCost, locale)}</span>
                    )}
                    <button
                      className="shrink-0 rounded bg-emerald-600 px-2 py-1 text-[9px] font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!isRealtimeReady || status === "saving" || buyPriceVal <= 0 || Number(buyOrderQuantity) <= 0 || (role && role.gold < buyTotalCost)}
                      onClick={() => {
                        void onCreateBuyOrder(selectedItem.itemId, buyPriceVal, Number(buyOrderQuantity)).then(() => { setBuyOrderPrice(""); setBuyOrderQuantity("1"); }).catch(() => {});
                      }}
                      type="button"
                    >
                      {status === "saving" ? "…" : "挂买"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })() : uniqueItems.length > 0 ? (
            /* Level 1: Item grid */
            <div className="grid grid-cols-2 gap-1.5 min-[480px]:grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {uniqueItems.map((item) => {
                const MarketIcon = getGameIconByKey(null, getItemTypeFallbackIconKey(item.categoryKey as BackpackItem["itemType"]));
                return (
                  <button
                    key={item.itemId}
                    className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all hover:border-white/15 ${marketItemCardAccent(item.rarity)}`}
                    onClick={() => setMarketSelectedItemId(item.itemId)}
                    type="button"
                  >
                    {/* Icon area */}
                    <div className="flex items-center justify-center py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117] text-slate-200">
                        <MarketIcon className="h-5 w-5" />
                      </div>
                    </div>
                    {/* Info area */}
                    <div className="border-t border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-[11px] font-semibold text-white">{localizeItemName(item.itemId, item.name, locale)}</p>
                        <span className={`shrink-0 text-[8px] font-medium ${rarityTextMap[item.rarity] ?? "text-slate-400"}`}>{rarityLabel(item.rarity, messages)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[9px] text-slate-500">{formatStatsSummary(item.stats, locale, messages)}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold tabular-nums text-amber-300">{formatNumber(item.lowestPrice, locale)}</span>
                        <span className="text-[9px] text-slate-500">×{formatNumber(item.totalCount, locale)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6">
              <GiShop className="mb-2 h-6 w-6 text-slate-700" />
              <p className="text-xs text-slate-500">{copy.market.empty}</p>
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
        <div className="flex items-center gap-2 border-b border-[#30363d] px-2.5 py-1.5 sm:px-3">
          <span className="text-xs font-medium text-white">{isPvpBattle ? copy.dashboard.pvpBattleTitle : copy.dashboard.battleTitle}</span>
          <span className="text-[10px] text-slate-500">{battleStatusCopy}</span>
          <span className="text-[10px] text-slate-600">·</span>
          <span className="text-[10px] text-slate-500">T{formatNumber(activeBattle.turnCount, locale)}</span>
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

  const isAfkActive = snapshot.afk.status === "active";

  return (
    <SectionCard className={["flex flex-col overflow-hidden xl:h-full xl:min-h-0", isAfkActive ? "min-h-0" : "min-h-[24rem]"].join(" ")}>
      {/* Header — single compact row */}
      <div className="flex items-center gap-2 border-b border-[#30363d] px-2.5 py-1.5 sm:px-3">
        <span className="shrink-0 text-xs font-medium text-white">
          {selectedActivity?.label ?? copy.dashboard.afkTitle}
          {selectedMap ? ` · ${localizeMapLabel(selectedMap.key, selectedMap.label, locale)}` : ""}
        </span>
        <div className="min-w-0 flex-1">
          <TopStatusBar
            className="border-none bg-transparent p-0"
            barClassName="h-1.5"
            label=""
            tone="from-sky-400 via-cyan-300 to-emerald-300"
            value={taskProgressPercent}
          />
        </div>
        {isAfkActive ? (
          <button
            className="shrink-0 rounded border border-rose-800/50 bg-rose-900/20 px-2 py-0.5 text-[10px] font-medium text-rose-300 transition hover:bg-rose-900/40 disabled:opacity-40"
            disabled={status === "saving" || !isRealtimeReady || Boolean(activeBattle)}
            onClick={() => void stopAfk().catch(() => { })}
            type="button"
          >
            {status === "saving" ? messages.common.submit : copy.dashboard.stopAfk}
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Activity & map selection — only visible when idle */}
        {!isAfkActive ? (
          <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
            {/* Activity tabs — segmented style */}
            <div className="mb-2.5 flex gap-0.5 rounded-md border border-[#30363d] bg-[#0d1117] p-0.5">
              {activities.map((activity) => (
                <button
                  key={activity.key}
                  className={[
                    "relative flex-1 shrink-0 rounded px-2 py-1 text-[10px] font-medium transition-all",
                    selectedActivityKey === activity.key
                      ? "bg-sky-500/15 text-sky-300 shadow-[inset_0_1px_0_rgba(56,189,248,0.1)]"
                      : "text-slate-500 hover:text-slate-300",
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

            {/* Map cards */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {maps
                .filter((map) => map.activityKey === selectedActivityKey)
                .map((map) => {
                  const isUnlocked = role.level >= map.minLevel;
                  const isSelected = map.key === selectedMapKey;
                  return (
                    <button
                      key={map.key}
                      className={[
                        "group relative flex flex-col justify-between overflow-hidden rounded-lg border text-left transition-all",
                        isSelected
                          ? "border-sky-500/40 bg-linear-to-br from-sky-950/40 via-[#0d1117] to-cyan-950/30 shadow-[0_0_20px_rgba(56,189,248,0.06)]"
                          : "border-[#30363d] bg-[#0d1117] hover:border-[#484f58] hover:bg-[#11161d]",
                        !isUnlocked && "opacity-40",
                      ].join(" ")}
                      disabled={!isUnlocked}
                      onClick={() => selectMap(map.key)}
                      type="button"
                    >
                      {/* Selected glow accent */}
                      {isSelected && <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-400/60 to-transparent" />}

                      <div className="p-2 sm:p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white">{localizeMapLabel(map.key, map.label, locale)}</p>
                          {isSelected && <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">{map.summary}</p>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/[0.04] bg-white/[0.02] px-2 py-1 sm:px-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${isUnlocked ? "text-emerald-400" : "text-amber-400"}`}>
                          {isUnlocked ? null : (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          )}
                          Lv.{map.minLevel}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-300/70">
                          <span className="text-amber-400/50">💰</span>
                          {formatDecimal(map.goldPerMinute, locale)}/分
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Start button — floating at bottom */}
            <div className="mt-3">
              {maps
                .filter((map) => map.key === selectedMapKey)
                .map((map) => (
                  <CommandButton
                    key={map.key}
                    disabled={status === "saving" || !isRealtimeReady || role.level < map.minLevel}
                    onClick={() => void startAfk().catch(() => { })}
                    tone="primary"
                  >
                    {status === "saving" ? messages.common.submit : copy.dashboard.startAfk}
                  </CommandButton>
                ))}
            </div>
          </div>
        ) : null}

        {/* Battle & encounter log — only when active */}
        {isAfkActive ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#30363d] bg-[#0d1117] px-2.5 py-2 sm:px-3 sm:py-2.5">
            {/* Battle logs */}
            {(snapshot.afk.battle?.logs ?? []).length > 0 ? (
              <div className="mb-2">
                <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-600">{copy.dashboard.battleLog}</p>
                <div className="space-y-px font-mono text-[11px]">
                  {(snapshot.afk.battle?.logs ?? []).map((log) => (
                    <div key={log.id} className="py-px leading-5">
                      <span className="mr-1 text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className={
                        log.type === "result" ? "text-emerald-400"
                          : log.type === "penalty" ? "text-rose-400"
                            : log.type === "guard" ? "text-amber-400"
                              : log.type === "spell" ? "text-fuchsia-400"
                                : log.type === "dot" ? "text-rose-300"
                                  : log.type === "reward" || log.type === "drop" ? "text-emerald-300"
                                    : "text-sky-300"
                      }>
                        {log.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Encounter logs */}
            {(snapshot.afk.recentEncounters ?? []).length > 0 ? (
              <div>
                <p className="mb-1 text-[9px] uppercase tracking-wider text-slate-600">{copy.dashboard.encounterLogEyebrow}</p>
                <div className="space-y-px font-mono text-[11px]">
                  {(snapshot.afk.recentEncounters ?? []).map((enc) => (
                    <div key={enc.id} className="py-px leading-5">
                      <span className="mr-1 text-[10px] text-slate-600">{new Date(enc.triggeredAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className={enc.tier === "legendary" ? "text-amber-300" : enc.tier === "rare" ? "text-amber-400/80" : "text-slate-300"}>
                        {enc.title} — {enc.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(snapshot.afk.battle?.logs ?? []).length === 0 && (snapshot.afk.recentEncounters ?? []).length === 0 ? (
              <p className="py-3 text-center text-[11px] text-slate-600">暂无记录</p>
            ) : null}
          </div>
        ) : null}

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
    createBuyOrder,
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
    <main className="relative min-h-screen min-w-0 px-2 py-2 text-slate-100 sm:px-3 sm:py-3 md:px-4 md:py-4 xl:h-[100svh] xl:overflow-hidden">
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

      <div className="mx-auto flex max-w-[1680px] flex-col gap-2 sm:gap-2.5 xl:h-full xl:overflow-hidden">
        {/* ── Compact Header Bar ── */}
        <SectionCard className="game-panel-accent overflow-hidden">
          <div className="flex items-center gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/[0.25] bg-linear-to-br from-cyan-300/[0.16] via-emerald-300/10 to-amber-300/10 text-[10px] font-bold text-cyan-200 sm:h-8 sm:w-8">
              {role.avatarSeed}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="min-w-0 break-words text-xs font-semibold leading-tight text-white sm:truncate">{role.name}</span>
                <StatusChip tone={activeBattle ? "warning" : snapshot.afk.status === "active" ? "emerald" : "neutral"}>
                  {activeBattle ? messages.common.fighting : snapshot.afk.status === "active" ? copy.dashboard.menu.afk.running : messages.common.idle}
                </StatusChip>
                <span className="text-[10px] text-slate-500">Lv.{role.level}</span>
                <span className="hidden text-[10px] text-slate-600 sm:inline">·</span>
                <span className="hidden text-[10px] text-slate-500 sm:inline">{localizeRaceLabel(role.raceKey, snapshot.config.races.find((item) => item.key === role.raceKey)?.label ?? role.raceKey, locale)} · {localizeClassLabel(role.classKey, snapshot.config.classes.find((item) => item.key === role.classKey)?.label ?? role.classKey, locale)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[10px]">
              <span className="rounded bg-amber-300/10 px-1.5 py-0.5 font-medium tabular-nums text-amber-200">💰{formatNumber(role.gold, locale)}</span>
              <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 font-medium tabular-nums text-cyan-200">💎{formatNumber(role.aetherCrystal, locale)}</span>
              <span className="hidden rounded bg-emerald-300/10 px-1.5 py-0.5 font-medium tabular-nums text-emerald-200 sm:inline">✦{formatNumber(role.exp, locale)}</span>
            </div>
            {isGuestUser ? (
              <button
                className="hidden min-h-6 shrink-0 rounded border border-white/10 bg-white/[0.055] px-2 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-cyan-200/[0.30] hover:bg-cyan-200/10 hover:text-white lg:inline"
                disabled={status === "saving"}
                onClick={() => setShowRegisterAccountModal(true)}
                type="button"
              >
                {copy.dashboard.registerAccount}
              </button>
            ) : null}
          </div>
          {/* Level progress — embedded in header */}
          <div className="px-3 pb-1 sm:px-4 sm:pb-1.5">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-slate-600">
              <span>{copy.dashboard.levelBar}</span>
              <span>{progressCopy}</span>
            </div>
            <div className="progress-shine mt-0.5 h-1 overflow-hidden rounded-full bg-[#21262d]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 transition-[width] duration-500 ease-out"
                style={{ width: `${role.nextLevelExp > 0 ? Math.max(0, Math.min(100, (role.currentLevelExp / role.nextLevelExp) * 100)) : 100}%` }}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Navigation ── */}
        <SectionCard className="overflow-hidden p-1 sm:p-1.5">
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
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

        {/* ── Main Content Area ── */}
        {/* Mobile/Tablet: stacked; Desktop: 3-column with chat sidebar */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-2.5 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem]">
          <CenterPanel
            activePanel={activePanel}
            backpack={backpack}
            isRealtimeReady={isRealtimeReady}
            activities={snapshot.config.activities}
            maps={maps}
            onCreateBuyOrder={(itemId, price, quantity) =>
              createBuyOrder(itemId, price, quantity)
            }
            onCreateMarketListing={(backpackId, price, quantity) =>
              createMarketListing(backpackId, price, quantity)
            }
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
            taskProgressPercent={taskProgressPercent}
          />
          {/* Desktop: chat sidebar; Mobile: below main content */}
          <div className="xl:min-h-0">
            <Chat />
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
