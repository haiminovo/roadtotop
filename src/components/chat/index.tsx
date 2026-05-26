'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { getClassCopy, getRaceCopy } from "@/lib/i18n";
import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";
import type { ChatRoleProfile } from "@/features/chat/types";
import { useGameSession } from "@/features/game/context/game-session-provider";
import { useI18n } from "@/lib/i18n/provider";

function shouldShowGuestId(senderName: string) {
  const normalizedName = senderName.trim();
  return normalizedName === "游客" || normalizedName.startsWith("游客");
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(Math.max(0, Math.floor(value)));
}

function slotLabel(slot: string, messages: ReturnType<typeof useI18n>["messages"]) {
  return messages.slots[slot as keyof typeof messages.slots] ?? slot;
}

function statLabel(statKey: string, messages: ReturnType<typeof useI18n>["messages"]) {
  return messages.stats[statKey as keyof typeof messages.stats] ?? statKey;
}

function bodySlotKeyLabel(slotKey: string, messages: ReturnType<typeof useI18n>["messages"]) {
  const [slotType, indexText] = slotKey.split("-");
  const index = Number(indexText);
  const baseLabel = slotLabel(slotType, messages);

  if (!Number.isFinite(index)) {
    return baseLabel;
  }

  return `${baseLabel}${index}`;
}

function formatEquippedGroupSummary(groups: string[][], messages: ReturnType<typeof useI18n>["messages"]) {
  if (groups.length === 0) {
    return messages.common.noneEquipped;
  }

  return groups
    .map((group) => group.map((slotKey) => bodySlotKeyLabel(slotKey, messages)).join(" + "))
    .join(" / ");
}

function formatEventTime(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleString(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

const CHAT_MESSAGE_MAX_LENGTH = 100;

function EventFeedItem({
  accentClassName,
  body,
  meta,
  title,
}: {
  accentClassName: string;
  body: React.ReactNode;
  meta: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-2 sm:px-3">
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${accentClassName}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="break-words text-[13px] font-semibold leading-5 text-white sm:truncate sm:text-sm">{title}</p>
          <span className="shrink-0 text-[10px] leading-none text-slate-500">{meta}</span>
        </div>
        <div className="mt-0.5 text-[12px] leading-5 text-slate-300 sm:text-[13px] sm:leading-5">{body}</div>
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold leading-5 text-slate-100">{value}</p>
    </div>
  );
}

function CompactInlineStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="text-sm font-medium leading-5 text-slate-100">{value}</span>
    </div>
  );
}

function RoleProfileModal({
  isChallenging = false,
  onChallenge,
  onClose,
  role,
}: {
  isChallenging?: boolean;
  onChallenge?: ((roleId: string) => void) | null;
  onClose: () => void;
  role: ChatRoleProfile | null;
}) {
  const { locale, messages } = useI18n();
  const copy = messages.chat;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const raceLabel = role ? getRaceCopy(locale, role.raceKey)?.label ?? role.raceKey : "";
  const classLabel = role ? getClassCopy(locale, role.classKey)?.label ?? role.classKey : "";
  const healthPercent = role ? Math.max(0, Math.min(100, (role.currentHealth / Math.max(1, role.maxHealth)) * 100)) : 0;
  const canChallenge = Boolean(role?.roleId && onChallenge);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/70 px-2 py-2 sm:px-4 sm:py-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] sm:max-h-[calc(100dvh-2rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{copy.roleProfileTitle}</p>
              <h3 className="mt-2 break-words text-xl font-semibold tracking-[-0.03em] text-white sm:text-2xl">
                {role?.name ?? copy.roleProfileTitle}
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-slate-300 sm:text-sm sm:leading-6">
                {role ? `${messages.common.levelShort}${role.level} · ${raceLabel} / ${classLabel}` : copy.roleMissing}
              </p>
              {role ? (
                <p className="mt-1 text-[11px] font-medium tracking-[0.18em] text-[#58a6ff]">
                  {role.avatarSeed}
                </p>
              ) : (
                <p className="mt-2 text-[13px] leading-5 text-slate-400 sm:text-sm sm:leading-6">{copy.roleProfileSummary}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canChallenge ? (
                <button
                  className="rounded-md border border-rose-800/60 bg-rose-900/20 px-2.5 py-2 text-xs text-rose-200 transition hover:bg-rose-900/35 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
                  disabled={isChallenging}
                  onClick={() => {
                    if (role?.roleId) {
                      onChallenge?.(role.roleId);
                    }
                  }}
                  type="button"
                >
                  {isChallenging ? copy.pkLoading : copy.pkAction}
                </button>
              ) : null}
              <button
                className="rounded-md border border-[#30363d] bg-[#21262d] px-2.5 py-2 text-xs text-slate-200 transition hover:border-[#484f58] hover:text-white sm:px-3 sm:text-sm"
                onClick={onClose}
                type="button"
              >
                {messages.common.close}
              </button>
            </div>
          </div>

          {role ? (
            <>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                  <span>{messages.game.dashboard.currentHealth}</span>
                  <span>{Math.floor(healthPercent)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#21262d]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"
                    style={{ width: `${healthPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-md border border-[#30363d] bg-[#11161d] p-2.5">
                  <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-4">
                    <CompactInlineStat label={messages.game.dashboard.level} value={formatNumber(role.level, locale)} />
                    <CompactInlineStat label={statLabel("strength", messages)} value={formatNumber(role.stats.strength, locale)} />
                    <CompactInlineStat label={statLabel("agility", messages)} value={formatNumber(role.stats.agility, locale)} />
                    <CompactInlineStat label={statLabel("vitality", messages)} value={formatNumber(role.stats.vitality, locale)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 lg:grid-cols-2">
                  <CompactMetric
                    label={messages.game.dashboard.currentHealth}
                    value={`${formatNumber(role.currentHealth, locale)} / ${formatNumber(role.maxHealth, locale)}`}
                  />
                  <CompactMetric label={messages.game.dashboard.gold} value={formatNumber(role.gold, locale)} />
                  <CompactMetric label={messages.game.dashboard.aetherCrystal} value={formatNumber(role.aetherCrystal, locale)} />
                  <CompactMetric label={statLabel("intelligence", messages)} value={formatNumber(role.stats.intelligence, locale)} />
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{messages.game.dashboard.characterSheet}</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-4">
                  {Object.entries(role.stats).map(([key, value]) => (
                    <CompactMetric key={key} label={statLabel(key, messages)} value={formatNumber(value, locale)} />
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{copy.equippedItems}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {role.equippedItems.length === 0 ? (
                    <p className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-[13px] text-slate-400 sm:col-span-2 sm:text-sm">
                      {copy.equippedEmpty}
                    </p>
                  ) : (
                    role.equippedItems.map((item) => (
                      <div
                        key={item.backpackId}
                        className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold leading-5 text-white">{item.name}</p>
                            <p className="mt-0.5 text-[11px] leading-4.5 text-slate-400">
                              {slotLabel(item.slot, messages)}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-4.5 text-slate-500">
                              {formatEquippedGroupSummary(item.equippedSlotGroups, messages)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[#1f6feb]/30 bg-[#1f6feb]/10 px-2 py-0.5 text-[10px] font-medium text-[#58a6ff]">
                            x{formatNumber(item.equippedCount, locale)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const { locale, messages: i18n } = useI18n();
  const { challengePlayer, snapshot, status } = useGameSession();
  const copy = i18n.chat;
  const {
    activeChannel,
    channels,
    currentUserId,
    input,
    isRealtimeReady,
    messages,
    remainingCooldownMs,
    sendMessage,
    sendCooldownSeconds,
    setActiveChannel,
    setInput,
    unreadCounts,
  } = useChatSocket();
  const [activeTab, setActiveTab] = useState<"chat" | "battle" | "encounter">("chat");
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ChatRoleProfile | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const channelMenuRef = useRef<HTMLDivElement | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const activeChannelMeta = channels.find((channel) => channel.key === activeChannel);
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const battleItems = useMemo(() => (
    (snapshot?.afk.battle?.logs ?? []).map((log) => ({
      accentClassName: log.type === "result"
        ? "bg-emerald-300"
        : log.type === "penalty"
          ? "bg-rose-300"
          : log.type === "guard"
            ? "bg-amber-300"
            : log.type === "spell"
              ? "bg-fuchsia-300"
              : "bg-sky-300",
      body: log.text,
      id: log.id,
      meta: formatEventTime(log.timestamp, locale),
      title: i18n.game.dashboard.battleLog,
    }))
  ), [i18n.game.dashboard.battleLog, locale, snapshot?.afk.battle?.logs]);

  const encounterItems = useMemo(() => (
    (snapshot?.afk.recentEncounters ?? []).map((encounter) => ({
      accentClassName: encounter.tier === "legendary" ? "bg-rose-300" : encounter.tier === "rare" ? "bg-amber-300" : "bg-sky-300",
      body: `${encounter.description} ${encounter.reward.gold > 0 || encounter.reward.exp > 0 || encounter.reward.aetherCrystal > 0 ? `· 奖励：金 ${encounter.reward.gold} / 经 ${encounter.reward.exp} / 以太 ${encounter.reward.aetherCrystal}` : ""}`.trim(),
      id: encounter.id,
      meta: formatEventTime(encounter.triggeredAt, locale),
      title: encounter.title,
    }))
  ), [locale, snapshot?.afk.recentEncounters]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!channelMenuRef.current?.contains(event.target as Node)) {
        setIsChannelMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsChannelMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "chat") {
      return;
    }

    const element = feedScrollRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [activeChannel, activeTab, messages.length]);

  const messageItems = useMemo(() => messages.map((message) => {
    const canOpenRole = Boolean(message.senderRole);
    const isOwnMessage = message.senderUserId === currentUserId;
    const guestSuffix = shouldShowGuestId(message.senderName) ? message.senderUserId.slice(-6) : null;

    return (
      <div
        key={message.id}
        className={[
          "flex border-b border-[#21262d]/75 py-1.5 text-sm last:border-b-0 sm:py-2",
          isOwnMessage ? "justify-end" : "justify-start",
        ].join(" ")}
        title={`${message.senderName}${shouldShowGuestId(message.senderName) ? ` ${message.senderUserId}` : ""} ${message.content}`}
      >
        <div
          className={[
            "max-w-[88%] rounded-md border px-2.5 py-2 shadow-sm sm:max-w-[82%] sm:px-3",
            isOwnMessage
              ? "border-[#1f6feb]/40 bg-[#1f6feb]/14 text-sky-50"
              : "border-[#30363d] bg-[#11161d] text-slate-100",
          ].join(" ")}
        >
          <div className={["mb-1 flex items-center gap-1.5", isOwnMessage ? "justify-end" : "justify-start"].join(" ")}>
            {isOwnMessage ? (
              <span className="rounded-full border border-[#58a6ff]/35 bg-[#58a6ff]/10 px-1.5 py-0.5 text-[10px] leading-none text-[#79c0ff]">
                我
              </span>
            ) : null}
            <button
              className={[
                "max-w-36 truncate text-left text-[11px] font-medium leading-none transition sm:max-w-44 sm:text-xs",
                isOwnMessage ? "text-[#79c0ff]" : "text-slate-400",
                canOpenRole ? "cursor-pointer hover:text-white hover:underline decoration-[#58a6ff]/50" : "cursor-default",
              ].join(" ")}
              disabled={!canOpenRole}
              onClick={() => {
                setSelectedRole(message.senderRole);
                setIsRoleModalOpen(true);
              }}
              type="button"
            >
              {message.senderName}
            </button>
            {guestSuffix ? (
              <span className="font-mono text-[10px] leading-none text-slate-500/70">
                #{guestSuffix}
              </span>
            ) : null}
          </div>
          <p className="min-w-0 whitespace-pre-wrap break-words text-left text-[13px] leading-5 sm:text-sm sm:leading-6">{message.content}</p>
        </div>
      </div>
    );
  }), [currentUserId, messages]);

  return (
    <>
      <section className="flex h-80 max-h-[65vh] min-h-80 flex-col overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] p-2 text-slate-200 sm:h-96 sm:min-h-96 sm:p-3 xl:h-full xl:max-h-none xl:min-h-0">
        <div className="mb-1.5 flex items-center justify-between gap-2 sm:mb-2">
          <div className="min-w-0 flex flex-1 items-center gap-1.5 sm:gap-2">
              <button
                className={[
                  "relative inline-flex min-h-8 items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium leading-none transition sm:min-h-9 sm:px-3",
                  activeTab === "chat"
                    ? "border-[#1f6feb] bg-[#1f6feb]/10 text-[#58a6ff]"
                    : "border-[#30363d] bg-[#21262d] text-slate-400 hover:text-white",
                ].join(" ")}
                onClick={() => setActiveTab("chat")}
                type="button"
              >
                {copy.channel}
                {totalUnreadCount > 0 ? (
                  <span className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full border border-amber-200/35 bg-amber-400 px-1 text-[9px] font-semibold leading-none text-slate-950 shadow-[0_4px_16px_rgba(251,191,36,0.35)]">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                ) : null}
              </button>
              <button
                className={[
                  "inline-flex min-h-8 items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium leading-none transition sm:min-h-9 sm:px-3",
                  activeTab === "battle"
                    ? "border-[#a371f7] bg-[#a371f7]/10 text-[#bc8cff]"
                    : "border-[#30363d] bg-[#21262d] text-slate-400 hover:text-white",
                ].join(" ")}
                onClick={() => setActiveTab("battle")}
                type="button"
              >
                {copy.battle}
              </button>
              <button
                className={[
                  "inline-flex min-h-8 items-center justify-center rounded-md border px-2.5 py-1 text-xs font-medium leading-none transition sm:min-h-9 sm:px-3",
                  activeTab === "encounter"
                    ? "border-amber-600 bg-amber-600/10 text-amber-300"
                    : "border-[#30363d] bg-[#21262d] text-slate-400 hover:text-white",
                ].join(" ")}
                onClick={() => setActiveTab("encounter")}
                type="button"
              >
                {copy.encounter}
              </button>
          </div>
          {activeTab === "chat" ? (
            <div className="flex shrink-0 items-center justify-end">
              <div className="relative" ref={channelMenuRef}>
                <button
                  aria-expanded={isChannelMenuOpen}
                  aria-haspopup="menu"
                  className={[
                    "inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium leading-none transition sm:min-h-9 sm:gap-2 sm:px-3",
                    isChannelMenuOpen
                      ? "border-[#1f6feb] bg-[#1f6feb]/10 text-[#58a6ff]"
                      : "border-[#30363d] bg-[#21262d] text-slate-200 hover:border-[#484f58] hover:text-white",
                  ].join(" ")}
                  onClick={() => setIsChannelMenuOpen((current) => !current)}
                  type="button"
                >
                  <span>{activeChannelMeta?.label ?? copy.channel}</span>
                  {unreadCounts[activeChannel] > 0 ? (
                    <span className="rounded-full bg-[#1f6feb]/15 px-1.5 py-0.5 text-[10px] leading-none text-[#58a6ff]">
                      {unreadCounts[activeChannel] > 99 ? "99+" : unreadCounts[activeChannel]}
                    </span>
                  ) : null}
                  <span
                    className={[
                      "text-[9px] text-slate-400 transition-transform",
                      isChannelMenuOpen ? "rotate-180" : "",
                    ].join(" ")}
                  >
                    v
                  </span>
                </button>

                {isChannelMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-32 overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] p-1.5">
                    {channels.map((channel) => {
                      const unreadCount = unreadCounts[channel.key];

                      return (
                        <button
                          key={channel.key}
                          className={[
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[11px] transition",
                            activeChannel === channel.key
                              ? "bg-[#1f6feb]/10 text-[#58a6ff]"
                              : "text-slate-300 hover:bg-[#21262d] hover:text-white",
                          ].join(" ")}
                          onClick={() => {
                            setActiveChannel(channel.key);
                            setIsChannelMenuOpen(false);
                          }}
                          type="button"
                        >
                          <span>{channel.label}</span>
                          {unreadCount > 0 ? (
                            <span className="rounded-full bg-amber-600/15 px-1.5 py-0.5 text-[10px] leading-none text-amber-300">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          ) : activeChannel === channel.key ? (
                            <span className="text-[10px] text-[#58a6ff]">{copy.currentTag}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div ref={feedScrollRef} className="mb-1.5 min-h-0 flex-1 overflow-y-auto rounded-md border border-[#30363d] bg-[#0d1117] px-2.5 sm:mb-2 sm:px-3">
          {activeTab === "chat" ? (
            messages.length === 0 ? (
              <p className="py-2.5 text-[13px] text-slate-500 sm:py-3 sm:text-sm">{copy.quiet}</p>
            ) : (
              messageItems
            )
          ) : activeTab === "battle" ? (
            <div className="space-y-1.5 py-2 sm:space-y-2 sm:py-3">
              {battleItems.length === 0 ? (
                <p className="text-[13px] text-slate-500 sm:text-sm">{copy.battleQuiet}</p>
              ) : (
                battleItems.map((item) => (
                  <EventFeedItem
                    key={item.id}
                    accentClassName={item.accentClassName}
                    body={item.body}
                    meta={item.meta}
                    title={item.title}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-1.5 py-2 sm:space-y-2 sm:py-3">
              {encounterItems.length === 0 ? (
                <p className="text-[13px] text-slate-500 sm:text-sm">{copy.eventQuiet}</p>
              ) : (
                encounterItems.map((item) => (
                  <EventFeedItem
                    key={item.id}
                    accentClassName={item.accentClassName}
                    body={item.body}
                    meta={item.meta}
                    title={item.title}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {activeTab === "chat" ? (
          <div className="flex shrink-0 gap-1.5 sm:gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, CHAT_MESSAGE_MAX_LENGTH))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void sendMessage().catch(() => {});
                }
              }}
              className="h-10 flex-1 rounded-md border border-[#30363d] bg-[#0d1117] px-3 text-[13px] leading-none text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-[#484f58] sm:h-11 sm:text-sm"
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              placeholder={`${copy.sendTo}${channels.find((channel) => channel.key === activeChannel)?.label ?? copy.currentChannel}...`}
            />
            <button
              onClick={() => {
                void sendMessage().catch(() => {});
              }}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-[#1f6feb] px-3.5 text-[13px] font-medium leading-none text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:px-4 sm:text-sm"
              disabled={!isRealtimeReady || input.trim().length === 0 || remainingCooldownMs > 0}
              type="button"
            >
              {remainingCooldownMs > 0 ? `${sendCooldownSeconds}s` : copy.send}
            </button>
          </div>
        ) : null}
      </section>

      {isRoleModalOpen ? (
        <RoleProfileModal
          isChallenging={status === "saving"}
          onChallenge={(roleId) => {
            void challengePlayer(roleId).then(() => {
              setIsRoleModalOpen(false);
              setSelectedRole(null);
            }).catch(() => {});
          }}
          onClose={() => {
            setIsRoleModalOpen(false);
            setSelectedRole(null);
          }}
          role={selectedRole}
        />
      ) : null}
    </>
  );
}
