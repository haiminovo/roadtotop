'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { type ChatChannelKey, type ChatChannel } from "@/features/chat/types";
import { useGameSession } from "@/features/game/context/game-session-provider";
import { useI18n } from "@/lib/i18n/provider";

const CHAT_SEND_COOLDOWN_MS = 3000;

function createEmptyUnreadCounts(): Record<ChatChannelKey, number> {
  return {
    tavern: 0,
    trade: 0,
    world: 0,
  };
}

export function useChatSocket() {
  const { messages: i18n } = useI18n();
  const { chatMessages, sendChatMessage, snapshot, status } = useGameSession();
  const [activeChannel, setActiveChannel] = useState<ChatChannelKey>("world");
  const [input, setInput] = useState("");
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [unreadCounts, setUnreadCounts] = useState<Record<ChatChannelKey, number>>(createEmptyUnreadCounts);
  const hasBootstrappedHistoryRef = useRef(false);
  const seenMessageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (lastSentAt === null) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [lastSentAt]);

  useEffect(() => {
    if (lastSentAt === null) {
      return;
    }

    if (Date.now() - lastSentAt >= CHAT_SEND_COOLDOWN_MS) {
      setLastSentAt(null);
    }
  }, [lastSentAt, now]);

  useEffect(() => {
    if (chatMessages.length === 0) {
      return;
    }

    if (!hasBootstrappedHistoryRef.current) {
      for (const message of chatMessages) {
        seenMessageIdsRef.current.add(message.id);
      }

      hasBootstrappedHistoryRef.current = true;
      return;
    }

    setUnreadCounts((current) => {
      const next = { ...current };
      let hasChanged = false;

      for (const message of chatMessages) {
        if (seenMessageIdsRef.current.has(message.id)) {
          continue;
        }

        seenMessageIdsRef.current.add(message.id);

        if (message.channelKey === activeChannel) {
          continue;
        }

        next[message.channelKey] += 1;
        hasChanged = true;
      }

      return hasChanged ? next : current;
    });
  }, [activeChannel, chatMessages]);

  useEffect(() => {
    setUnreadCounts((current) => {
      if (current[activeChannel] === 0) {
        return current;
      }

      return {
        ...current,
        [activeChannel]: 0,
      };
    });
  }, [activeChannel]);

  const messages = useMemo(
    () => chatMessages.filter((message) => message.channelKey === activeChannel),
    [activeChannel, chatMessages],
  );
  const channels = useMemo<ChatChannel[]>(() => [
    {
      key: "world",
      label: i18n.chat.channels.world.label,
      summary: i18n.chat.channels.world.summary,
    },
    {
      key: "trade",
      label: i18n.chat.channels.trade.label,
      summary: i18n.chat.channels.trade.summary,
    },
    {
      key: "tavern",
      label: i18n.chat.channels.tavern.label,
      summary: i18n.chat.channels.tavern.summary,
    },
  ], [i18n]);

  const currentUserId = snapshot?.account.userId ?? null;
  const remainingCooldownMs = lastSentAt === null
    ? 0
    : Math.max(0, CHAT_SEND_COOLDOWN_MS - (now - lastSentAt));
  const sendCooldownSeconds = Math.ceil(remainingCooldownMs / 1000);

  return {
    activeChannel,
    channels,
    currentUserId,
    input,
    messages,
    remainingCooldownMs,
    sendMessage: async () => {
      const content = input.trim();

      if (!content || remainingCooldownMs > 0) {
        return;
      }

      await sendChatMessage(activeChannel, content);
      setInput("");
      setLastSentAt(Date.now());
      setNow(Date.now());
    },
    sendCooldownSeconds,
    setActiveChannel,
    setInput,
    status,
    unreadCounts,
  };
}
