'use client';

import { useEffect, useRef, useState } from "react";
import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";
import { useI18n } from "@/lib/i18n/provider";

function shouldShowGuestId(senderName: string) {
  const normalizedName = senderName.trim();
  return normalizedName === "游客" || normalizedName.startsWith("游客");
}

export default function Chat() {
  const { messages: i18n } = useI18n();
  const copy = i18n.chat;
  const {
    activeChannel,
    channels,
    currentUserId,
    input,
    messages,
    remainingCooldownMs,
    sendMessage,
    sendCooldownSeconds,
    setActiveChannel,
    setInput,
    unreadCounts,
  } = useChatSocket();
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const channelMenuRef = useRef<HTMLDivElement | null>(null);
  const activeChannelMeta = channels.find((channel) => channel.key === activeChannel);
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

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

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[1.25rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,23,40,0.96),rgba(11,16,30,0.98))] p-4 text-white shadow-[0_12px_36px_rgba(0,0,0,0.22)]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{copy.channel}</h3>
          <p className="text-[11px] text-slate-500">
            {activeChannelMeta?.summary ?? copy.mergedSummary}
          </p>
        </div>
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
      </div>

      <div className="mb-2 min-h-0 flex-1 overflow-y-auto rounded-[1.05rem] border border-white/8 bg-slate-900/70 px-3">
        {messages.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">{copy.quiet}</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={[
                "flex items-center gap-2 border-b border-white/6 py-1.5 text-sm last:border-b-0",
                message.senderUserId === currentUserId
                  ? "text-cyan-100"
                  : "text-slate-100",
              ].join(" ")}
              title={`${message.senderName}${shouldShowGuestId(message.senderName) ? ` ${message.senderUserId}` : ""} ${message.content}`}
            >
              <span
                className={[
                  "shrink-0 text-[11px] font-semibold tracking-[0.08em]",
                  message.senderUserId === currentUserId ? "text-cyan-200" : "text-slate-300",
                ].join(" ")}
              >
                {message.senderName}
              </span>
              {shouldShowGuestId(message.senderName) ? (
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {message.senderUserId}
                </span>
              ) : null}
              <span className="shrink-0 text-[10px] text-slate-600">:</span>
              <p className="min-w-0 flex-1 truncate whitespace-nowrap text-slate-100">{message.content}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void sendMessage();
            }
          }}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
          placeholder={`${copy.sendTo}${channels.find((channel) => channel.key === activeChannel)?.label ?? copy.currentChannel}...`}
        />
        <button
          onClick={() => {
            void sendMessage();
          }}
          className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={input.trim().length === 0 || remainingCooldownMs > 0}
          type="button"
        >
          {remainingCooldownMs > 0 ? `${sendCooldownSeconds}s` : copy.send}
        </button>
      </div>
    </section>
  );
}
