'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";
import type { ChatRoleProfile } from "@/features/chat/types";
import { useGameSession } from "@/features/game/context/game-session-provider";
import { useI18n } from "@/lib/i18n/provider";
import RoleProfileCard from "./role-profile-card";

function shouldShowGuestId(senderName: string) {
  const normalizedName = senderName.trim();
  return normalizedName === "游客" || normalizedName.startsWith("游客");
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
      color: log.type === "result"
        ? "text-emerald-400"
        : log.type === "penalty"
          ? "text-rose-400"
          : log.type === "guard"
            ? "text-amber-400"
            : log.type === "spell"
              ? "text-fuchsia-400"
              : log.type === "dot"
                ? "text-rose-300"
                : log.type === "reward" || log.type === "drop"
                  ? "text-emerald-300"
                  : "text-sky-300",
      text: log.text,
      id: log.id,
      time: formatEventTime(log.timestamp, locale),
    }))
  ), [locale, snapshot?.afk.battle?.logs]);

  const encounterItems = useMemo(() => (
    (snapshot?.afk.recentEncounters ?? []).map((encounter) => ({
      color: encounter.tier === "legendary" ? "text-amber-300" : encounter.tier === "rare" ? "text-amber-400/80" : "text-slate-300",
      text: `【${encounter.title}】${encounter.description}${encounter.reward.gold > 0 || encounter.reward.exp > 0 || encounter.reward.aetherCrystal > 0 ? ` [金${encounter.reward.gold} 经${encounter.reward.exp} 以太${encounter.reward.aetherCrystal}]` : ""}`,
      id: encounter.id,
      time: formatEventTime(encounter.triggeredAt, locale),
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
    const timeStr = formatEventTime(message.createdAt, locale);

    return (
      <div
        key={message.id}
        className="break-words py-px leading-[1.35rem]"
        title={`${message.senderName}${shouldShowGuestId(message.senderName) ? ` ${message.senderUserId}` : ""} ${message.content}`}
      >
        <span className="mr-1 text-[9px] text-slate-600">{timeStr}</span>
        <button
          className={[
            "mr-1 text-[11px] font-medium transition",
            isOwnMessage ? "text-[#79c0ff]" : "text-slate-400",
            canOpenRole ? "cursor-pointer hover:text-white" : "cursor-default",
          ].join(" ")}
          disabled={!canOpenRole}
          onClick={() => {
            setSelectedRole(message.senderRole);
            setIsRoleModalOpen(true);
          }}
          type="button"
        >
          {message.senderName}{guestSuffix ? `#${guestSuffix}` : ""}
        </button>
        <span className="text-[11px] text-slate-200">: {message.content}</span>
      </div>
    );
  }), [currentUserId, locale, messages]);

  return (
    <>
      <section className="game-panel flex h-[22rem] max-h-[70svh] min-h-[18rem] flex-col overflow-hidden rounded-lg text-slate-200 sm:h-96 sm:min-h-80 xl:h-full xl:max-h-none xl:min-h-0">
        {/* Tabs */}
        <div className="flex min-h-8 items-center border-b border-white/[0.06] px-1.5 py-0.5 sm:px-2">
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
            {(["chat", "battle", "encounter"] as const).map((tab) => (
              <button
                key={tab}
                className={[
                  "relative min-h-6 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none transition",
                  activeTab === tab
                    ? "bg-white/[0.07] text-white"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
                ].join(" ")}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab === "chat" ? copy.channel : tab === "battle" ? copy.battle : copy.encounter}
                {tab === "chat" && totalUnreadCount > 0 ? (
                  <span className="ml-0.5 inline-flex min-h-3 min-w-3 items-center justify-center rounded-full bg-amber-500 px-1 text-[7px] font-bold leading-none text-slate-950">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                ) : null}
                {activeTab === tab ? (
                  <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-4/5 -translate-x-1/2 rounded-full bg-cyan-400/80" />
                ) : null}
              </button>
            ))}
          </div>
          {activeTab === "chat" ? (
            <div className="relative" ref={channelMenuRef}>
              <button
                aria-expanded={isChannelMenuOpen}
                aria-haspopup="menu"
                className="flex min-h-6 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
                onClick={() => setIsChannelMenuOpen((current) => !current)}
                type="button"
              >
                <span>{activeChannelMeta?.label ?? copy.channel}</span>
                <svg className={["h-3 w-3 shrink-0 transition-transform", isChannelMenuOpen ? "rotate-180" : ""].join(" ")} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>
              {isChannelMenuOpen ? (
                <div className="game-panel absolute right-0 top-[calc(100%+0.25rem)] z-20 min-w-24 overflow-hidden rounded py-0.5 shadow-lg">
                  {channels.map((channel) => (
                    <button
                      key={channel.key}
                      className={[
                        "flex w-full items-center justify-between px-2 py-1 text-left text-[10px] transition",
                        activeChannel === channel.key
                          ? "bg-cyan-300/10 text-cyan-200"
                          : "text-slate-400 hover:bg-white/5 hover:text-white",
                      ].join(" ")}
                      onClick={() => {
                        setActiveChannel(channel.key);
                        setIsChannelMenuOpen(false);
                      }}
                      type="button"
                    >
                      <span>{channel.label}</span>
                      {unreadCounts[channel.key] > 0 ? (
                        <span className="ml-2 text-[9px] text-amber-400">{unreadCounts[channel.key]}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Messages area */}
        <div ref={feedScrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-1 sm:px-2.5 sm:py-1.5">
          {activeTab === "chat" ? (
            messages.length === 0 ? (
              <p className="py-4 text-center text-[10px] text-slate-600">{copy.quiet}</p>
            ) : (
              <div className="space-y-px font-mono text-[10px] sm:text-[11px]">{messageItems}</div>
            )
          ) : activeTab === "battle" ? (
            battleItems.length === 0 ? (
              <p className="py-4 text-center text-[10px] text-slate-600">{copy.battleQuiet}</p>
            ) : (
              <div className="space-y-px font-mono text-[10px] sm:text-[11px]">
                {battleItems.map((item) => (
                  <div key={item.id} className="py-px leading-5">
                    <span className="mr-1 text-[9px] text-slate-600">{item.time}</span>
                    <span className={item.color}>{item.text}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            encounterItems.length === 0 ? (
              <p className="py-4 text-center text-[10px] text-slate-600">{copy.eventQuiet}</p>
            ) : (
              <div className="space-y-px font-mono text-[10px] sm:text-[11px]">
                {encounterItems.map((item) => (
                  <div key={item.id} className="py-px leading-5">
                    <span className="mr-1 text-[9px] text-slate-600">{item.time}</span>
                    <span className={item.color}>{item.text}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Input */}
        {activeTab === "chat" ? (
          <div className="flex min-h-9 shrink-0 border-t border-white/[0.06]">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, CHAT_MESSAGE_MAX_LENGTH))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void sendMessage().catch(() => {});
                }
              }}
              className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 sm:px-3 sm:text-xs"
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              placeholder={`${copy.sendTo}${channels.find((channel) => channel.key === activeChannel)?.label ?? copy.currentChannel}...`}
            />
            <button
              onClick={() => {
                void sendMessage().catch(() => {});
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-500 transition hover:text-cyan-300 disabled:opacity-30"
              disabled={!isRealtimeReady || input.trim().length === 0 || remainingCooldownMs > 0}
              aria-label={copy.send}
              type="button"
              title={copy.send}
            >
              {remainingCooldownMs > 0 ? (
                <span className="text-[9px] text-slate-600">{sendCooldownSeconds}s</span>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              )}
            </button>
          </div>
        ) : null}
      </section>

      {isRoleModalOpen ? (
        <RoleProfileCard
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
