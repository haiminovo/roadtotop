'use client';

import { useEffect, useMemo, useState } from "react";
import Chat from "@/components/chat";
import { getMaxHealth, type AfkEncounterReward, type ClassKey, type EncounterTier, type MapConfig, type MapKey, type PanelKey, type RaceKey } from "@/lib/game-config";
import { useGameSession } from "@/features/game/context/game-session-provider";

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(value)));
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function formatPercent(current: number, total: number) {
  if (total <= 0) {
    return "MAX";
  }

  return `${Math.min(100, Math.floor((current / total) * 100))}%`;
}

function formatEncounterRate(rate: number) {
  return `${(Math.max(0, rate) * 100).toFixed(3).replace(/\.?0+$/, "")}%`;
}

function formatEncounterReward(reward: AfkEncounterReward) {
  const segments = [
    reward.gold > 0 ? `金 ${formatNumber(reward.gold)}` : null,
    reward.exp > 0 ? `经 ${formatNumber(reward.exp)}` : null,
    reward.aetherCrystal > 0 ? `以太 ${formatNumber(reward.aetherCrystal)}` : null,
    reward.healthDelta
      ? `生命 ${reward.healthDelta > 0 ? "+" : "-"}${formatNumber(Math.abs(reward.healthDelta))}`
      : null,
    ...(reward.items ?? []).map((item) => `${item.name ?? item.itemId} x${formatNumber(item.quantity)}`),
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(" / ") : "无额外奖励";
}

function rarityLabel(rarity: string) {
  return {
    white: "白装",
    green: "绿装",
    blue: "蓝装",
    purple: "紫装",
    orange: "橙装",
  }[rarity] ?? rarity;
}

function encounterTierLabel(tier: EncounterTier) {
  return {
    common: "普通奇遇",
    rare: "稀有奇遇",
    legendary: "传说奇遇",
  }[tier];
}

function encounterTierAccent(tier: EncounterTier) {
  return {
    common: "border-sky-300/25 bg-sky-300/10 text-sky-100",
    rare: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    legendary: "border-rose-300/25 bg-rose-300/12 text-rose-100",
  }[tier];
}

function formatEncounterTriggeredAt(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function formatStatsSummary(stats: Record<string, number>) {
  const entries = Object.entries(stats).filter(([, value]) => Number(value) > 0);

  if (entries.length === 0) {
    return "无额外属性";
  }

  return entries
    .map(([key, value]) => `${key} +${formatNumber(value)}`)
    .join(" · ");
}

function slotLabel(slot: string) {
  return {
    accessory: "饰品",
    armor: "护甲",
    weapon: "武器",
  }[slot] ?? slot;
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
  name: string;
  rarity: string;
  slot: string;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
}> = [];

type BackpackItem = typeof EMPTY_BACKPACK[number];
type ItemActionKey = "drop";
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

function getItemActionDefinition(actionKey: ItemActionKey) {
  return {
    drop: {
      actionKey: "drop" as const,
      confirmCopy: "这个操作会直接删除背包记录，不能恢复。",
      confirmTitle: "确认丢弃物品",
      label: "丢弃物品",
      summary: "永久删除当前这组物品。",
      tone: "danger" as const,
    },
  }[actionKey];
}

function getAvailableItemActions() {
  return [getItemActionDefinition("drop")];
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
  glyph,
  itemName,
  onClick,
  quantity,
  rarity,
}: {
  active: boolean;
  glyph: string;
  itemName: string;
  onClick: () => void;
  quantity: number;
  rarity: string;
}) {
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
  const { accountLogin, guestLogin, status } = useGameSession();
  const [loginMode, setLoginMode] = useState<"guest" | "account">("guest");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,#25336f_0%,#11173a_36%,#050716_100%)] px-4 py-6 text-slate-100 md:px-6 md:py-8">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard className="overflow-hidden px-6 py-7 md:px-8">
          <SectionEyebrow>Idle MMO</SectionEyebrow>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["服务端执行", "开始、停止和结算都在服务端处理。"],
              ["离线收益", "离线后按完整轮次结算，未满一轮不计入。"],
              ["背包查看", "已拥有物品可以在背包里查看详情。"],
            ].map(([title, summary]) => (
              <div key={title} className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-100/55">{title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="px-6 py-7">
          <SectionEyebrow>Access</SectionEyebrow>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">进入游戏</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            可以直接游客登录，也可以输入账号密码进入已绑定角色。
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
              游客登录
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
              账号登录
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
              {status === "booting" ? "正在建立游客会话..." : "以游客身份进入"}
            </button>
          ) : (
            <>
              <label className="mt-8 block">
                <span className="text-sm font-medium text-emerald-100">账号</span>
                <input
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="输入账号"
                  value={username}
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-emerald-100">密码</span>
                <input
                  className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="输入密码"
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
                {status === "booting" ? "正在校验账号..." : "登录账号"}
              </button>
            </>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

function CreateRoleView() {
  const { createRole, snapshot, status } = useGameSession();
  const [name, setName] = useState("边境旅人");
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
          <SectionEyebrow>Character Setup</SectionEyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white md:text-5xl">创建角色</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">名字、种族和职业确认后就能直接开始挂机。</p>

          <label className="mt-8 block">
            <span className="text-sm font-medium text-sky-100">角色名</span>
            <input
              className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-sky-300"
              maxLength={12}
              onChange={(event) => setName(event.target.value)}
              placeholder="输入 2~12 个字符"
              value={name}
            />
          </label>

          <div className="mt-8">
            <SectionEyebrow>Race</SectionEyebrow>
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
                    <p className="text-lg font-semibold text-white">{race.label}</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                      {race.key}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{race.summary}</p>
                  <p className="mt-3 text-xs text-sky-100/70">
                    力 {race.stats.strength} · 敏 {race.stats.agility} · 智 {race.stats.intelligence} · 体{" "}
                    {race.stats.vitality}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <SectionEyebrow>Class</SectionEyebrow>
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
                    <p className="text-lg font-semibold text-white">{roleClass.label}</p>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                      {roleClass.key}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{roleClass.summary}</p>
                  <p className="mt-3 text-xs text-emerald-100/70">
                    力 {roleClass.stats.strength} · 敏 {roleClass.stats.agility} · 智{" "}
                    {roleClass.stats.intelligence} · 体 {roleClass.stats.vitality}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard className="px-6 py-7">
          <SectionEyebrow>Preview</SectionEyebrow>
          <div className="mt-4 rounded-[1rem] border border-white/8 bg-white/[0.035] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sky-100/55">当前编成</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{name || "未命名旅人"}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {selectedRace?.label ?? "未选种族"} / {selectedClass?.label ?? "未选职业"}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DataPill label="力量" value={fusedStats.strength} />
            <DataPill label="敏捷" value={fusedStats.agility} />
            <DataPill label="智力" value={fusedStats.intelligence} />
            <DataPill label="体质" value={fusedStats.vitality} />
            <DataPill label="生命" value={formatNumber(previewHealth)} />
          </div>

          <button
            className="mt-6 w-full rounded-[1.1rem] bg-[linear-gradient(90deg,#60a5fa_0%,#34d399_100%)] px-5 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status === "saving" || name.trim().length < 2}
            onClick={() => {
              void createRole({ classKey, name, raceKey });
            }}
            type="button"
          >
            {status === "saving" ? "正在创建角色..." : "创建角色并进入世界"}
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
  const groupedBySlot = backpack.reduce<Record<string, number>>((accumulator, item) => {
    const nextValue = accumulator[item.slot] ?? 0;
    accumulator[item.slot] = nextValue + item.quantity;
    return accumulator;
  }, {});

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(groupedBySlot).map(([slot, quantity]) => (
        <div key={slot} className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{slotLabel(slot)}</p>
          <p className="mt-1 text-lg font-semibold text-white">{formatNumber(quantity)}</p>
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
  onSelectItem,
  role,
  selectedBackpackId,
  selectedMapKey,
  selectMap,
  snapshot,
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
  onSelectItem: (backpackId: string) => void;
  role: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>["role"];
  selectedBackpackId: string | null;
  selectedMapKey: MapKey;
  selectMap: (mapKey: MapKey) => void;
  snapshot: NonNullable<ReturnType<typeof useGameSession>["snapshot"]>;
  taskDuration: number;
  taskProgress: number;
  taskProgressPercent: number;
}) {
  if (!role) {
    return null;
  }

  if (activePanel === "backpack") {
    return (
      <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3">
          <SectionEyebrow>Inventory</SectionEyebrow>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">背包</h2>
              <p className="mt-1 text-sm text-slate-300">只展示当前真实拥有的物品。</p>
            </div>
            <div className="flex gap-2">
              <DataPill label="物品数" value={formatNumber(backpack.length)} />
              <DataPill
                label="已装备"
                value={formatNumber(backpack.filter((item) => item.equipped).length)}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {backpack.map((item) => (
              <ItemTile
                key={item.backpackId}
                active={selectedBackpackId === item.backpackId}
                glyph={itemGlyph(item.name)}
                itemName={item.name}
                onClick={() => onSelectItem(item.backpackId)}
                quantity={item.quantity}
                rarity={item.rarity}
              />
            ))}
          </div>
        </div>
      </SectionCard>
    );
  }

  if (activePanel === "role") {
    const race = snapshot.config.races.find((item) => item.key === role.raceKey);
    const roleClass = snapshot.config.classes.find((item) => item.key === role.classKey);

    return (
      <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-white/8 px-4 py-3">
          <SectionEyebrow>Character Sheet</SectionEyebrow>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">角色档案</h2>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
            <p className="text-2xl font-semibold text-white">{role.name}</p>
            <p className="mt-2 text-sm text-slate-300">
              {race?.label} / {roleClass?.label}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{race?.summary}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{roleClass?.summary}</p>
          </div>

          <div className="rounded-[1rem] border border-rose-300/20 bg-[linear-gradient(180deg,rgba(244,63,94,0.12),rgba(15,23,42,0.18))] p-4">
            <TopStatusBar
              label="生命状态"
              tone="from-rose-500 via-orange-400 to-emerald-300"
              value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DataPill label="当前生命" value={`${formatNumber(role.currentHealth)} / ${formatNumber(role.maxHealth)}`} />
              <DataPill label="死亡惩罚" value="生命归零时掉 1 级" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DataPill label="等级" value={formatNumber(role.level)} />
            <DataPill label="经验" value={formatNumber(role.exp)} />
            <DataPill label="最大生命" value={formatNumber(role.maxHealth)} />
            <DataPill label="力量" value={formatNumber(role.stats.strength)} />
            <DataPill label="敏捷" value={formatNumber(role.stats.agility)} />
            <DataPill label="智力" value={formatNumber(role.stats.intelligence)} />
            <DataPill label="体质" value={formatNumber(role.stats.vitality)} />
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-white/8 px-4 py-3">
        <SectionEyebrow>AFK Control</SectionEyebrow>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">挂机控制</h2>
            <p className="mt-1 text-sm text-slate-300">当前版本只保留一张已实现地图，收益与结算都以服务端状态为准。</p>
          </div>
          <div className="flex gap-2">
            <DataPill label="周期" value={formatClock(taskDuration)} />
            <DataPill label="本轮" value={`${formatClock(taskProgress)} / ${formatClock(taskDuration)}`} />
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
                    <p className="text-xl font-semibold text-white">{map.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{map.summary}</p>
                  </div>
                  <button
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300"
                    onClick={() => selectMap(map.key)}
                    type="button"
                  >
                    当前地图
                  </button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <DataPill label="金币/分" value={formatDecimal(map.goldPerMinute)} />
                  <DataPill label="以太/分" value={formatDecimal(map.aetherPerMinute)} />
                  <DataPill label="经验/分" value={formatDecimal(map.expPerMinute)} />
                </div>
              </div>
            ))}
        </div>

        <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
          <TopStatusBar
            label="执行进度"
            tone="from-sky-400 via-cyan-300 to-emerald-300"
            value={taskProgressPercent}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DataPill label="状态" value={snapshot.afk.status === "active" ? "挂机中" : "待机"} />
            <DataPill label="剩余" value={formatDuration(Math.max(0, taskDuration - taskProgress))} />
            <DataPill label="已执行" value={formatDuration(taskProgress)} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <DataPill label="单轮金币" value={formatNumber(currentTaskReward.gold)} />
            <DataPill label="单轮以太" value={formatNumber(currentTaskReward.aetherCrystal)} />
            <DataPill label="单轮经验" value={formatNumber(currentTaskReward.exp)} />
          </div>
        </div>

        <div className="rounded-[1rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.1),rgba(15,23,42,0.18))] p-4 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionEyebrow>Encounter Log</SectionEyebrow>
              <h3 className="mt-2 text-xl font-semibold text-white">自己触发的奇遇</h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                每次完整执行动作后都会在服务端做一次奇遇判定，部分奇遇会直接掉血或回血，血量归零会立刻掉 1 级。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <DataPill label="普通" value={formatEncounterRate(snapshot.afk.encounterRates.common)} />
              <DataPill label="稀有" value={formatEncounterRate(snapshot.afk.encounterRates.rare)} />
              <DataPill label="传说" value={formatEncounterRate(snapshot.afk.encounterRates.legendary)} />
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
                    <p className="text-base font-semibold text-white">{encounter.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatEncounterTriggeredAt(encounter.triggeredAt)}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${encounterTierAccent(encounter.tier)}`}>
                    {encounterTierLabel(encounter.tier)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{encounter.description}</p>
                <p className="mt-3 text-xs leading-6 text-amber-100/90">{formatEncounterReward(encounter.reward)}</p>
              </div>
            )) : (
              <div className="rounded-[1rem] border border-dashed border-white/10 bg-slate-950/20 p-4 text-sm leading-6 text-slate-400 lg:col-span-2">
                这里会显示你最近触发的奇遇。当前还没有记录，继续挂机跑完整轮次就有机会刷出来。
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
  const equippedItems = backpack.filter((item) => item.equipped);

  return (
    <SectionCard className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${panelAccent(activePanel)}`} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">

        {activePanel === "backpack" ? (
          <>
            <div>
              <SectionEyebrow>Selected Item</SectionEyebrow>
              {selectedItem ? (
                <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{selectedItem.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {slotLabel(selectedItem.slot)} · {rarityLabel(selectedItem.rarity)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-200">
                      x{selectedItem.quantity}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{selectedItem.description}</p>
                  <p className="mt-3 text-xs leading-6 text-sky-100/75">{formatStatsSummary(selectedItem.stats)}</p>
                  <p className="mt-3 text-xs text-slate-400">出售价格 {formatNumber(selectedItem.sellPrice)}</p>
                </div>
              ) : (
                <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] p-4 text-sm text-slate-400">
                  点击中间仓库中的任意物品查看详情。
                </div>
              )}
            </div>

            <div>
              <SectionEyebrow>Overview</SectionEyebrow>
              <div className="mt-3">
                <BackpackOverview backpack={backpack} />
              </div>
            </div>
          </>
        ) : activePanel === "role" ? (
          <div>
            <SectionEyebrow>Equipped Items</SectionEyebrow>
            <div className="mt-3 space-y-3">
              {equippedItems.length > 0 ? equippedItems.map((item) => (
                <div key={item.backpackId} className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{slotLabel(item.slot)}</p>
                  <p className="mt-2 text-xs leading-6 text-sky-100/75">{formatStatsSummary(item.stats)}</p>
                </div>
              )) : (
                <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4 text-sm text-slate-400">
                  当前没有已装备物品。
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <SectionEyebrow>Settlement Summary</SectionEyebrow>
            <div className="mt-3 grid gap-2">
              <DataPill label="待领取金币" value={formatNumber(pendingReward.gold)} />
              <DataPill label="待领取经验" value={formatNumber(pendingReward.exp)} />
              <DataPill label="待领取以太" value={formatNumber(pendingReward.aetherCrystal)} />
              <DataPill label="累计时长" value={formatDuration(pendingReward.seconds)} />
              <DataPill
                label="预计小时收益"
                value={`金 ${formatNumber(snapshot.afk.estimatedHourlyReward.gold)} / 经 ${formatNumber(snapshot.afk.estimatedHourlyReward.exp)}`}
              />
            </div>

            <SectionEyebrow>
              <span className="mt-6 block">Encounter Rates</span>
            </SectionEyebrow>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <DataPill label="普通" value={formatEncounterRate(snapshot.afk.encounterRates.common)} />
              <DataPill label="稀有" value={formatEncounterRate(snapshot.afk.encounterRates.rare)} />
              <DataPill label="传说" value={formatEncounterRate(snapshot.afk.encounterRates.legendary)} />
            </div>

            <SectionEyebrow>
              <span className="mt-6 block">Recent Encounters</span>
            </SectionEyebrow>
            <div className="mt-3 space-y-3">
              {snapshot.afk.recentEncounters.length > 0 ? snapshot.afk.recentEncounters.slice(0, 5).map((encounter) => (
                <div key={encounter.id} className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{encounter.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatEncounterTriggeredAt(encounter.triggeredAt)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${encounterTierAccent(encounter.tier)}`}>
                      {encounterTierLabel(encounter.tier)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{encounter.description}</p>
                  <p className="mt-3 text-xs leading-6 text-sky-100/80">{formatEncounterReward(encounter.reward)}</p>
                </div>
              )) : (
                <div className="rounded-[1rem] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
                  完成每一次完整动作执行后，服务端都会分别以普通 10%、稀有 1%、传说 0.1% 的概率判定奇遇。
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
  const {
    activePanel,
    claimOfflineReward,
    dropBackpackItem,
    deleteAccountRole,
    dismissError,
    error,
    registerAccount,
    selectedMapKey,
    selectMap,
    setActivePanel,
    snapshot,
    startAfk,
    status,
    stopAfk,
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
    ? getItemActionDefinition(pendingItemAction.actionKey)
    : null;
  const isAccountUser = snapshot?.account.mode === "account";
  const isGuestUser = snapshot?.account.mode === "guest";
  const progressCopy = role ? formatPercent(role.currentLevelExp, role.nextLevelExp) : "0%";
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
    { key: "afk", label: "挂机", summary: "当前地图、进度和收益。", count: snapshot.afk.status === "active" ? "运行中" : "待机" },
    { key: "backpack", label: "背包", summary: "查看已有物品。", count: String(backpack.length) },
    { key: "role", label: "角色", summary: "等级、属性与成长。", count: `Lv.${role.level}` },
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
            关闭
          </button>
        </div>
      ) : null}

      {shouldShowRewardModal ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/72 px-4">
          <div className="w-full max-w-2xl rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
            <SectionEyebrow>Offline Settlement</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">离线收益已结算</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              服务端已经按挂机地图与完整执行轮次完成结算，未跑满的那一轮不会被计入奖励。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <DataPill label="金币" value={formatNumber(pendingReward?.gold ?? 0)} />
              <DataPill label="以太结晶" value={formatNumber(pendingReward?.aetherCrystal ?? 0)} />
              <DataPill label="经验" value={formatNumber(pendingReward?.exp ?? 0)} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-[1rem] bg-[linear-gradient(90deg,#60a5fa_0%,#34d399_100%)] px-4 py-4 text-base font-semibold text-slate-950 transition hover:brightness-105"
                onClick={() => {
                  void claimOfflineReward();
                }}
                type="button"
              >
                立即领取
              </button>
              <button
                className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
                onClick={() => setDismissedRewardKey(JSON.stringify(pendingReward))}
                type="button"
              >
                稍后处理
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRegisterAccountModal && snapshot ? (
        <OverlayModal>
          <SectionEyebrow>Bind Account</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">注册账号</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            当前游客角色会直接绑定到新账号 <span className="font-semibold text-white">{role.name}</span> 上，之后可以通过账号密码登录。
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-medium text-emerald-100">账号</span>
            <input
              className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
              onChange={(event) => setRegisterUsername(event.target.value)}
              placeholder="4~20 位字母、数字或下划线"
              value={registerUsername}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-emerald-100">密码</span>
            <input
              className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
              onChange={(event) => setRegisterPassword(event.target.value)}
              placeholder="至少 6 位"
              type="password"
              value={registerPassword}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-emerald-100">重复密码</span>
            <input
              className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
              onChange={(event) => setRegisterConfirmPassword(event.target.value)}
              placeholder="再次输入密码"
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
              {status === "saving" ? "提交中..." : "确认注册账号"}
            </button>
            <button
              className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              disabled={status === "saving"}
              onClick={() => {
                setShowRegisterAccountModal(false);
              }}
              type="button"
            >
              取消
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {showDeleteRoleConfirm && snapshot ? (
        <OverlayModal>
          <SectionEyebrow>Delete Role</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">确认删除角色</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            这个操作会永久删除账号 <span className="font-semibold text-white">{snapshot.account.username}</span> 绑定的角色
            <span className="font-semibold text-white"> {role.name}</span>，背包、挂机和收益记录都会一起移除。
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
              {status === "saving" ? "删除中..." : "确认删除角色"}
            </button>
            <button
              className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-200"
              disabled={status === "saving"}
              onClick={() => setShowDeleteRoleConfirm(false)}
              type="button"
            >
              我再想想
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {actionItem ? (
        <OverlayModal>
          <SectionEyebrow>Item Actions</SectionEyebrow>
          <div className="mt-4 flex items-start gap-4">
            <div className={`flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1rem] border text-3xl font-semibold ${itemAccent(actionItem.rarity)}`}>
              {itemGlyph(actionItem.name)}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-white">{actionItem.name}</h2>
              <p className="mt-2 text-sm text-slate-300">
                {slotLabel(actionItem.slot)} · {rarityLabel(actionItem.rarity)} · 数量 x{actionItem.quantity}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{actionItem.description}</p>
              <p className="mt-3 text-xs leading-6 text-sky-100/75">{formatStatsSummary(actionItem.stats)}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {getAvailableItemActions().map((action) => (
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
              关闭菜单
            </button>
          </div>
        </OverlayModal>
      ) : null}

      {pendingActionItem && pendingActionDefinition ? (
        <OverlayModal>
          <SectionEyebrow>Confirm Action</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">
            {pendingActionDefinition.confirmTitle}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            即将处理 <span className="font-semibold text-white">{pendingActionItem.name}</span> x{pendingActionItem.quantity}。
            {pendingActionDefinition.confirmCopy}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <DataPill label="类型" value={slotLabel(pendingActionItem.slot)} />
            <DataPill label="品质" value={rarityLabel(pendingActionItem.rarity)} />
            <DataPill label="出售价格" value={formatNumber(pendingActionItem.sellPrice)} />
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
              }}
              type="button"
            >
              {status === "saving" ? "处理中..." : `确认${pendingActionDefinition.label.replace("物品", "")}`}
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
              返回菜单
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
                  <SectionEyebrow>Overview</SectionEyebrow>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">{role.name}</h1>
                  <p className="mt-1 text-sm text-slate-200/80">
                    Lv.{role.level} · {snapshot.config.races.find((item) => item.key === role.raceKey)?.label} · {snapshot.config.classes.find((item) => item.key === role.classKey)?.label}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <DataPill label="当前金币" value={formatNumber(role.gold)} />
                <DataPill label="以太结晶" value={formatNumber(role.aetherCrystal)} />
                <DataPill label="当前生命" value={`${formatNumber(role.currentHealth)} / ${formatNumber(role.maxHealth)}`} />
                <DataPill label="待领取" value={formatNumber(snapshot.afk.pendingReward.gold)} />
                <DataPill label="执行状态" value={snapshot.afk.status === "active" ? "挂机中" : "待机"} />
                <DataPill label="升级进度" value={progressCopy} />
                <DataPill label="账号状态" value={isAccountUser ? (snapshot.account.username ?? "账号已绑定") : "游客"} />
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
              <TopStatusBar
                label="等级进度"
                tone="from-teal-300 via-cyan-300 to-sky-400"
                value={role.nextLevelExp > 0 ? (role.currentLevelExp / role.nextLevelExp) * 100 : 100}
              />
              <TopStatusBar
                label="生命状态"
                tone="from-rose-500 via-orange-400 to-emerald-300"
                value={(role.currentHealth / Math.max(1, role.maxHealth)) * 100}
              />
              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                {isGuestUser ? (
                  <button
                    className="rounded-[0.95rem] border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={status === "saving"}
                    onClick={() => setShowRegisterAccountModal(true)}
                    type="button"
                  >
                    注册账号
                  </button>
                ) : null}
                {isAccountUser ? (
                  <button
                    className="rounded-[0.95rem] border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={status === "saving"}
                    onClick={() => setShowDeleteRoleConfirm(true)}
                    type="button"
                  >
                    删除角色
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
                  {status === "saving" && snapshot.afk.status === "idle" ? "提交中..." : "开始挂机"}
                </button>
                <button
                  className="rounded-[0.95rem] bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={snapshot.afk.status === "idle" || status === "saving"}
                  onClick={() => {
                    void stopAfk();
                  }}
                  type="button"
                >
                  {status === "saving" && snapshot.afk.status === "active" ? "提交中..." : "停止挂机"}
                </button>
                <button
                  className="rounded-[0.95rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:border-sky-200/25"
                  onClick={() => {
                    void claimOfflineReward();
                  }}
                  type="button"
                >
                  领取收益
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
              onSelectItem={handleSelectBackpackItem}
              role={role}
              selectedBackpackId={selectedBackpackId}
              selectedMapKey={selectedMapKey}
              selectMap={selectMap}
              snapshot={snapshot}
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
