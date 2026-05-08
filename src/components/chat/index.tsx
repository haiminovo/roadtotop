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
    <div className="flex gap-3 rounded-[0.95rem] border border-white/8 bg-slate-950/34 px-3 py-2.5">
      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accentClassName}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <span className="shrink-0 text-[10px] text-slate-500">{meta}</span>
        </div>
        <div className="mt-1 text-xs leading-6 text-slate-300">{body}</div>
      </div>
    </div>
  );
}

function RoleProfileModal({
  onClose,
  role,
}: {
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

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/72 px-4"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-2xl rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-sky-100/55">{copy.roleProfileTitle}</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
              {role?.name ?? copy.roleProfileTitle}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {role ? `${messages.common.levelShort}${role.level} · ${raceLabel} / ${classLabel}` : copy.roleMissing}
            </p>
            {role ? (
              <p className="mt-2 text-xs font-medium tracking-[0.24em] text-cyan-200/80">
                {role.avatarSeed}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">{copy.roleProfileSummary}</p>
            )}
          </div>
          <button
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/25 hover:text-white"
            onClick={onClose}
            type="button"
          >
            {messages.common.close}
          </button>
        </div>

        {role ? (
          <>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                <span>{messages.game.dashboard.currentHealth}</span>
                <span>{Math.floor(healthPercent)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-950/90">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300"
                  style={{ width: `${healthPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{messages.game.dashboard.currentHealth}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white">
                  {formatNumber(role.currentHealth, locale)} / {formatNumber(role.maxHealth, locale)}
                </p>
              </div>
              <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{messages.game.dashboard.gold}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white">{formatNumber(role.gold, locale)}</p>
              </div>
              <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{messages.game.dashboard.aetherCrystal}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white">{formatNumber(role.aetherCrystal, locale)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(role.stats).map(([key, value]) => (
                <div key={key} className="rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{statLabel(key, messages)}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-white">{formatNumber(value, locale)}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-[0.32em] text-sky-100/55">{copy.equippedItems}</p>
              <div className="mt-3 space-y-2">
                {role.equippedItems.length === 0 ? (
                  <p className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
                    {copy.equippedEmpty}
                  </p>
                ) : (
                  role.equippedItems.map((item) => (
                    <div
                      key={item.backpackId}
                      className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {slotLabel(item.slot, messages)} · {formatEquippedGroupSummary(item.equippedSlotGroups, messages)}
                          </p>
                        </div>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
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
  );
}

export default function Chat() {
  const { locale, messages: i18n } = useI18n();
  const { snapshot } = useGameSession();
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
  const [activeTab, setActiveTab] = useState<"chat" | "event">("chat");
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ChatRoleProfile | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const channelMenuRef = useRef<HTMLDivElement | null>(null);
  const activeChannelMeta = channels.find((channel) => channel.key === activeChannel);
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const activityItems = useMemo(() => {
    if (snapshot?.afk.battle?.active) {
      return snapshot.afk.battle.logs.map((log) => ({
        accentClassName: log.type === "result" ? "bg-emerald-300" : log.type === "guard" ? "bg-amber-300" : log.type === "spell" ? "bg-fuchsia-300" : "bg-sky-300",
        body: log.text,
        id: log.id,
        meta: formatEventTime(log.timestamp, locale),
        title: i18n.game.dashboard.battleLog,
      }));
    }

    return (snapshot?.afk.recentEncounters ?? []).map((encounter) => ({
      accentClassName: encounter.tier === "legendary" ? "bg-rose-300" : encounter.tier === "rare" ? "bg-amber-300" : "bg-sky-300",
      body: `${encounter.description} ${encounter.reward.gold > 0 || encounter.reward.exp > 0 || encounter.reward.aetherCrystal > 0 ? `· 奖励：金 ${encounter.reward.gold} / 经 ${encounter.reward.exp} / 以太 ${encounter.reward.aetherCrystal}` : ""}`.trim(),
      id: encounter.id,
      meta: formatEventTime(encounter.triggeredAt, locale),
      title: encounter.title,
    }));
  }, [i18n.game.dashboard.battleLog, locale, snapshot?.afk.battle, snapshot?.afk.recentEncounters]);

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

  const messageItems = useMemo(() => messages.map((message) => {
    const canOpenRole = Boolean(message.senderRole);

    return (
      <div
        key={message.id}
        className={[
          "flex items-baseline gap-2 border-b border-white/6 py-1.5 text-sm last:border-b-0",
          message.senderUserId === currentUserId
            ? "text-cyan-100"
            : "text-slate-100",
        ].join(" ")}
        title={`${message.senderName}${shouldShowGuestId(message.senderName) ? ` ${message.senderUserId}` : ""} ${message.content}`}
      >
        <button
          className={[
            "shrink-0 text-[11px] font-semibold tracking-[0.08em] transition",
            message.senderUserId === currentUserId ? "text-cyan-200" : "text-slate-300",
            canOpenRole ? "cursor-pointer hover:text-white" : "cursor-default",
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
        {shouldShowGuestId(message.senderName) ? (
          <span className="shrink-0 font-mono text-[10px] text-slate-500">
            {message.senderUserId}
          </span>
        ) : null}
        <span className="shrink-0 text-[10px] text-slate-600">:</span>
        <p className="min-w-0 flex-1 truncate whitespace-nowrap text-slate-100">{message.content}</p>
      </div>
    );
  }), [currentUserId, messages]);

  return (
    <>
      <section className="flex min-h-[18rem] flex-col rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,23,40,0.96),rgba(11,16,30,0.98))] p-4 text-white shadow-[0_12px_36px_rgba(0,0,0,0.22)] xl:h-full xl:min-h-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <button
                className={[
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                  activeTab === "chat"
                    ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white",
                ].join(" ")}
                onClick={() => setActiveTab("chat")}
                type="button"
              >
                {copy.channel}
              </button>
              <button
                className={[
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                  activeTab === "event"
                    ? "border-amber-300/35 bg-amber-300/14 text-amber-50"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white",
                ].join(" ")}
                onClick={() => setActiveTab("event")}
                type="button"
              >
                {copy.event}
              </button>
            </div>
          </div>
          {activeTab === "chat" ? (
            <div className="flex items-center gap-2">
              {totalUnreadCount > 0 ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-medium text-amber-100">
                  {copy.unread} {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              ) : null}
              <div className="relative" ref={channelMenuRef}>
                <button
                  aria-expanded={isChannelMenuOpen}
                  aria-haspopup="menu"
                  className={[
                    "flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                    isChannelMenuOpen
                      ? "border-cyan-300/35 bg-cyan-300/14 text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.08)]"
                      : "border-white/10 bg-white/[0.045] text-slate-200 hover:border-cyan-300/25 hover:text-white",
                  ].join(" ")}
                  onClick={() => setIsChannelMenuOpen((current) => !current)}
                  type="button"
                >
                  <span>{activeChannelMeta?.label ?? copy.channel}</span>
                  {unreadCounts[activeChannel] > 0 ? (
                    <span className="rounded-full bg-cyan-100/12 px-1.5 py-0.5 text-[10px] leading-none text-cyan-100">
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
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-32 overflow-hidden rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,24,43,0.98),rgba(10,14,28,0.98))] p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.38)]">
                    {channels.map((channel) => {
                      const unreadCount = unreadCounts[channel.key];

                      return (
                        <button
                          key={channel.key}
                          className={[
                            "flex w-full items-center justify-between rounded-[0.8rem] px-3 py-2 text-left text-[11px] transition",
                            activeChannel === channel.key
                              ? "bg-cyan-300/12 text-cyan-50"
                              : "text-slate-300 hover:bg-white/[0.05] hover:text-white",
                          ].join(" ")}
                          onClick={() => {
                            setActiveChannel(channel.key);
                            setIsChannelMenuOpen(false);
                          }}
                          type="button"
                        >
                          <span>{channel.label}</span>
                          {unreadCount > 0 ? (
                            <span className="rounded-full bg-amber-300/12 px-1.5 py-0.5 text-[10px] leading-none text-amber-100">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          ) : activeChannel === channel.key ? (
                            <span className="text-[10px] text-cyan-200">{copy.currentTag}</span>
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

        <div className="mb-2 min-h-0 flex-1 overflow-y-auto rounded-[1.05rem] border border-white/8 bg-slate-900/70 px-3">
          {activeTab === "chat" ? (
            messages.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">{copy.quiet}</p>
            ) : (
              messageItems
            )
          ) : (
            <div className="space-y-2 py-3">
              {activityItems.length === 0 ? (
                <p className="text-sm text-slate-500">{copy.eventQuiet}</p>
              ) : (
                activityItems.map((item) => (
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
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void sendMessage().catch(() => {});
                }
              }}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
              placeholder={`${copy.sendTo}${channels.find((channel) => channel.key === activeChannel)?.label ?? copy.currentChannel}...`}
            />
            <button
              onClick={() => {
                void sendMessage().catch(() => {});
              }}
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
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
