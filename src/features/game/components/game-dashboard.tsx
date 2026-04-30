'use client';

import { useEffect, useMemo, useState } from "react";
import Chat from "@/components/chat";
import { getMaxHealth, type AfkEncounterReward, type BodySlotType, type ClassKey, type EncounterTier, type MapConfig, type MapKey, type PanelKey, type RaceKey } from "@/lib/game-config";
import { useGameSession } from "@/features/game/context/game-session-provider";
import {
  formatMessage,
  getClassCopy,
  getEncounterCopy,
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

function formatNumber(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.floor(value)));
}

function formatDecimal(value: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function formatDuration(seconds: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const isEnglish = locale === "en-US";

  if (hours > 0) {
    return isEnglish ? `${hours}h ${minutes}m` : `${hours}小时 ${minutes}分`;
  }

  if (minutes > 0) {
    return isEnglish ? `${minutes}m ${remainingSeconds}s` : `${minutes}分 ${remainingSeconds}秒`;
  }

  return isEnglish ? `${remainingSeconds}s` : `${remainingSeconds}秒`;
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

function formatEncounterRate(rate: number) {
  return `${(Math.max(0, rate) * 100).toFixed(3).replace(/\.?0+$/, "")}%`;
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

function localizeMapSummary(mapKey: string, fallback: string, locale: SupportedLocale) {
  return getMapCopy(locale, mapKey)?.summary ?? fallback;
}

function localizeItemName(itemId: string, fallback: string, locale: SupportedLocale) {
  return getItemCopy(locale, itemId)?.name ?? fallback;
}

function localizeItemDescription(itemId: string, fallback: string, locale: SupportedLocale) {
  return getItemCopy(locale, itemId)?.description ?? fallback;
}

function localizeEncounterTitle(encounterKey: string, fallback: string, locale: SupportedLocale) {
  return getEncounterCopy(locale, encounterKey)?.title ?? fallback;
}

function localizeEncounterDescription(encounterKey: string, fallback: string, locale: SupportedLocale) {
  return getEncounterCopy(locale, encounterKey)?.description ?? fallback;
}

function formatEncounterReward(
  reward: AfkEncounterReward,
  locale: SupportedLocale = DEFAULT_LOCALE,
  messages: I18nMessages = DEFAULT_MESSAGES,
) {
  const segments = [
    reward.gold > 0 ? `${messages.game.dashboard.gold} ${formatNumber(reward.gold, locale)}` : null,
    reward.exp > 0 ? `${messages.game.dashboard.exp} ${formatNumber(reward.exp, locale)}` : null,
    reward.aetherCrystal > 0 ? `${messages.game.dashboard.aetherCrystal} ${formatNumber(reward.aetherCrystal, locale)}` : null,
    reward.healthDelta
      ? `${messages.game.dashboard.currentHealth} ${reward.healthDelta > 0 ? "+" : "-"}${formatNumber(Math.abs(reward.healthDelta), locale)}`
      : null,
    ...(reward.items ?? []).map((item) => `${localizeItemName(item.itemId, item.name ?? item.itemId, locale)} x${formatNumber(item.quantity, locale)}`),
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(" / ") : messages.common.empty;
}

function rarityLabel(rarity: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.rarity[rarity as keyof I18nMessages["rarity"]] ?? rarity;
}

function encounterTierLabel(tier: EncounterTier, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.encounterTier[tier];
}

function encounterTierAccent(tier: EncounterTier) {
  return {
    common: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    rare: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    legendary: "border-rose-300/25 bg-rose-300/12 text-rose-100",
  }[tier];
}

function formatEncounterTriggeredAt(timestamp: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  return new Date(timestamp).toLocaleString(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
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

function slotLabel(slot: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.slots[slot as keyof I18nMessages["slots"]] ?? slot;
}

function statLabel(statKey: string, messages: I18nMessages = DEFAULT_MESSAGES) {
  return messages.stats[statKey as keyof I18nMessages["stats"]] ?? statKey;
}

function bodySlotKeyLabel(
  slotKey: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
  messages: I18nMessages = DEFAULT_MESSAGES,
) {
  const [slotType, indexText] = slotKey.split("-");
  const index = Number(indexText);
  const baseLabel = slotLabel(slotType, messages);

  if (!Number.isFinite(index)) {
    return baseLabel;
  }

  return locale === "en-US" ? `${baseLabel} ${index}` : `${baseLabel}${index}`;
}

function formatEquippedGroupSummary(
  groups: string[][] | null | undefined,
  locale: SupportedLocale = DEFAULT_LOCALE,
  messages: I18nMessages = DEFAULT_MESSAGES,
) {
  const safeGroups = Array.isArray(groups) ? groups : [];

  if (safeGroups.length === 0) {
    return messages.common.noneEquipped;
  }

  return safeGroups
    .map((group) => group.map((slotKey) => bodySlotKeyLabel(slotKey, locale, messages)).join(" + "))
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
type ItemActionKey = "drop" | "equip" | "unequip";
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
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-slate-300">
        <span>{label}</span>
        <span>{Math.max(0, Math.floor(value))}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-950/90">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-75 ease-linear ${tone}`}
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

function RailButton({
  active,
  count,
  label,
  onClick,
  summary,
}: {
  active: boolean;
  count?: string;
  label: string;
  onClick: () => void;
  summary: string;
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
      <p className="mt-2 text-xs leading-6 text-slate-400">{summary}</p>
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
        "group relative flex aspect-square flex-col justify-between overflow-hidden rounded-[1rem] border p-3 text-left transition",
        itemAccent(rarity),
        active ? "ring-2 ring-sky-300/60" : "hover:translate-y-[-1px]",
      ].join(" ")}
      onClick={onClick}
      title={itemName}
      type="button"
    >
      {equippedCount > 0 ? (
        <span className="absolute left-2 top-2 rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-[10px] font-semibold text-emerald-50">
          {messages.game.dashboard.equippedBadge}
        </span>
      ) : null}
      <span className="text-lg font-semibold">{glyph}</span>
      <span className="self-end rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white/90">
        {quantity}
      </span>
      <span className="pointer-events-none absolute inset-x-2 bottom-2 truncate text-[10px] text-white/70">
        {itemName}
      </span>
    </button>
  );
}

function LandingView() {
  const { locale, messages, setLocale } = useI18n();
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{copy.landing.title}</h2>
            <div className="mt-4 flex gap-2">
              <button
                className={`rounded-full border px-3 py-1 text-xs ${locale === "zh-CN" ? "border-sky-300/45 bg-sky-300/12 text-white" : "border-white/10 text-slate-300"}`}
                onClick={() => setLocale("zh-CN")}
                type="button"
              >
                {messages.locale.zhCN}
              </button>
              <button
                className={`rounded-full border px-3 py-1 text-xs ${locale === "en-US" ? "border-sky-300/45 bg-sky-300/12 text-white" : "border-white/10 text-slate-300"}`}
                onClick={() => setLocale("en-US")}
                type="button"
              >
                {messages.locale.enUS}
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {copy.landing.summary}
          </p>

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
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{copy.createRole.summary}</p>

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
  currentTaskReward,
  maps,
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
  currentTaskReward: {
    aetherCrystal: number;
    exp: number;
    gold: number;
  };
  maps: MapConfig[];
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
              <p className="mt-1 text-sm text-slate-300">{copy.dashboard.backpackSummary}</p>
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
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{bodySlotKeyLabel(slot.key, locale, messages)}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{slot.item ? localizeItemName(slot.item.itemId, slot.item.name, locale) : copy.dashboard.emptySlot}</p>
                  <p className="mt-1 text-xs text-slate-400">{slot.item ? rarityLabel(slot.item.rarity, messages) : slotLabel(slot.slotType, messages)}</p>
                  {slot.item ? (
                    <button
                      className="mt-3 rounded-[0.75rem] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-slate-100 transition hover:border-sky-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={status === "saving"}
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

  return (
    <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-white/8 px-4 py-3">
        <SectionEyebrow>{copy.dashboard.afkControl}</SectionEyebrow>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{copy.dashboard.afkTitle}</h2>
            <p className="mt-1 text-sm text-slate-300">{copy.dashboard.afkSummaryText}</p>
          </div>
          <div className="flex gap-2">
            <DataPill label={copy.dashboard.cycle} value={formatClock(taskDuration)} />
            <DataPill label={copy.dashboard.currentRound} value={`${formatClock(taskProgress)} / ${formatClock(taskDuration)}`} />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1rem] border border-sky-300/25 bg-sky-300/8 p-4">
          {maps
            .filter((map) => map.key === selectedMapKey)
            .map((map) => (
              <div key={map.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-white">{localizeMapLabel(map.key, map.label, locale)}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{localizeMapSummary(map.key, map.summary, locale)}</p>
                  </div>
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300"
                    onClick={() => selectMap(map.key)}
                    type="button"
                  >
                    {copy.dashboard.currentMapButton}
                  </button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <DataPill label={copy.dashboard.goldPerMinute} value={formatDecimal(map.goldPerMinute, locale)} />
                  <DataPill label={copy.dashboard.aetherPerMinute} value={formatDecimal(map.aetherPerMinute, locale)} />
                  <DataPill label={copy.dashboard.expPerMinute} value={formatDecimal(map.expPerMinute, locale)} />
                </div>
              </div>
            ))}
        </div>

        <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
          <TopStatusBar
            label={copy.dashboard.executionProgress}
            tone="from-sky-400 via-cyan-300 to-emerald-300"
            value={taskProgressPercent}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DataPill label={copy.dashboard.status} value={snapshot.afk.status === "active" ? messages.common.active : messages.common.idle} />
            <DataPill label={copy.dashboard.remaining} value={formatDuration(Math.max(0, taskDuration - taskProgress), locale)} />
            <DataPill label={copy.dashboard.executed} value={formatDuration(taskProgress, locale)} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DataPill label={copy.dashboard.roundGold} value={formatNumber(currentTaskReward.gold, locale)} />
            <DataPill label={copy.dashboard.roundAether} value={formatNumber(currentTaskReward.aetherCrystal, locale)} />
            <DataPill label={copy.dashboard.roundExp} value={formatNumber(currentTaskReward.exp, locale)} />
          </div>
        </div>

        <div className="rounded-[1rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.1),rgba(15,23,42,0.18))] p-4 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionEyebrow>{copy.dashboard.encounterLogEyebrow}</SectionEyebrow>
              <h3 className="mt-2 text-xl font-semibold text-white">{copy.dashboard.encounterLogTitle}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {copy.dashboard.encounterLogSummary}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <DataPill label={messages.encounterTier.common} value={formatEncounterRate(snapshot.afk.encounterRates.common)} />
              <DataPill label={messages.encounterTier.rare} value={formatEncounterRate(snapshot.afk.encounterRates.rare)} />
              <DataPill label={messages.encounterTier.legendary} value={formatEncounterRate(snapshot.afk.encounterRates.legendary)} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {snapshot.afk.recentEncounters.length > 0 ? snapshot.afk.recentEncounters.slice(0, 4).map((encounter) => (
              <div
                key={encounter.id}
                className="rounded-[1rem] border border-white/8 bg-slate-950/30 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.14)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{localizeEncounterTitle(encounter.key, encounter.title, locale)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatEncounterTriggeredAt(encounter.triggeredAt, locale)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${encounterTierAccent(encounter.tier)}`}>
                    {encounterTierLabel(encounter.tier, messages)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{localizeEncounterDescription(encounter.key, encounter.description, locale)}</p>
                <p className="mt-3 text-xs leading-6 text-amber-100/90">{formatEncounterReward(encounter.reward, locale, messages)}</p>
              </div>
            )) : (
              <div className="rounded-[1rem] border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm leading-6 text-slate-400 lg:col-span-2">
                {copy.dashboard.encounterEmpty}
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function RightRail({
  activePanel,
  backpack,
  pendingReward,
  selectedItem,
  snapshot,
}: {
  activePanel: PanelKey;
  backpack: BackpackItem[];
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
                      slots: formatEquippedGroupSummary(selectedItem.equippedSlotGroups, locale, messages),
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
                  <p className="mt-2 text-xs leading-6 text-slate-400">{formatEquippedGroupSummary(item.equippedSlotGroups, locale, messages)}</p>
                  <p className="mt-2 text-xs leading-6 text-sky-100/75">{formatStatsSummary(item.stats, locale, messages)}</p>
                </div>
              )) : (
                <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4 text-sm text-slate-400">
                  {copy.dashboard.equippedNone}
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
              <DataPill label={copy.dashboard.totalDuration} value={formatDuration(pendingReward.seconds, locale)} />
              <DataPill
                label={copy.dashboard.estimatedHourlyReward}
                value={formatMessage(copy.dashboard.rewardGoldExp, {
                  exp: formatNumber(snapshot.afk.estimatedHourlyReward.exp, locale),
                  gold: formatNumber(snapshot.afk.estimatedHourlyReward.gold, locale),
                })}
              />
            </div>

            <SectionEyebrow>
              <span className="mt-6 block">{copy.dashboard.encounterRates}</span>
            </SectionEyebrow>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <DataPill label={messages.encounterTier.common} value={formatEncounterRate(snapshot.afk.encounterRates.common)} />
              <DataPill label={messages.encounterTier.rare} value={formatEncounterRate(snapshot.afk.encounterRates.rare)} />
              <DataPill label={messages.encounterTier.legendary} value={formatEncounterRate(snapshot.afk.encounterRates.legendary)} />
            </div>

            <SectionEyebrow>
              <span className="mt-6 block">{copy.dashboard.recentEncounters}</span>
            </SectionEyebrow>
            <div className="mt-3 space-y-3">
              {snapshot.afk.recentEncounters.length > 0 ? snapshot.afk.recentEncounters.slice(0, 5).map((encounter) => (
                <div key={encounter.id} className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{localizeEncounterTitle(encounter.key, encounter.title, locale)}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatEncounterTriggeredAt(encounter.triggeredAt, locale)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${encounterTierAccent(encounter.tier)}`}>
                      {encounterTierLabel(encounter.tier, messages)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{localizeEncounterDescription(encounter.key, encounter.description, locale)}</p>
                  <p className="mt-3 text-xs leading-6 text-sky-100/80">{formatEncounterReward(encounter.reward, locale, messages)}</p>
                </div>
              )) : (
                <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
                  {copy.dashboard.encounterRatesHint}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function MainDashboard() {
  const { locale, messages, setLocale } = useI18n();
  const copy = messages.game;
  const {
    activePanel,
    claimOfflineReward,
    dropBackpackItem,
    deleteAccountRole,
    dismissError,
    equipBackpackItem,
    error,
    registerAccount,
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

    if (pendingItemAction && !backpack.some((item) => item.backpackId === pendingItemAction.backpackId)) {
      setPendingItemAction(null);
    }
  }, [backpack, itemActionBackpackId, pendingItemAction]);

  useEffect(() => {
    if (!snapshot || snapshot.afk.status !== "active") {
      setDisplayNow(Date.now());
      return;
    }

    setDisplayNow(Date.now());

    const timer = window.setInterval(() => {
      setDisplayNow(Date.now());
    }, 50);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    snapshot,
    snapshot?.afk.accruedSeconds,
    snapshot?.afk.status,
    snapshot?.serverTime,
  ]);

  const selectedItem = backpack.find((item) => item.backpackId === selectedBackpackId);
  const actionItem = backpack.find((item) => item.backpackId === itemActionBackpackId);
  const pendingActionItem = pendingItemAction
    ? backpack.find((item) => item.backpackId === pendingItemAction.backpackId)
    : undefined;
  const pendingActionDefinition = pendingItemAction
    ? getItemActionDefinition(pendingItemAction.actionKey, messages)
    : null;
  const isAccountUser = snapshot?.account.mode === "account";
  const isGuestUser = snapshot?.account.mode === "guest";
  const progressCopy = role ? formatPercent(role.currentLevelExp, role.nextLevelExp, messages) : "0%";
  const taskDuration = snapshot?.afk.taskDurationSeconds ?? 0;
  const taskProgress = snapshot?.afk.status === "active"
    ? Math.min(
      taskDuration,
      (snapshot.afk.accruedSeconds ?? 0) + Math.max(0, displayNow - snapshot.serverTime) / 1000,
    )
    : (snapshot?.afk.accruedSeconds ?? 0);
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

  const menuItems: Array<{ key: PanelKey; label: string; summary: string; count?: string }> = [
    { key: "afk", label: copy.dashboard.menu.afk.label, summary: copy.dashboard.menu.afk.summary, count: snapshot.afk.status === "active" ? copy.dashboard.menu.afk.running : messages.common.idle },
    { key: "backpack", label: copy.dashboard.menu.backpack.label, summary: copy.dashboard.menu.backpack.summary, count: String(backpack.length) },
    { key: "role", label: copy.dashboard.menu.role.label, summary: copy.dashboard.menu.role.summary, count: `${messages.common.levelShort}${role.level}` },
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
                  void claimOfflineReward();
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
                });
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
                });
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
              <p className="mt-3 text-xs leading-6 text-slate-400">{formatMessage(copy.dashboard.occupiedSlots, { slots: formatEquippedGroupSummary(actionItem.equippedSlotGroups, locale, messages) })}</p>
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
                disabled={status === "saving"}
              onClick={() => {
                  if (action.actionKey === "equip") {
                    void equipBackpackItem(actionItem.backpackId).then(() => {
                      setItemActionBackpackId(null);
                    });
                    return;
                  }

                  if (action.actionKey === "unequip") {
                    void unequipBackpackItem(actionItem.backpackId).then(() => {
                      setItemActionBackpackId(null);
                    });
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
              disabled={status === "saving"}
              onClick={() => {
                if (pendingItemAction?.actionKey === "drop") {
                  void dropBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  });
                }

                if (pendingItemAction?.actionKey === "equip") {
                  void equipBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  });
                }

                if (pendingItemAction?.actionKey === "unequip") {
                  void unequipBackpackItem(pendingActionItem.backpackId).then(() => {
                    setPendingItemAction(null);
                    setItemActionBackpackId(null);
                  });
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

      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-3 overflow-hidden">
        <SectionCard className="overflow-hidden border-white/6 bg-[linear-gradient(180deg,rgba(49,62,121,0.95),rgba(12,16,34,0.98))]">
          <div className="space-y-4 px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1rem] border border-white/12 bg-white/[0.05] text-xl font-semibold text-sky-100">
                  {role.avatarSeed}
                </div>
                <div>
                  <SectionEyebrow>{copy.dashboard.overview}</SectionEyebrow>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{role.name}</h1>
                  <p className="mt-1 text-sm text-slate-200/80">
                    {formatMessage(copy.dashboard.roleMeta, {
                      className: localizeClassLabel(role.classKey, snapshot.config.classes.find((item) => item.key === role.classKey)?.label ?? role.classKey, locale),
                      level: role.level,
                      race: localizeRaceLabel(role.raceKey, snapshot.config.races.find((item) => item.key === role.raceKey)?.label ?? role.raceKey, locale),
                    })}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <DataPill label={copy.dashboard.gold} value={formatNumber(role.gold, locale)} />
                <DataPill label={copy.dashboard.aetherCrystal} value={formatNumber(role.aetherCrystal, locale)} />
                <DataPill label={copy.dashboard.currentHealth} value={`${formatNumber(role.currentHealth, locale)} / ${formatNumber(role.maxHealth, locale)}`} />
                <DataPill label={copy.dashboard.pendingRewardShort} value={formatNumber(snapshot.afk.pendingReward.gold, locale)} />
                <DataPill label={copy.dashboard.executionStatus} value={snapshot.afk.status === "active" ? messages.common.active : messages.common.idle} />
                <DataPill label={copy.dashboard.levelProgress} value={progressCopy} />
                <DataPill label={copy.dashboard.accountStatus} value={isAccountUser ? (snapshot.account.username ?? copy.dashboard.bound) : messages.common.guest} />
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
              <TopStatusBar
                label={copy.dashboard.levelBar}
                tone="from-teal-300 via-cyan-300 to-sky-400"
                value={role.nextLevelExp > 0 ? (role.currentLevelExp / role.nextLevelExp) * 100 : 100}
              />
              <TopStatusBar
                label={copy.dashboard.lifeBar}
                tone="from-rose-500 via-orange-400 to-emerald-300"
                value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
              />
              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <div className="flex gap-2">
                  <button
                    className={`rounded-[0.95rem] border px-4 py-3 text-sm font-semibold transition ${locale === "zh-CN" ? "border-sky-300/45 bg-sky-300/12 text-white" : "border-white/10 text-slate-300"}`}
                    onClick={() => setLocale("zh-CN")}
                    type="button"
                  >
                    {messages.locale.zhCN}
                  </button>
                  <button
                    className={`rounded-[0.95rem] border px-4 py-3 text-sm font-semibold transition ${locale === "en-US" ? "border-sky-300/45 bg-sky-300/12 text-white" : "border-white/10 text-slate-300"}`}
                    onClick={() => setLocale("en-US")}
                    type="button"
                  >
                    {messages.locale.enUS}
                  </button>
                </div>
                {isGuestUser ? (
                  <button
                    className="rounded-[0.95rem] border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={status === "saving"}
                    onClick={() => setShowRegisterAccountModal(true)}
                    type="button"
                  >
                    {copy.dashboard.registerAccount}
                  </button>
                ) : null}
                {isAccountUser ? (
                  <button
                    className="rounded-[0.95rem] border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={status === "saving"}
                    onClick={() => setShowDeleteRoleConfirm(true)}
                    type="button"
                  >
                    {copy.dashboard.deleteRole}
                  </button>
                ) : null}
                <button
                  className="rounded-[0.95rem] bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={snapshot.afk.status === "active" || status === "saving"}
                  onClick={() => {
                    void startAfk();
                  }}
                  type="button"
                >
                  {status === "saving" && snapshot.afk.status === "idle" ? messages.common.submit : copy.dashboard.startAfk}
                </button>
                <button
                  className="rounded-[0.95rem] bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={snapshot.afk.status === "idle" || status === "saving"}
                  onClick={() => {
                    void stopAfk();
                  }}
                  type="button"
                >
                  {status === "saving" && snapshot.afk.status === "active" ? messages.common.submit : copy.dashboard.stopAfk}
                </button>
                <button
                  className="rounded-[0.95rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-sky-200/25"
                  onClick={() => {
                    void claimOfflineReward();
                  }}
                  type="button"
                >
                  {copy.dashboard.claimReward}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          <SectionCard className="min-h-0 p-3">
            <div className="space-y-3">
              {menuItems.map((item) => (
                <RailButton
                  key={item.key}
                  active={activePanel === item.key}
                  count={item.count}
                  label={item.label}
                  onClick={() => setActivePanel(item.key)}
                  summary={item.summary}
                />
              ))}
            </div>
          </SectionCard>

          <div className="grid min-h-0 gap-3 xl:grid-rows-[minmax(0,1fr)_240px]">
            <CenterPanel
              activePanel={activePanel}
              backpack={backpack}
              currentTaskReward={currentTaskReward}
              maps={maps}
              onUnequipItem={(backpackId) => {
                void unequipBackpackItem(backpackId);
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
            pendingReward={snapshot.afk.pendingReward}
            selectedItem={selectedItem}
            snapshot={snapshot}
          />
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
