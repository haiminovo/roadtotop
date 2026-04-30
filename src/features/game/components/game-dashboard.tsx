'use client';

import { useEffect, useMemo, useState } from "react";
import type { ClassKey, MapKey, PanelKey, RaceKey } from "@/lib/game-config";
import { useGameSession } from "@/features/game/context/game-session-provider";

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.floor(value)));
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

function rarityLabel(rarity: string) {
  if (rarity === "green") {
    return "text-emerald-200";
  }

  return "text-slate-100";
}

function LandingView() {
  const { guestLogin, status } = useGameSession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3a2b15_0%,#17110b_42%,#090807_100%)] px-6 py-10 text-stone-100">
      <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(66,32,11,0.88),rgba(17,13,10,0.95))] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <div className="grid gap-10 px-7 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-amber-200/70">Elona Web Idle MMO</p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-amber-50 md:text-6xl">
              Day0 开发版
              <br />
              先把最小可运行世界点亮。
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-300 md:text-base">
              今日版本只做一条最短闭环：游客登录、创建角色、进入主界面、选择地图挂机、退出重进后领取离线收益。
              服务器负责时间和结算，页面只负责展示与操作。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["登录", "游客一键进入，不接短信。"],
                ["创角", "3 种族 + 3 职业固定可选。"],
                ["挂机", "单张地图、8 小时封顶离线收益。"],
              ].map(([title, summary]) => (
                <article
                  key={title}
                  className="rounded-2xl border border-amber-100/12 bg-amber-50/6 p-4"
                >
                  <p className="text-lg font-semibold text-amber-50">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{summary}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.32em] text-stone-400">入口</p>
            <h2 className="mt-3 text-2xl font-semibold text-amber-50">游客一键登录</h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              第一次进入会创建游客账号；之后刷新页面会自动恢复同一个游客存档，方便直接测试挂机和离线收益。
            </p>
            <button
              className="mt-8 w-full rounded-2xl bg-amber-300 px-5 py-4 text-base font-semibold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-500"
              disabled={status === "booting" || status === "saving"}
              onClick={() => {
                void guestLogin();
              }}
              type="button"
            >
              {status === "booting" ? "正在创建游客会话..." : "游客进入世界"}
            </button>

            <div className="mt-6 rounded-2xl border border-amber-100/12 bg-stone-950/45 p-4 text-sm leading-7 text-stone-300">
              <p>登录后会立刻进入创角页。</p>
              <p>角色创建成功后直接进入主界面。</p>
              <p>页面底部会保留设置、帮助和离线收益领取入口。</p>
            </div>
          </aside>
        </div>
      </section>
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#243b2e_0%,#111a17_45%,#060807_100%)] px-6 py-8 text-stone-100">
      <section className="mx-auto max-w-6xl rounded-[2rem] border border-emerald-100/10 bg-[linear-gradient(135deg,rgba(16,44,34,0.93),rgba(9,11,10,0.96))] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.38em] text-emerald-200/60">创建角色</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-emerald-50 md:text-5xl">
              先定下你的种族、职业和名字。
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 md:text-base">
              Day0 只开放固定九种组合，不做复杂捏脸。创建成功后，角色数据会立刻落入数据库，并初始化背包、挂机状态和基础任务。
            </p>

            <label className="mt-8 block">
              <span className="text-sm font-medium text-emerald-100">角色名</span>
              <input
                className="mt-3 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-base text-white outline-none transition focus:border-emerald-300"
                maxLength={12}
                onChange={(event) => setName(event.target.value)}
                placeholder="输入 2~12 个字符"
                value={name}
              />
            </label>

            <div className="mt-8">
              <p className="text-sm font-medium text-emerald-100">种族</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {races.map((race) => (
                  <button
                    key={race.key}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      race.key === raceKey
                        ? "border-emerald-300 bg-emerald-300/12"
                        : "border-white/10 bg-white/4 hover:border-emerald-300/50",
                    ].join(" ")}
                    onClick={() => setRaceKey(race.key)}
                    type="button"
                  >
                    <p className="text-lg font-semibold text-white">{race.label}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-300">{race.summary}</p>
                    <p className="mt-3 text-xs text-emerald-100/80">
                      力 {race.stats.strength} / 敏 {race.stats.agility} / 智 {race.stats.intelligence} /
                      体 {race.stats.vitality}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium text-emerald-100">职业</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {classes.map((roleClass) => (
                  <button
                    key={roleClass.key}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      roleClass.key === classKey
                        ? "border-amber-300 bg-amber-300/12"
                        : "border-white/10 bg-white/4 hover:border-amber-300/50",
                    ].join(" ")}
                    onClick={() => setClassKey(roleClass.key)}
                    type="button"
                  >
                    <p className="text-lg font-semibold text-white">{roleClass.label}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-300">{roleClass.summary}</p>
                    <p className="mt-3 text-xs text-amber-100/80">
                      力 {roleClass.stats.strength} / 敏 {roleClass.stats.agility} / 智{" "}
                      {roleClass.stats.intelligence} / 体 {roleClass.stats.vitality}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6">
            <p className="text-xs uppercase tracking-[0.32em] text-stone-400">创建结果预览</p>
            <div className="mt-5 rounded-2xl border border-emerald-100/10 bg-emerald-100/6 p-5">
              <p className="text-sm text-emerald-100/70">即将创建</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">{name || "未命名旅人"}</h2>
              <p className="mt-3 text-sm text-stone-300">
                {races.find((item) => item.key === raceKey)?.label} /{" "}
                {classes.find((item) => item.key === classKey)?.label}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["初始金币", "240"],
                ["以太结晶", "12"],
                ["初始装备", "白装 + 绿装"],
              ].map(([label, value]) => (
                <article
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/4 p-4 text-center"
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-400">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-amber-50">{value}</p>
                </article>
              ))}
            </div>

            <button
              className="mt-6 w-full rounded-2xl bg-emerald-300 px-5 py-4 text-base font-semibold text-stone-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-500"
              disabled={status === "saving" || name.trim().length < 2}
              onClick={() => {
                void createRole({ classKey, name, raceKey });
              }}
              type="button"
            >
              {status === "saving" ? "正在创建角色..." : "创建角色并进入主界面"}
            </button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-stone-950/45 p-4 text-sm leading-7 text-stone-300">
              <p>角色数据会同步创建到 `role / backpack / afk / task`。</p>
              <p>当前版本不做重置和删档入口，避免超出 Day0 范围。</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function PanelButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "w-full rounded-2xl border px-4 py-4 text-left transition",
        active
          ? "border-amber-300 bg-amber-300/14 text-amber-50"
          : "border-white/10 bg-white/4 text-stone-200 hover:border-amber-200/40",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ActivePanelContent({
  panel,
}: {
  panel: PanelKey;
}) {
  const { snapshot } = useGameSession();

  if (!snapshot?.role) {
    return null;
  }

  const race = snapshot.config.races.find((item) => item.key === snapshot.role?.raceKey);
  const roleClass = snapshot.config.classes.find((item) => item.key === snapshot.role?.classKey);

  if (panel === "role") {
    return (
      <div className="space-y-4">
        <article className="rounded-2xl border border-white/10 bg-white/4 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-400">角色信息</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{snapshot.role.name}</h3>
          <p className="mt-2 text-sm text-stone-300">
            {race?.label} / {roleClass?.label}
          </p>
          <p className="mt-4 text-sm leading-7 text-stone-300">{race?.summary}</p>
          <p className="mt-2 text-sm leading-7 text-stone-300">{roleClass?.summary}</p>
        </article>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["力量", snapshot.role.stats.strength],
            ["敏捷", snapshot.role.stats.agility],
            ["智力", snapshot.role.stats.intelligence],
            ["体质", snapshot.role.stats.vitality],
          ].map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-stone-400">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-amber-50">{formatNumber(Number(value))}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (panel === "backpack") {
    return (
      <div className="space-y-3">
        {snapshot.backpack.map((item) => (
          <article key={item.backpackId} className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-lg font-semibold ${rarityLabel(item.rarity)}`}>{item.name}</p>
                <p className="mt-1 text-sm text-stone-400">
                  {item.slot} / {item.rarity === "green" ? "绿装" : "白装"} / 数量 {item.quantity}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-stone-300">
                {item.equipped ? "已装备" : "背包中"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-300">{item.description}</p>
            <p className="mt-3 text-xs text-amber-100/80">属性：{JSON.stringify(item.stats)}</p>
          </article>
        ))}
      </div>
    );
  }

  if (panel === "task") {
    return (
      <div className="space-y-3">
        {snapshot.tasks.map((task) => (
          <article key={task.taskId} className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">{task.title}</p>
                <p className="mt-1 text-sm text-stone-300">{task.description}</p>
              </div>
              <span
                className={[
                  "rounded-full px-3 py-1 text-xs",
                  task.status === "completed"
                    ? "border border-emerald-300/25 bg-emerald-300/12 text-emerald-100"
                    : "border border-amber-300/20 bg-amber-300/10 text-amber-100",
                ].join(" ")}
              >
                {task.status === "completed" ? "已完成" : "进行中"}
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-900">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f6c35b_0%,#f59e0b_100%)]"
                style={{ width: `${Math.min(100, Math.floor((task.progress / task.target) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-stone-400">
              进度 {task.progress}/{task.target}，奖励 {task.rewardGold} 金币 / {task.rewardExp} 经验
            </p>
          </article>
        ))}
      </div>
    );
  }

  if (panel === "settings") {
    return (
      <div className="space-y-4">
        <article className="rounded-2xl border border-white/10 bg-white/4 p-5">
          <p className="text-lg font-semibold text-white">设置</p>
          <p className="mt-2 text-sm leading-7 text-stone-300">
            Day0 先不做复杂设置页，只保留基础说明：游客 token 保存在浏览器本地，刷新后会自动恢复同一角色与挂机状态。
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-stone-300">
          <p>服务端时间是唯一结算基准。</p>
          <p>离线收益最多累计 8 小时。</p>
          <p>Redis 用于镜像挂机状态，数据库保存最终存档。</p>
        </article>
      </div>
    );
  }

  if (panel === "help") {
    return (
      <div className="space-y-4">
        <article className="rounded-2xl border border-white/10 bg-white/4 p-5">
          <p className="text-lg font-semibold text-white">帮助</p>
          <p className="mt-2 text-sm leading-7 text-stone-300">
            先在中间区域选地图，再点开始挂机。重新进入页面后，如果有待领取收益，会自动弹出领取层。
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-stone-300">
          <p>左侧菜单切换角色、背包、任务、挂机面板。</p>
          <p>底部按钮可进入设置、帮助，或手动领取离线收益。</p>
          <p>停止挂机后会保留已累计收益，直到你领取为止。</p>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-white/10 bg-white/4 p-5">
        <p className="text-lg font-semibold text-white">挂机状态</p>
        <p className="mt-2 text-sm leading-7 text-stone-300">
          当前状态：{snapshot.afk.status === "active" ? "挂机中" : "待机"}。
        </p>
      </article>
      <article className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-stone-300">
        <p>地图：{snapshot.afk.currentMap?.label ?? "未选择"}</p>
        <p>当前任务进度：{formatDuration(snapshot.afk.accruedSeconds)} / {formatDuration(snapshot.afk.taskDurationSeconds)}</p>
        <p>待领取收益：金币 {formatNumber(snapshot.afk.pendingReward.gold)} / 经验 {formatNumber(snapshot.afk.pendingReward.exp)}</p>
      </article>
    </div>
  );
}

function MainDashboard() {
  const {
    activePanel,
    claimOfflineReward,
    error,
    dismissError,
    selectedMapKey,
    selectMap,
    setActivePanel,
    snapshot,
    startAfk,
    status,
    stopAfk,
  } = useGameSession();
  const [dismissedRewardKey, setDismissedRewardKey] = useState<string | null>(null);

  const pendingReward = snapshot?.afk.pendingReward;
  const shouldShowRewardModal =
    Boolean(snapshot?.role) &&
    Boolean(pendingReward) &&
    Boolean(snapshot?.afk.shouldShowOfflineRewardModal) &&
    dismissedRewardKey !== JSON.stringify(pendingReward);

  useEffect(() => {
    if (!pendingReward) {
      setDismissedRewardKey(null);
      return;
    }

    const rewardKey = JSON.stringify(pendingReward);

    if (
      pendingReward.gold <= 0 &&
      pendingReward.aetherCrystal <= 0 &&
      pendingReward.exp <= 0
    ) {
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

  const mapCards = snapshot?.config.maps ?? [];
  const role = snapshot?.role;

  const progressCopy = useMemo(() => {
    if (!role) {
      return "0%";
    }

    return formatPercent(role.currentLevelExp, role.nextLevelExp);
  }, [role]);

  const currentTaskDurationSeconds = snapshot?.afk.taskDurationSeconds ?? 0;
  const currentTaskProgressSeconds = snapshot?.afk.accruedSeconds ?? 0;
  const currentTaskProgressPercent =
    currentTaskDurationSeconds > 0 ? Math.min(100, (currentTaskProgressSeconds / currentTaskDurationSeconds) * 100) : 0;
  const currentTaskReward = snapshot?.afk.currentMap
    ? {
        gold: Math.floor((snapshot.afk.currentMap.goldPerMinute * currentTaskDurationSeconds) / 60),
        aetherCrystal: Math.floor((snapshot.afk.currentMap.aetherPerMinute * currentTaskDurationSeconds) / 60),
        exp: Math.floor((snapshot.afk.currentMap.expPerMinute * currentTaskDurationSeconds) / 60),
      }
    : {
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
      };

  if (!snapshot || !role) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#452c16_0%,#17100c_48%,#080707_100%)] px-4 py-4 text-stone-100 md:px-6 md:py-6">
      {error ? (
        <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-300/12 px-4 py-3 text-sm text-rose-100">
          <span>{error}</span>
          <button className="rounded-xl bg-black/20 px-3 py-2" onClick={dismissError} type="button">
            关闭
          </button>
        </div>
      ) : null}

      {shouldShowRewardModal ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(77,43,14,0.96),rgba(16,11,8,0.98))] p-7 shadow-[0_30px_120px_rgba(0,0,0,0.5)]">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-100/65">离线收益</p>
            <h2 className="mt-3 text-3xl font-semibold text-amber-50">本次离线收益已结算</h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              服务端按挂机地图与离线时长完成结算，最多累计 8 小时。领取后会把待领取数据清零，并直接到账。
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["金币", pendingReward?.gold ?? 0],
                ["以太结晶", pendingReward?.aetherCrystal ?? 0],
                ["经验", pendingReward?.exp ?? 0],
              ].map(([label, value]) => (
                <article key={label} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <p className="text-sm text-stone-400">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-50">{formatNumber(Number(value))}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-2xl bg-amber-300 px-4 py-4 text-base font-semibold text-stone-950 transition hover:bg-amber-200"
                onClick={() => {
                  void claimOfflineReward();
                }}
                type="button"
              >
                立即领取
              </button>
              <button
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-stone-200"
                onClick={() => setDismissedRewardKey(JSON.stringify(pendingReward))}
                type="button"
              >
                稍后处理
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="rounded-[2rem] border border-amber-100/10 bg-[linear-gradient(135deg,rgba(61,37,16,0.92),rgba(17,12,10,0.96))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.36)] md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-amber-100/15 bg-amber-100/10 text-3xl font-semibold text-amber-50">
                {role.avatarSeed}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-100/60">主界面</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">{role.name}</h1>
                <p className="mt-2 text-sm text-stone-300">
                  Lv.{role.level} · 经验进度 {role.currentLevelExp}/{role.nextLevelExp || role.currentLevelExp} ·{" "}
                  {progressCopy}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["等级", role.level],
                ["金币", role.gold],
                ["以太结晶", role.aetherCrystal],
                ["可领取金币", pendingReward?.gold ?? 0],
              ].map(([label, value]) => (
                <article key={label} className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-amber-50">{formatNumber(Number(value))}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[220px_1fr_320px]">
          <aside className="rounded-[1.75rem] border border-white/10 bg-black/18 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-stone-400">菜单</p>
            <div className="space-y-3">
              {[
                ["role", "角色"],
                ["backpack", "背包"],
                ["task", "任务"],
                ["afk", "挂机"],
              ].map(([key, label]) => (
                <PanelButton
                  key={key}
                  active={activePanel === key}
                  label={label}
                  onClick={() => setActivePanel(key as PanelKey)}
                />
              ))}
            </div>
          </aside>

          <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.1))] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-400">挂机场景</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">野外地图入口</h2>
                <p className="mt-2 text-sm leading-7 text-stone-300">
                  当前版本只保留一张挂机地图。所有时间计算均以服务器时间为准，离线收益最多累计 8 小时。
                </p>
              </div>
              <div className="rounded-2xl border border-amber-100/12 bg-amber-100/8 px-4 py-3 text-sm text-amber-50">
                状态：{snapshot.afk.status === "active" ? "挂机中" : "可操作"}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {mapCards.map((map) => {
                const active = selectedMapKey === map.key;

                return (
                  <button
                    key={map.key}
                    className={[
                      "rounded-[1.5rem] border p-5 text-left transition",
                      active
                        ? "border-amber-300 bg-amber-300/12"
                        : "border-white/10 bg-white/4 hover:border-amber-200/40",
                    ].join(" ")}
                    onClick={() => selectMap(map.key as MapKey)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-2xl font-semibold text-white">{map.label}</p>
                        <p className="mt-2 text-sm leading-7 text-stone-300">{map.summary}</p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-stone-300">
                        {active ? "已选择" : "点击选择"}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {[
                        ["金币/分", map.goldPerMinute],
                        ["以太/分", map.aetherPerMinute],
                        ["经验/分", map.expPerMinute],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
                          <p className="text-xs text-stone-400">{label}</p>
                          <p className="mt-2 text-lg font-semibold text-amber-50">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <article className="rounded-[1.5rem] border border-amber-100/12 bg-amber-100/8 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-amber-100/65">进行中的任务</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">挂机结算进度</h3>
                    <p className="mt-2 text-sm leading-7 text-stone-300">
                      在线停留时，进度条每跑满一次就自动结算一轮收益，公式和离线收益保持一致。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">本轮进度</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-50">
                      {formatClock(currentTaskProgressSeconds)} / {formatClock(currentTaskDurationSeconds)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-4 overflow-hidden rounded-full bg-stone-950">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#f6c35b_0%,#fb923c_100%)] transition-[width] duration-700"
                    style={{ width: `${currentTaskProgressPercent}%` }}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    ["每轮金币", currentTaskReward.gold],
                    ["每轮以太", currentTaskReward.aetherCrystal],
                    ["每轮经验", currentTaskReward.exp],
                  ].map(([label, value]) => (
                    <article key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-stone-400">{label}</p>
                      <p className="mt-2 text-xl font-semibold text-amber-50">{formatNumber(Number(value))}</p>
                    </article>
                  ))}
                </div>

                <p className="mt-4 text-sm text-stone-300">
                  {snapshot.afk.status === "active"
                    ? `距离下一轮自动结算还有 ${formatDuration(currentTaskDurationSeconds - currentTaskProgressSeconds)}。`
                    : "开始挂机后会自动循环执行这轮任务。"}
                </p>
              </article>

              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <p className="text-sm text-stone-400">挂机中</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {snapshot.afk.status === "active" ? "是" : "否"}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <p className="text-sm text-stone-400">当前执行进度</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatDuration(currentTaskProgressSeconds)}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <p className="text-sm text-stone-400">本轮剩余时间</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatDuration(currentTaskDurationSeconds - currentTaskProgressSeconds)}
                  </p>
                </article>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  ["当前累计金币", snapshot.afk.pendingReward.gold],
                  ["当前累计以太", snapshot.afk.pendingReward.aetherCrystal],
                  ["当前累计经验", snapshot.afk.pendingReward.exp],
                ].map(([label, value]) => (
                  <article key={label} className="rounded-2xl border border-amber-100/12 bg-amber-100/7 p-4">
                    <p className="text-sm text-stone-400">{label}</p>
                    <p className="mt-2 text-xl font-semibold text-amber-50">{formatNumber(Number(value))}</p>
                  </article>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-2xl bg-emerald-300 px-4 py-4 text-base font-semibold text-stone-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-stone-500"
                  disabled={snapshot.afk.status === "active" || status === "saving"}
                  onClick={() => {
                    void startAfk();
                  }}
                  type="button"
                >
                  {status === "saving" && snapshot.afk.status === "idle" ? "提交中..." : "开始挂机"}
                </button>
                <button
                  className="flex-1 rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-4 text-base font-semibold text-rose-100 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:border-stone-500 disabled:bg-stone-700 disabled:text-stone-300"
                  disabled={snapshot.afk.status === "idle" || status === "saving"}
                  onClick={() => {
                    void stopAfk();
                  }}
                  type="button"
                >
                  {status === "saving" && snapshot.afk.status === "active" ? "提交中..." : "停止挂机"}
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-[1.75rem] border border-white/10 bg-black/18 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-400">当前面板</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {{
                afk: "挂机",
                backpack: "背包",
                help: "帮助",
                role: "角色",
                settings: "设置",
                task: "任务",
              }[activePanel]}
            </h2>
            <div className="mt-5">
              <ActivePanelContent panel={activePanel} />
            </div>
          </aside>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-black/18 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <button
              className="flex-1 rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-left text-stone-100 transition hover:border-amber-200/40"
              onClick={() => setActivePanel("settings")}
              type="button"
            >
              设置
            </button>
            <button
              className="flex-1 rounded-2xl border border-white/10 bg-white/4 px-4 py-4 text-left text-stone-100 transition hover:border-amber-200/40"
              onClick={() => setActivePanel("help")}
              type="button"
            >
              帮助
            </button>
            <button
              className="flex-1 rounded-2xl bg-amber-300 px-4 py-4 text-left font-semibold text-stone-950 transition hover:bg-amber-200"
              onClick={() => {
                void claimOfflineReward();
              }}
              type="button"
            >
              领取挂机收益
            </button>
          </div>
        </section>
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
