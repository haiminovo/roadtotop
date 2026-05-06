'use client';

import { useEffect, useMemo, useRef, useState } from "react";
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

type I18nMessages = ReturnType<typeof getMessages>;
const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
const DEFAULT_MESSAGES = getMessages(DEFAULT_LOCALE);
const BATTLE_ATTACK_DAMAGE_MULTIPLIER = 2;
const BATTLE_SPELL_DAMAGE_MULTIPLIER = 2.5;
const BATTLE_PLAYER_GUARD_HEAL_RATIO = 0.18;
const BATTLE_ENEMY_GUARD_HEAL_RATIO = 0.08;
const BATTLE_PLAYER_GUARD_REDUCTION_RATIO = 0.45;
const BATTLE_ENEMY_GUARD_REDUCTION_RATIO = 0.35;
const BATTLE_PLAYER_GUARD_COOLDOWN_TURNS = 2;
const BATTLE_ENEMY_GUARD_COOLDOWN_TURNS = 3;
const BATTLE_SPELL_HIGH_INTELLIGENCE_THRESHOLD = 12;
const BATTLE_HIGH_INTELLIGENCE_SPELL_CHANCE = 0.7;
const BATTLE_DEFAULT_SPELL_CHANCE = 0.35;

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

function formatMarketListingStatus(status: "active" | "sold" | "cancelled", messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.game.market.status[status];
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

function calculateBattlePhysicalDamagePreview(strength: number) {
  return Math.max(1, Math.round(Math.max(0, Number(strength) || 0) * BATTLE_ATTACK_DAMAGE_MULTIPLIER));
}

function calculateBattleSpellDamagePreview(intelligence: number) {
  return Math.max(1, Math.round(Math.max(0, Number(intelligence) || 0) * BATTLE_SPELL_DAMAGE_MULTIPLIER));
}

function calculateBattleGuardHealPreview(maxHealth: number, side: "player" | "enemy") {
  const safeHealth = Math.max(0, Number(maxHealth) || 0);
  return side === "player"
    ? Math.max(10, Math.round(safeHealth * BATTLE_PLAYER_GUARD_HEAL_RATIO))
    : Math.max(8, Math.round(safeHealth * BATTLE_ENEMY_GUARD_HEAL_RATIO));
}

function calculateBattleGuardReductionPreview(side: "player" | "enemy") {
  return side === "player" ? BATTLE_PLAYER_GUARD_REDUCTION_RATIO : BATTLE_ENEMY_GUARD_REDUCTION_RATIO;
}

function calculateBattleSpellChancePreview(intelligence: number) {
  return intelligence >= BATTLE_SPELL_HIGH_INTELLIGENCE_THRESHOLD
    ? BATTLE_HIGH_INTELLIGENCE_SPELL_CHANCE
    : BATTLE_DEFAULT_SPELL_CHANCE;
}

function slotLabel(slot: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.slots[slot as keyof I18nMessages["slots"]] ?? slot;
}

function statLabel(statKey: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.stats[statKey as keyof I18nMessages["stats"]] ?? statKey;
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

function panelAccent(panel: PanelKey) {
  return {
    afk: "from-sky-400/60 to-cyan-300/10",
    backpack: "from-violet-400/55 to-indigo-300/10",
    market: "from-amber-300/60 to-orange-300/10",
    role: "from-emerald-400/55 to-teal-300/10",
  }[panel];
}

function itemGlyph(name: string) {
  return name.slice(0, 1).toUpperCase();
}

const EMPTY_BACKPACK: Array<{
  backpackId: string;
  itemId: string;
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
type ItemActionKey = "drop" | "equip" | "unequip" | "sell";
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

  if (item.quantity > equippedCount) {
    actions.push(getItemActionDefinition("equip", messages));
  }

  if (equippedCount > 0) {
    actions.push(getItemActionDefinition("unequip", messages));
  }

  if (equippedCount === 0 && item.quantity > 0) {
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
        "rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,23,40,0.96),rgba(11,16,30,0.98))]",
        "shadow-[0_12px_36px_rgba(0,0,0,0.22)]",
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/72 px-4">
      <div className="w-full max-w-lg rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
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
  return (
    <div className={className}>
      <div className={`mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] ${labelClassName}`}>
        <span>{label}</span>
        <span>{valueLabel ?? `${Math.max(0, Math.floor(value))}%`}</span>
      </div>
      <div className={`${barClassName} overflow-hidden rounded-full bg-slate-950/90`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function DataPill({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className={["rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-2", className].join(" ")}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-white">{value}</p>
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
    <div className="flex items-center justify-between gap-3 rounded-[0.85rem] border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
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
      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+0.45rem)] z-20 hidden w-56 -translate-x-1/2 rounded-[0.95rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.38)] group-hover:block">
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
  const attackDamage = calculateBattlePhysicalDamagePreview(combatant.stats.strength);
  const spellDamage = calculateBattleSpellDamagePreview(combatant.stats.intelligence);
  const guardHeal = calculateBattleGuardHealPreview(combatant.maxHealth, side);
  const guardReduction = calculateBattleGuardReductionPreview(side);
  const spellChance = calculateBattleSpellChancePreview(combatant.stats.intelligence);
  const guardRemaining = side === "player" ? copy.skillUnlimited : formatNumber(combatant.skillUsesRemaining.guard, locale);
  const spellRemaining = side === "player" ? copy.skillUnlimited : formatNumber(combatant.skillUsesRemaining.spell, locale);
  const spellStatus = side === "player"
    ? formatMessage(copy.skillChanceValue, { chance: formatPercentValue(spellChance, locale) })
    : formatMessage(copy.skillRemainingValue, { count: spellRemaining });
  const attackStatus = formatMessage(copy.skillDamageShortValue, { amount: formatNumber(attackDamage, locale) });
  const guardStatusText = combatant.defenseTurns > 0 ? copy.skillActive : copy.skillReady;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <SkillSlot
          badge="ATK"
          body={formatMessage(copy.skillAttackDetail, {
            agility: formatPercentValue(Math.max(0, Math.min(0.75, combatant.stats.agility / 50)), locale),
            damage: formatNumber(attackDamage, locale),
            strength: formatNumber(combatant.stats.strength, locale),
          })}
          meta={copy.skillAttackMeta}
          status={attackStatus}
          title={copy.skillAttackShort}
          toneClassName="border-white/10 bg-slate-950/30 hover:border-sky-300/30"
        />
        <SkillSlot
          badge="SP"
          body={formatMessage(copy.skillSpellDetail, {
            chance: formatPercentValue(spellChance, locale),
            damage: formatNumber(spellDamage, locale),
            intelligence: formatNumber(combatant.stats.intelligence, locale),
            remaining: spellRemaining,
          })}
          meta={copy.skillSpellMeta}
          status={spellStatus}
          title={copy.skillSpellShort}
          toneClassName="border-fuchsia-300/18 bg-fuchsia-300/[0.08] hover:border-fuchsia-300/35"
        />
        <SkillSlot
          badge="DEF"
          body={formatMessage(copy.skillGuardDetail, {
            cooldown: formatNumber(side === "player" ? BATTLE_PLAYER_GUARD_COOLDOWN_TURNS : BATTLE_ENEMY_GUARD_COOLDOWN_TURNS, locale),
            heal: formatNumber(guardHeal, locale),
            reduction: formatPercentValue(guardReduction, locale),
            remaining: guardRemaining,
          })}
          meta={copy.skillGuardMeta}
          status={guardStatusText}
          title={copy.skillGuardShort}
          toneClassName="border-amber-300/18 bg-amber-300/[0.08] hover:border-amber-300/35"
        />
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
        "w-full rounded-[1rem] border px-4 py-3 text-left transition",
        active
          ? "border-sky-300/45 bg-sky-300/12 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]"
          : "border-white/8 bg-white/[0.03] hover:border-sky-200/30",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        {count ? (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-sky-100">
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
  glyph,
  itemName,
  onClick,
  quantity,
  rarity,
}: {
  active: boolean;
  equippedCount: number;
  glyph: string;
  itemName: string;
  onClick: () => void;
  quantity: number;
  rarity: string;
}) {
  const { messages } = useI18n();

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
      <div className="flex min-h-0 flex-1 flex-col">
        <span className="text-lg font-semibold">{glyph}</span>
        <span className="mt-auto pr-10 text-xs font-medium leading-5 text-white/72">
          {itemName}
        </span>
      </div>
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
    <main className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,#25336f_0%,#11173a_36%,#050716_100%)] px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard className="overflow-hidden px-6 py-7 md:px-8">
          <SectionEyebrow>{copy.landing.eyebrow}</SectionEyebrow>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              [copy.landing.cards.server.title, copy.landing.cards.server.summary],
              [copy.landing.cards.offline.title, copy.landing.cards.offline.summary],
              [copy.landing.cards.backpack.title, copy.landing.cards.backpack.summary],
            ].map(([title, summary]) => (
              <div key={title} className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-100/55">{title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="px-6 py-7">
          <SectionEyebrow>{copy.landing.access}</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{copy.landing.title}</h2>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              className={[
                "rounded-[0.95rem] border px-4 py-3 text-sm font-semibold transition",
                loginMode === "guest"
                  ? "border-sky-300/45 bg-sky-300/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-300",
              ].join(" ")}
              onClick={() => setLoginMode("guest")}
              type="button"
            >
              {copy.landing.guestLogin}
            </button>
            <button
              className={[
                "rounded-[0.95rem] border px-4 py-3 text-sm font-semibold transition",
                loginMode === "account"
                  ? "border-emerald-300/45 bg-emerald-300/12 text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-300",
              ].join(" ")}
              onClick={() => setLoginMode("account")}
              type="button"
            >
              {copy.landing.accountLogin}
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
    <main className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,#283365_0%,#101533_40%,#050716_100%)] px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard className="px-6 py-7 md:px-8">
          <SectionEyebrow>{copy.createRole.setup}</SectionEyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">{copy.createRole.title}</h1>

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
                      ? "border-sky-300/45 bg-sky-300/10"
                      : "border-white/8 bg-white/[0.03] hover:border-sky-200/25",
                  ].join(" ")}
                  onClick={() => setRaceKey(race.key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">{localizeRaceLabel(race.key, race.label, locale)}</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                      {race.key}
                    </span>
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
                      ? "border-emerald-300/45 bg-emerald-300/10"
                      : "border-white/8 bg-white/[0.03] hover:border-emerald-200/25",
                  ].join(" ")}
                  onClick={() => setClassKey(roleClass.key)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">{localizeClassLabel(roleClass.key, roleClass.label, locale)}</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                      {roleClass.key}
                    </span>
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

        <SectionCard className="px-6 py-7">
          <SectionEyebrow>{copy.createRole.preview}</SectionEyebrow>
          <div className="mt-4 rounded-[1rem] border border-white/8 bg-white/[0.035] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100/55">{copy.createRole.currentBuild}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{name || copy.createRole.unnamed}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {(selectedRace ? localizeRaceLabel(selectedRace.key, selectedRace.label, locale) : copy.createRole.noRace)} / {(selectedClass ? localizeClassLabel(selectedClass.key, selectedClass.label, locale) : copy.createRole.noClass)}
            </p>
          </div>

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

function BackpackOverview({
  backpack,
}: {
  backpack: BackpackItem[];
}) {
  const { locale, messages } = useI18n();
  const groupedBySlot = backpack.reduce<Record<string, number>>((accumulator, item) => {
    const nextValue = accumulator[item.slot] ?? 0;
    accumulator[item.slot] = nextValue + item.quantity;
    return accumulator;
  }, {});

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(groupedBySlot).map(([slot, quantity]) => (
        <div key={slot} className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{slotLabel(slot, messages)}</p>
          <p className="mt-1 text-lg font-semibold text-white">{formatNumber(quantity, locale)}</p>
        </div>
      ))}
    </div>
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
  const groupedItems = backpack.reduce<Record<string, BackpackItem[]>>((accumulator, item) => {
    const current = accumulator[item.slot] ?? [];
    current.push(item);
    accumulator[item.slot] = current;
    return accumulator;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedItems).map(([slot, items]) => (
        <div key={slot}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{slotLabel(slot, messages)}</p>
            <span className="text-[11px] text-slate-500">{formatNumber(items.length, locale)} {messages.common.speciesUnit}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {items.map((item) => (
              <ItemTile
                key={item.backpackId}
                active={selectedBackpackId === item.backpackId}
                equippedCount={item.equippedCount ?? 0}
                glyph={itemGlyph(localizeItemName(item.itemId, item.name, locale))}
                itemName={localizeItemName(item.itemId, item.name, locale)}
                onClick={() => onSelectItem(item.backpackId)}
                quantity={item.quantity}
                rarity={item.rarity}
              />
            ))}
          </div>
        </div>
      ))}
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
  onUnequipItem,
  onSelectItem,
  role,
  selectedBackpackId,
  selectedMapKey,
  selectMap,
  snapshot,
  status,
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
  onUnequipItem: (backpackId: string) => void;
  onSelectItem: (backpackId: string) => void;
  role: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["role"];
  selectedBackpackId: string | null;
  selectedMapKey: MapKey;
  selectMap: (mapKey: MapKey) => void;
  snapshot: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>;
  status: ReturnType<typeof useGameSession>["status"];
  taskDuration: number;
  taskProgress: number;
  taskProgressPercent: number;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.game;
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<"all" | "equipment">("equipment");
  const [marketRarityFilter, setMarketRarityFilter] = useState<"all" | "white" | "green" | "blue" | "purple" | "orange">("all");
  const [marketSlotFilter, setMarketSlotFilter] = useState<"all" | BodySlotType>("all");
  if (!role) {
    return null;
  }

  if (activePanel === "backpack") {
    return (
        <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="border-b border-white/8 px-4 py-3">
            <SectionEyebrow>{copy.dashboard.inventory}</SectionEyebrow>
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.dashboard.backpackTitle}</h2>
              </div>
              <div className="flex gap-2">
                <DataPill label={copy.dashboard.inventoryCount} value={formatNumber(backpack.length, locale)} />
                <DataPill
                label={copy.dashboard.equippedCount}
                value={formatNumber(backpack.reduce((total, item) => total + (item.equippedCount ?? 0), 0), locale)}
              />
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

    return (
      <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3">
          <SectionEyebrow>{copy.dashboard.characterSheet}</SectionEyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">{copy.dashboard.roleTitle}</h2>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
            <p className="text-2xl font-semibold text-white">{role.name}</p>
            <p className="mt-2 text-sm text-slate-300">
              {race ? localizeRaceLabel(race.key, race.label, locale) : copy.createRole.noRace} / {roleClass ? localizeClassLabel(roleClass.key, roleClass.label, locale) : copy.createRole.noClass}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{race ? localizeRaceSummary(race.key, race.summary, locale) : ""}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{roleClass ? localizeClassSummary(roleClass.key, roleClass.summary, locale) : ""}</p>
          </div>

          <div className="rounded-[1rem] border border-rose-300/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(15,23,42,0.18))] p-4">
            <TopStatusBar
              label={copy.dashboard.healthStatus}
              tone="from-rose-500 via-orange-400 to-emerald-300"
              value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DataPill label={copy.dashboard.currentHealth} value={`${formatNumber(role.currentHealth, locale)} / ${formatNumber(role.maxHealth, locale)}`} />
              <DataPill label={copy.dashboard.deathPenalty} value={copy.dashboard.deathPenaltyValue} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DataPill label={copy.dashboard.level} value={formatNumber(role.level, locale)} />
            <DataPill label={copy.dashboard.exp} value={formatNumber(role.exp, locale)} />
            <DataPill label={copy.dashboard.maxHealth} value={formatNumber(role.maxHealth, locale)} />
            <DataPill label={statLabel("strength", messages)} value={formatNumber(role.stats.strength, locale)} />
            <DataPill label={statLabel("agility", messages)} value={formatNumber(role.stats.agility, locale)} />
            <DataPill label={statLabel("intelligence", messages)} value={formatNumber(role.stats.intelligence, locale)} />
            <DataPill label={statLabel("vitality", messages)} value={formatNumber(role.stats.vitality, locale)} />
          </div>

          <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4 xl:col-span-2">
            <SectionEyebrow>{copy.dashboard.bodySlots}</SectionEyebrow>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bodySlots.map((slot) => (
                <div key={slot.key} className="rounded-[0.95rem] border border-white/8 bg-slate-950/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{bodySlotKeyLabel(slot.key, messages)}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{slot.item ? localizeItemName(slot.item.itemId, slot.item.name, locale) : copy.dashboard.emptySlot}</p>
                  <p className="mt-1 text-xs text-slate-400">{slot.item ? rarityLabel(slot.item.rarity, messages) : slotLabel(slot.slotType, messages)}</p>
                  {slot.item ? (
                    <button
                      className="mt-3 rounded-[0.75rem] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 transition hover:border-sky-200/25 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
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
      <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3">
          <SectionEyebrow>{copy.market.eyebrow}</SectionEyebrow>
          <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.market.title}</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <FilterSelect
                label={copy.market.filters.category}
                onChange={(event) => setMarketCategoryFilter(event.target.value as "all" | "equipment")}
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
                <div key={listing.listingId} className="rounded-[1rem] border border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(15,23,42,0.24))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{localizeItemName(listing.itemId, listing.name, locale)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-100/70">
                        {slotLabel(listing.slot, messages)} · {rarityLabel(listing.rarity, messages)}
                      </p>
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

  const activeBattle = snapshot.afk.battle?.active ? snapshot.afk.battle : null;
  const battleStatusCopy = activeBattle
    ? copy.dashboard.battleOngoing
    : snapshot.afk.battle?.winner === "player"
      ? copy.dashboard.battleVictory
      : snapshot.afk.battle?.winner === "enemy"
        ? copy.dashboard.battleDefeat
        : messages.common.idle;

  return (
    <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-white/8 px-4 py-2.5">
        <SectionEyebrow>{copy.dashboard.afkControl}</SectionEyebrow>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.35rem] font-semibold tracking-[-0.04em] text-white">{copy.dashboard.afkTitle}</h2>
          </div>
          <div className="flex gap-2">
            <DataPill label={copy.dashboard.cycle} value={formatClock(taskDuration)} />
            <DataPill
              label={copy.dashboard.currentRound}
              value={activeBattle ? copy.dashboard.battlePausedShort : `${formatClock(taskProgress)} / ${formatClock(taskDuration)}`}
            />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-3 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[1rem] border border-sky-300/25 bg-sky-300/8 p-3">
          {activeBattle ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{copy.dashboard.battleTitle}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <DataPill label={copy.dashboard.battleStatus} value={battleStatusCopy} />
                  <DataPill label={copy.dashboard.battleTurns} value={formatNumber(activeBattle.turnCount, locale)} />
                </div>
              </div>

              <div className="mt-3 grid gap-2 xl:grid-cols-2">
                <div className="rounded-[1rem] border border-emerald-300/20 bg-emerald-300/8 p-3">
                  <SectionEyebrow>{copy.dashboard.selfInfo}</SectionEyebrow>
                  <p className="mt-1.5 text-base font-semibold text-white">{activeBattle.player.name}</p>
                  <div className="mt-2.5">
                    <TopStatusBar
                      label={copy.dashboard.lifeBar}
                      tone="from-emerald-400 via-cyan-300 to-sky-300"
                      valueLabel={`${formatNumber(activeBattle.player.currentHealth, locale)} / ${formatNumber(activeBattle.player.maxHealth, locale)}`}
                      value={(activeBattle.player.currentHealth / Math.max(1, activeBattle.player.maxHealth)) * 100}
                    />
                  </div>
                  <div className="mt-2.5">
                    <TopStatusBar
                      barClassName="h-2.5"
                      label={copy.dashboard.actionBar}
                      tone="from-sky-400 via-cyan-300 to-teal-300"
                      value={activeBattle.player.actionBar}
                    />
                  </div>
                  <div className="mt-3">
                    <BattleSkillSlots combatant={activeBattle.player} side="player" />
                  </div>
                </div>

                <div className="rounded-[1rem] border border-rose-300/20 bg-rose-300/8 p-3">
                  <SectionEyebrow>{copy.dashboard.enemyInfo}</SectionEyebrow>
                  <p className="mt-1.5 text-base font-semibold text-white">{activeBattle.enemy.name}</p>
                  <div className="mt-2.5">
                    <TopStatusBar
                      label={copy.dashboard.lifeBar}
                      tone="from-rose-500 via-orange-400 to-amber-300"
                      valueLabel={`${formatNumber(activeBattle.enemy.currentHealth, locale)} / ${formatNumber(activeBattle.enemy.maxHealth, locale)}`}
                      value={(activeBattle.enemy.currentHealth / Math.max(1, activeBattle.enemy.maxHealth)) * 100}
                    />
                  </div>
                  <div className="mt-2.5">
                    <TopStatusBar
                      barClassName="h-2.5"
                      label={copy.dashboard.actionBar}
                      tone="from-amber-300 via-orange-300 to-rose-300"
                      value={activeBattle.enemy.actionBar}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <DataPill label={copy.dashboard.enemyLevel} value={formatNumber(activeBattle.enemy.level, locale)} />
                    <DataPill label={copy.dashboard.defenseActive} value={activeBattle.enemy.defenseTurns > 0 ? messages.common.now : messages.common.idle} />
                  </div>
                  <div className="mt-3">
                    <BattleSkillSlots combatant={activeBattle.enemy} side="enemy" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            maps
              .filter((map) => map.key === selectedMapKey)
              .map((map) => (
                <div key={map.key}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{localizeMapLabel(map.key, map.label, locale)}</p>
                    </div>
                    <button
                      className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300"
                      onClick={() => selectMap(map.key)}
                      type="button"
                    >
                      {copy.dashboard.currentMapButton}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <DataPill label={copy.dashboard.goldPerMinute} value={formatDecimal(map.goldPerMinute, locale)} />
                    <DataPill label={copy.dashboard.aetherPerMinute} value={formatDecimal(map.aetherPerMinute, locale)} />
                    <DataPill label={copy.dashboard.expPerMinute} value={formatDecimal(map.expPerMinute, locale)} />
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-3">
          <TopStatusBar
            label={copy.dashboard.executionProgress}
            tone="from-sky-400 via-cyan-300 to-emerald-300"
            value={activeBattle ? 0 : taskProgressPercent}
          />
          <div className="mt-3 grid gap-2">
            <InlineStat label={copy.dashboard.status} value={activeBattle ? messages.common.fighting : snapshot.afk.status === "active" ? messages.common.active : messages.common.idle} />
            <InlineStat label={copy.dashboard.remaining} value={activeBattle ? copy.dashboard.battlePausedShort : formatDuration(Math.max(0, taskDuration - taskProgress))} />
            <InlineStat label={copy.dashboard.executed} value={activeBattle ? formatNumber(activeBattle.turnCount, locale) : formatDuration(taskProgress)} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <InlineStat label={copy.dashboard.roundGold} value={formatNumber(currentTaskReward.gold, locale)} />
            <InlineStat label={copy.dashboard.roundAether} value={formatNumber(currentTaskReward.aetherCrystal, locale)} />
            <InlineStat label={copy.dashboard.roundExp} value={formatNumber(currentTaskReward.exp, locale)} />
          </div>
        </div>

      </div>
    </SectionCard>
  );
}

function RightRail({
  activePanel,
  backpack,
  isRealtimeReady,
  onCancelMarketListing,
  onDismissMarketSoldNotification,
  pendingReward,
  selectedItem,
  snapshot,
}: {
  activePanel: PanelKey;
  backpack: BackpackItem[];
  isRealtimeReady: boolean;
  onCancelMarketListing: (listingId: string) => void;
  onDismissMarketSoldNotification: (listingId: string) => void;
  pendingReward: {
    aetherCrystal: number;
    exp: number;
    gold: number;
    seconds: number;
  };
  selectedItem: BackpackItem | undefined;
  snapshot: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.game;
  const equippedItems = backpack.filter((item) => item.equipped);

  return (
    <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${panelAccent(activePanel)}`} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">

        {activePanel === "backpack" ? (
          <>
            <div>
              <SectionEyebrow>{copy.dashboard.selectedItem}</SectionEyebrow>
              {selectedItem ? (
                <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{localizeItemName(selectedItem.itemId, selectedItem.name, locale)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {formatMessage(copy.dashboard.itemMeta, {
                          rarity: rarityLabel(selectedItem.rarity, messages),
                          slot: slotLabel(selectedItem.slot, messages),
                          slotUsage: selectedItem.slotUsage,
                        })}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-200">
                      x{selectedItem.quantity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeItemDescription(selectedItem.itemId, selectedItem.description, locale)}</p>
                  <p className="mt-3 text-xs leading-6 text-sky-100/75">{formatStatsSummary(selectedItem.stats, locale, messages)}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    {formatMessage(copy.dashboard.equippedSummary, {
                      count: formatNumber(selectedItem.equippedCount ?? 0, locale),
                      slots: formatEquippedGroupSummary(selectedItem.equippedSlotGroups, messages),
                    })}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">{messages.common.sellPrice} {formatNumber(selectedItem.sellPrice, locale)}</p>
                </div>
              ) : (
                <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] p-4 text-sm text-slate-400">
                  {copy.dashboard.selectedItemEmpty}
                </div>
              )}
            </div>

            <div>
              <SectionEyebrow>{copy.dashboard.overview}</SectionEyebrow>
              <div className="mt-3">
                <BackpackOverview backpack={backpack} />
              </div>
            </div>
          </>
        ) : activePanel === "role" ? (
          <div>
            <SectionEyebrow>{copy.dashboard.equippedItems}</SectionEyebrow>
            <div className="mt-3 space-y-3">
              {equippedItems.length > 0 ? equippedItems.map((item) => (
                <div key={item.backpackId} className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                  <p className="text-sm font-semibold text-white">{localizeItemName(item.itemId, item.name, locale)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{slotLabel(item.slot, messages)}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{formatEquippedGroupSummary(item.equippedSlotGroups, messages)}</p>
                  <p className="mt-2 text-xs leading-6 text-sky-100/75">{formatStatsSummary(item.stats, locale, messages)}</p>
                </div>
              )) : (
                <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4 text-sm text-slate-400">
                  {copy.dashboard.equippedNone}
                </div>
              )}
            </div>
          </div>
        ) : activePanel === "market" ? (
          <div>
            <SectionEyebrow>{copy.market.myListings}</SectionEyebrow>
            <div className="mt-3 space-y-3">
              {snapshot.market.myListings.length > 0 ? snapshot.market.myListings.map((listing) => (
                <div
                  key={listing.listingId}
                  className={[
                    "rounded-[1rem] border bg-white/[0.035] p-4",
                    listing.status === "sold"
                      ? "border-emerald-300/25 bg-emerald-300/[0.06]"
                      : "border-white/8",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{localizeItemName(listing.itemId, listing.name, locale)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {formatMarketListingStatus(listing.status, messages)} · x{formatNumber(listing.quantity, locale)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-200">
                      {formatNumber(listing.price, locale)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-sky-100/75">{formatStatsSummary(listing.stats, locale, messages)}</p>
                  {listing.status === "sold" ? (
                    <>
                      <p className="mt-2 text-xs text-emerald-200">
                        {formatMessage(copy.market.soldIncome, {
                          fee: formatNumber(listing.feeAmount, locale),
                          received: formatNumber(listing.sellerReceiveAmount, locale),
                        })}
                      </p>
                      <button
                        className="mt-3 w-full rounded-[0.85rem] border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!isRealtimeReady}
                        onClick={() => onDismissMarketSoldNotification(listing.listingId)}
                        type="button"
                      >
                        {copy.market.dismissSoldNotice}
                      </button>
                    </>
                  ) : null}
                  {listing.status === "active" ? (
                    <button
                      className="mt-3 w-full rounded-[0.85rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white transition hover:border-amber-200/30 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!isRealtimeReady || snapshot.market.myListings.length <= 0}
                      onClick={() => onCancelMarketListing(listing.listingId)}
                      type="button"
                    >
                      {copy.market.cancelListing}
                    </button>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
                  {copy.market.noOwnListings}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <SectionEyebrow>{copy.dashboard.settlementSummary}</SectionEyebrow>
            <div className="mt-3 grid gap-2">
              <DataPill label={copy.dashboard.pendingGold} value={formatNumber(pendingReward.gold, locale)} />
              <DataPill label={copy.dashboard.pendingExp} value={formatNumber(pendingReward.exp, locale)} />
              <DataPill label={copy.dashboard.pendingAether} value={formatNumber(pendingReward.aetherCrystal, locale)} />
              <DataPill label={copy.dashboard.totalDuration} value={formatDuration(pendingReward.seconds)} />
              <DataPill
                label={copy.dashboard.estimatedHourlyReward}
                value={formatMessage(copy.dashboard.rewardGoldExp, {
                  exp: formatNumber(snapshot.afk.estimatedHourlyReward.exp, locale),
                  gold: formatNumber(snapshot.afk.estimatedHourlyReward.gold, locale),
                })}
              />
            </div>
          </div>
        )}
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
    cancelMarketListing,
    claimOfflineReward,
    createMarketListing,
    dropBackpackItem,
    deleteAccountRole,
    dismissMarketSoldNotification,
    dismissError,
    equipBackpackItem,
    error,
    registerAccount,
    isRealtimeReady,
    selectedMapKey,
    selectMap,
    setActivePanel,
    snapshot,
    startAfk,
    status,
    stopAfk,
    unequipBackpackItem,
  } = useGameSession();
  const [dismissedRewardKey, setDismissedRewardKey] = useState<string | null>(null);
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

  const pendingReward = snapshot?.afk.pendingReward;
  const shouldShowRewardModal =
    Boolean(snapshot?.role)
    && Boolean(pendingReward)
    && Boolean(snapshot?.afk.shouldShowOfflineRewardModal)
    && dismissedRewardKey !== JSON.stringify(pendingReward);

  useEffect(() => {
    if (!pendingReward) {
      setDismissedRewardKey(null);
      return;
    }

    const rewardKey = JSON.stringify(pendingReward);

    if (pendingReward.gold <= 0 && pendingReward.aetherCrystal <= 0 && pendingReward.exp <= 0) {
      setDismissedRewardKey(null);
      return;
    }

    if (dismissedRewardKey === null) {
      return;
    }

    if (dismissedRewardKey !== rewardKey) {
      setDismissedRewardKey(null);
    }
  }, [dismissedRewardKey, pendingReward]);

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

  const selectedItem = backpack.find((item) => item.backpackId === selectedBackpackId);
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
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#27326d_0%,#111630_34%,#050717_100%)] px-3 py-3 text-slate-100 md:px-4 md:py-4">
      {error ? (
        <div className="mx-auto mb-3 flex max-w-[1600px] items-center justify-between gap-4 rounded-[1rem] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          <span>{error}</span>
          <button className="rounded-lg bg-black/20 px-3 py-2" onClick={dismissError} type="button">
            {messages.common.close}
          </button>
        </div>
      ) : null}

      {shouldShowRewardModal ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/72 px-4">
          <div className="w-full max-w-2xl rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
            <SectionEyebrow>{copy.dashboard.afkSummary}</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">{copy.dashboard.offlineModalTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {copy.dashboard.offlineModalSummary}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <DataPill label={copy.dashboard.gold} value={formatNumber(pendingReward?.gold ?? 0, locale)} />
              <DataPill label={copy.dashboard.aetherCrystal} value={formatNumber(pendingReward?.aetherCrystal ?? 0, locale)} />
              <DataPill label={copy.dashboard.exp} value={formatNumber(pendingReward?.exp ?? 0, locale)} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-[1rem] bg-[linear-gradient(90deg,#60a5fa_0%,#34d399_100%)] px-4 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105"
                onClick={() => {
                  void claimOfflineReward().catch(() => {});
                }}
                type="button"
              >
                {copy.dashboard.receiveNow}
              </button>
              <button
                className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
                onClick={() => setDismissedRewardKey(JSON.stringify(pendingReward))}
                type="button"
              >
                {copy.dashboard.later}
              </button>
            </div>
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
              onClick={() => {
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
              type="button"
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
          <div className="mt-4 flex items-start gap-4">
            <div className={`flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1rem] border text-3xl font-semibold ${itemAccent(actionItem.rarity)}`}>
              {itemGlyph(localizeItemName(actionItem.itemId, actionItem.name, locale))}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-white">{localizeItemName(actionItem.itemId, actionItem.name, locale)}</h2>
              <p className="mt-2 text-sm text-slate-300">
                {formatMessage(copy.dashboard.actionItemMeta, {
                  equippedCount: actionItem.equippedCount ?? 0,
                  quantity: actionItem.quantity,
                  rarity: rarityLabel(actionItem.rarity, messages),
                  slot: slotLabel(actionItem.slot, messages),
                })}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{localizeItemDescription(actionItem.itemId, actionItem.description, locale)}</p>
              <p className="mt-3 text-xs leading-6 text-sky-100/75">{formatStatsSummary(actionItem.stats, locale, messages)}</p>
              <p className="mt-3 text-xs leading-6 text-slate-400">{formatMessage(copy.dashboard.occupiedSlots, { slots: formatEquippedGroupSummary(actionItem.equippedSlotGroups, messages) })}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {getAvailableItemActions(actionItem, messages).map((action) => (
              <button
                key={action.actionKey}
                className={[
                  "w-full rounded-[1rem] border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  action.tone === "danger"
                    ? "border-rose-300/30 bg-rose-300/10 text-rose-100 hover:bg-rose-300/18"
                    : "border-white/10 bg-white/[0.04] text-white hover:border-sky-200/25",
                ].join(" ")}
                disabled={isRealtimeActionDisabled}
                onClick={() => {
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
                <p className="mt-2 text-xs leading-6 text-current/75">{action.summary}</p>
              </button>
            ))}
            <button
              className="w-full rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              onClick={() => setItemActionBackpackId(null)}
              type="button"
            >
              {copy.dashboard.actionClose}
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {pendingActionItem && pendingActionDefinition && pendingItemAction?.actionKey === "drop" ? (
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
            <DataPill label={messages.common.type} value={slotLabel(pendingActionItem.slot, messages)} />
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
                || Number(marketSellPrice) <= 0
                || Number(marketSellQuantity) <= 0
                || Number(marketSellQuantity) > marketSellableQuantity
              }
              onClick={() => {
                void createMarketListing(marketSellItem.backpackId, Number(marketSellPrice), Number(marketSellQuantity)).then(() => {
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

      <div className="mx-auto flex h-full max-w-[1760px] flex-col gap-3 overflow-hidden">
        <SectionCard className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(49,62,121,0.95),rgba(12,16,34,0.98))]">
          <div className="px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_auto] xl:items-start">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/12 bg-white/[0.05] text-lg font-semibold text-sky-100">
                    {role.avatarSeed}
                  </div>
                  <div className="min-w-0">
                    <SectionEyebrow>{copy.dashboard.overview}</SectionEyebrow>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h1 className="text-[1.7rem] font-semibold leading-none tracking-[-0.04em] text-white">{role.name}</h1>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-100/70">
                        {messages.common.levelShort}{role.level}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-200/80">
                      {formatMessage(copy.dashboard.roleMeta, {
                        className: localizeClassLabel(role.classKey, snapshot.config.classes.find((item) => item.key === role.classKey)?.label ?? role.classKey, locale),
                        level: role.level,
                        race: localizeRaceLabel(role.raceKey, snapshot.config.races.find((item) => item.key === role.raceKey)?.label ?? role.raceKey, locale),
                      })}
                    </p>
                    <div className="mt-2.5">
                      <TopStatusBar
                        className="max-w-xl"
                        label={copy.dashboard.lifeBar}
                        tone="from-rose-500 via-orange-400 to-emerald-300"
                        value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
                  <DataPill className="py-1.5" label={copy.dashboard.gold} value={formatNumber(role.gold, locale)} />
                  <DataPill className="py-1.5" label={copy.dashboard.aetherCrystal} value={formatNumber(role.aetherCrystal, locale)} />
                  <DataPill className="py-1.5" label={copy.dashboard.exp} value={formatNumber(role.exp, locale)} />
                  <DataPill className="py-1.5" label={copy.dashboard.accountStatus} value={isAccountUser ? (snapshot.account.username ?? copy.dashboard.bound) : messages.common.guest} />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[308px] xl:grid-cols-2">
                  {isGuestUser ? (
                    <button
                      className="rounded-[0.95rem] border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={status === "saving"}
                      onClick={() => setShowRegisterAccountModal(true)}
                      type="button"
                    >
                      {copy.dashboard.registerAccount}
                    </button>
                  ) : null}
                  {isAccountUser ? (
                    <button
                      className="rounded-[0.95rem] border border-rose-300/30 bg-rose-300/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={status === "saving"}
                      onClick={() => setShowDeleteRoleConfirm(true)}
                      type="button"
                    >
                      {copy.dashboard.deleteRole}
                    </button>
                  ) : null}
                  <button
                    className="rounded-[0.95rem] bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={snapshot.afk.status === "active" || isRealtimeActionDisabled}
                    onClick={() => {
                      void startAfk().catch(() => {});
                    }}
                    type="button"
                  >
                    {status === "saving" && snapshot.afk.status === "idle" ? messages.common.submit : copy.dashboard.startAfk}
                  </button>
                  <button
                    className="rounded-[0.95rem] bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={snapshot.afk.status === "idle" || isRealtimeActionDisabled || Boolean(activeBattle)}
                    onClick={() => {
                      void stopAfk().catch(() => {});
                    }}
                    type="button"
                  >
                    {status === "saving" && snapshot.afk.status === "active" ? messages.common.submit : copy.dashboard.stopAfk}
                  </button>
                  <button
                    className="col-span-2 rounded-[0.95rem] border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-200/25 sm:col-span-2 xl:col-span-2"
                    disabled={status === "saving"}
                    onClick={() => {
                      void claimOfflineReward().catch(() => {});
                    }}
                    type="button"
                  >
                    {copy.dashboard.claimReward}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </SectionCard>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[184px_minmax(0,1.45fr)_252px]">
          <SectionCard className="min-h-0 p-3">
            <div className="space-y-3">
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

          <div className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_220px]">
            <CenterPanel
              activePanel={activePanel}
              backpack={backpack}
              isRealtimeReady={isRealtimeReady}
              currentTaskReward={currentTaskReward}
              maps={maps}
              onRequestBuyMarketListing={(listingId) => {
                setPendingMarketPurchaseListingId(listingId);
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
              status={status}
              taskDuration={taskDuration}
              taskProgress={taskProgress}
              taskProgressPercent={taskProgressPercent}
            />
            <Chat />
          </div>

          <RightRail
            activePanel={activePanel}
            backpack={backpack}
            isRealtimeReady={isRealtimeReady}
            onCancelMarketListing={(listingId) => {
              void cancelMarketListing(listingId).catch(() => {});
            }}
            onDismissMarketSoldNotification={(listingId) => {
              void dismissMarketSoldNotification(listingId).catch(() => {});
            }}
            pendingReward={snapshot.afk.pendingReward}
            selectedItem={selectedItem}
            snapshot={snapshot}
          />
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
