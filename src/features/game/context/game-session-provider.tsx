'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type MapKey, type PanelKey } from "@/lib/game-config";
import type { ChatChannelKey, ChatMessage } from "@/features/chat/types";
import { localizeErrorMessage } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import type {
  AccountLoginDraft,
  AccountRegistrationDraft,
  ConnectionStatus,
  CreateRoleDraft,
  GameSessionContextValue,
  SessionSnapshot,
} from "@/features/game/types";

const GUEST_TOKEN_KEY = "roadtotop.guest-token";

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & { error?: string; ok: boolean };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "请求失败。");
  }

  return payload;
}

async function fetchSessionSnapshot(
  guestToken: string,
) {
  const searchParams = new URLSearchParams({ guestToken });

  const response = await fetch(`/api/session?${searchParams.toString()}`, {
    cache: "no-store",
  });

  const payload = await response.json() as {
    error?: string;
    ok: boolean;
    snapshot?: SessionSnapshot;
  };

  if (!response.ok || !payload.ok || !payload.snapshot) {
    throw new Error(payload.error ?? "拉取会话快照失败。");
  }

  return payload.snapshot;
}

function getStoredGuestToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(GUEST_TOKEN_KEY);
}

function setStoredGuestToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(GUEST_TOKEN_KEY, token);
}

function clearStoredGuestToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_TOKEN_KEY);
}

function getFallbackWebSocketUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const { hostname } = window.location;

  const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:8080`;
  }

  return `${protocol}//${window.location.host}`;
}

function getConfiguredWebSocketUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const configuredUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();

  if (!configuredUrl) {
    return null;
  }

  if (window.location.protocol === "https:" && configuredUrl.startsWith("ws://")) {
    return `wss://${configuredUrl.slice("ws://".length)}`;
  }

  return configuredUrl;
}

async function getWebSocketUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const configuredUrl = getConfiguredWebSocketUrl();

  if (configuredUrl) {
    return configuredUrl;
  }

  try {
    const response = await fetch("/api/runtime/ws", { cache: "no-store" });
    const payload = await response.json() as { ok?: boolean; port?: number | null };

    if (response.ok && payload.ok && typeof payload.port === "number" && payload.port > 0) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.hostname}:${payload.port}`;
    }
  } catch {
    // Fallback to static configuration when runtime discovery is unavailable.
  }

  return getFallbackWebSocketUrl();
}

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const [activePanel, setActivePanel] = useState<PanelKey>("afk");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [selectedMapKey, setSelectedMapKey] = useState<MapKey>("palmia-wilds");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("booting");
  const reconnectTimerRef = useRef<number | null>(null);
  const guestTokenRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef(true);
  const socketRef = useRef<WebSocket | null>(null);

  const handleIncomingSnapshot = useCallback((nextSnapshot: SessionSnapshot) => {
    setSnapshot(nextSnapshot);
    setStatus("ready");
    setSelectedMapKey(nextSnapshot.afk.mapKey ?? nextSnapshot.config.maps[0]?.key ?? "palmia-wilds");
  }, []);

  const sendSocketMessage = useCallback((type: string, payload?: Record<string, unknown>) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(localizeErrorMessage(locale, "与挂机服务器的连接尚未建立。"));
    }

    socket.send(JSON.stringify({ payload, type }));
  }, [locale]);

  const handleRealtimeError = useCallback((statusCode: number, message?: string) => {
    const localizedMessage = localizeErrorMessage(locale, message ?? "连接挂机服务器失败。");

    if (statusCode === 401) {
      shouldReconnectRef.current = false;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      clearStoredGuestToken();
      guestTokenRef.current = null;
      setGuestToken(null);
      setSnapshot(null);
      setChatMessages([]);
      setIsRealtimeReady(false);
      setStatus("ready");
      setError(localizedMessage);
      return;
    }

    if (statusCode >= 500) {
      setStatus("error");
      setError(localizedMessage);
      return;
    }

    setStatus("ready");
    setError(localizedMessage);
  }, [locale]);

  const connectSocket = useCallback(async (nextGuestToken: string) => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setIsRealtimeReady(false);

    const socketUrl = await getWebSocketUrl();

    if (!socketUrl) {
      reconnectTimerRef.current = window.setTimeout(() => {
        if (nextGuestToken) {
          void connectSocket(nextGuestToken);
        }
      }, 1000);
      return;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    shouldReconnectRef.current = true;
    setStatus("booting");

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setIsRealtimeReady(true);
      socket.send(JSON.stringify({
        payload: { guestToken: nextGuestToken },
        type: "game:session:start",
      }));
    });

    socket.addEventListener("message", (event) => {
      const packet = JSON.parse(event.data) as {
        payload?: {
          message?: ChatMessage;
          messages?: ChatMessage[];
          content?: string;
          status?: number;
          snapshot?: SessionSnapshot;
        };
        type: string;
      };

      if (packet.type === "game:error") {
        const statusCode = typeof packet.payload?.status === "number"
          ? Math.trunc(packet.payload.status)
          : 500;
        handleRealtimeError(statusCode, packet.payload?.content);
        return;
      }

      if (packet.type === "game:session:ready" || packet.type === "game:state:update") {
        if (packet.payload?.snapshot) {
          handleIncomingSnapshot(packet.payload.snapshot);
        }
        return;
      }

      if (packet.type === "game:chat:history") {
        setChatMessages(packet.payload?.messages ?? []);
        return;
      }

      if (packet.type === "game:chat:message" && packet.payload?.message) {
        const incomingMessage = packet.payload.message;

        setChatMessages((current) => {
          const nextMessages = current.filter((message) => message.id !== incomingMessage.id);
          nextMessages.push(incomingMessage);
          return nextMessages.slice(-80);
        });
      }
    });

    socket.addEventListener("close", () => {
      if (socketRef.current !== socket) {
        return;
      }

      socketRef.current = null;
      setIsRealtimeReady(false);

      if (!shouldReconnectRef.current) {
        return;
      }

      setStatus((current) => (current === "ready" ? "booting" : current));

      reconnectTimerRef.current = window.setTimeout(() => {
        if (nextGuestToken) {
          void connectSocket(nextGuestToken);
        }
      }, 2000);
    });

    socket.addEventListener("error", () => {
      setIsRealtimeReady(false);
      setStatus("error");
      setError(localizeErrorMessage(locale, "挂机长连接建立失败。"));
    });
  }, [handleIncomingSnapshot, handleRealtimeError, locale]);

  const loadSessionForToken = useCallback(async (nextGuestToken: string) => {
    setStoredGuestToken(nextGuestToken);
    setGuestToken(nextGuestToken);
    guestTokenRef.current = nextGuestToken;
    const nextSnapshot = await fetchSessionSnapshot(nextGuestToken);
    handleIncomingSnapshot(nextSnapshot);
    void connectSocket(nextGuestToken);
  }, [connectSocket, handleIncomingSnapshot]);

  const closeSocketConnection = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsRealtimeReady(false);
  }, []);

  const resumeFromBackground = useCallback(() => {
    const currentGuestToken = guestTokenRef.current ?? getStoredGuestToken();

    if (!currentGuestToken) {
      return;
    }

    if (!socketRef.current) {
      void connectSocket(currentGuestToken);
    }
  }, [connectSocket]);

  const guestLogin = useCallback(async () => {
    setStatus("booting");
    setError(null);

    try {
      const payload = await requestJson<{
        ok: boolean;
        account: { guestToken: string };
      }>("/api/auth/guest", {
        body: JSON.stringify({ guestToken: getStoredGuestToken() }),
        method: "POST",
      });

      await loadSessionForToken(payload.account.guestToken);
    } catch (loginError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, loginError instanceof Error ? loginError.message : "游客登录失败。"));
    }
  }, [loadSessionForToken, locale]);

  const accountLogin = useCallback(async (draft: AccountLoginDraft) => {
    setStatus("booting");
    setError(null);

    try {
      const payload = await requestJson<{
        account: { guestToken: string };
        ok: boolean;
      }>("/api/auth/account", {
        body: JSON.stringify(draft),
        method: "POST",
      });

      await loadSessionForToken(payload.account.guestToken);
    } catch (loginError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, loginError instanceof Error ? loginError.message : "账号登录失败。"));
      throw loginError;
    }
  }, [loadSessionForToken, locale]);

  useEffect(() => {
    const storedToken = getStoredGuestToken();

    if (storedToken) {
      setGuestToken(storedToken);
      void loadSessionForToken(storedToken).catch(() => {
        clearStoredGuestToken();
        setGuestToken(null);
        setSnapshot(null);
        setStatus("ready");
      });
      return;
    }

    setStatus("ready");
  }, [loadSessionForToken]);

  useEffect(() => {
    guestTokenRef.current = guestToken;
  }, [guestToken]);

  useEffect(() => {
    return () => {
      closeSocketConnection();
    };
  }, [closeSocketConnection]);

  useEffect(() => {
    const handleBackgroundEntry = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }
      closeSocketConnection();
    };

    const handlePageHide = () => {
      closeSocketConnection();
    };

    const handleForegroundEntry = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      resumeFromBackground();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handleForegroundEntry);
    window.addEventListener("focus", handleForegroundEntry);
    document.addEventListener("visibilitychange", handleBackgroundEntry);
    document.addEventListener("visibilitychange", handleForegroundEntry);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handleForegroundEntry);
      window.removeEventListener("focus", handleForegroundEntry);
      document.removeEventListener("visibilitychange", handleBackgroundEntry);
      document.removeEventListener("visibilitychange", handleForegroundEntry);
    };
  }, [closeSocketConnection, resumeFromBackground]);

  const createRole = useCallback(
    async (draft: CreateRoleDraft) => {
      const currentGuestToken = guestToken ?? getStoredGuestToken();

      if (!currentGuestToken) {
        throw new Error(localizeErrorMessage(locale, "游客会话不存在，请重新登录。"));
      }

      setStatus("saving");
      setError(null);

      try {
        const payload = await requestJson<{ ok: boolean; snapshot: SessionSnapshot }>("/api/role/create", {
          body: JSON.stringify({ guestToken: currentGuestToken, ...draft }),
          method: "POST",
        });

        handleIncomingSnapshot(payload.snapshot);
        setActivePanel("afk");

        if (socketRef.current?.readyState === WebSocket.OPEN) {
          sendSocketMessage("game:session:start", { guestToken: currentGuestToken });
        } else {
          void connectSocket(currentGuestToken);
        }
      } catch (mutationError) {
        setStatus("error");
        setError(localizeErrorMessage(locale, mutationError instanceof Error ? mutationError.message : "创建角色失败。"));
        throw mutationError;
      }
    },
    [connectSocket, guestToken, handleIncomingSnapshot, locale, sendSocketMessage],
  );

  const registerAccount = useCallback(async (draft: AccountRegistrationDraft) => {
    const currentGuestToken = guestToken ?? getStoredGuestToken();

    if (!currentGuestToken) {
      throw new Error(localizeErrorMessage(locale, "游客会话不存在，请重新登录。"));
    }

    setStatus("saving");
    setError(null);

    try {
      const payload = await requestJson<{ ok: boolean; snapshot: SessionSnapshot }>("/api/account/register", {
        body: JSON.stringify({
          confirmPassword: draft.confirmPassword,
          guestToken: currentGuestToken,
          password: draft.password,
          username: draft.username,
        }),
        method: "POST",
      });

      handleIncomingSnapshot(payload.snapshot);
    } catch (mutationError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, mutationError instanceof Error ? mutationError.message : "注册账号失败。"));
      throw mutationError;
    }
  }, [guestToken, handleIncomingSnapshot, locale]);

  const deleteAccountRole = useCallback(async () => {
    const currentGuestToken = guestToken ?? getStoredGuestToken();

    if (!currentGuestToken) {
      throw new Error(localizeErrorMessage(locale, "账号会话不存在，请重新登录。"));
    }

    setStatus("saving");
    setError(null);

    try {
      const payload = await requestJson<{ ok: boolean; snapshot: SessionSnapshot }>("/api/account/role/delete", {
        body: JSON.stringify({ guestToken: currentGuestToken }),
        method: "POST",
      });

      handleIncomingSnapshot(payload.snapshot);
      setActivePanel("afk");

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        sendSocketMessage("game:session:start", { guestToken: currentGuestToken });
      } else {
        void connectSocket(currentGuestToken);
      }
    } catch (mutationError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, mutationError instanceof Error ? mutationError.message : "删除角色失败。"));
      throw mutationError;
    }
  }, [connectSocket, guestToken, handleIncomingSnapshot, locale, sendSocketMessage]);

  const startAfk = useCallback(async () => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:afk:start", { mapKey: selectedMapKey });
      setActivePanel("afk");
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "开始挂机失败。"));
      throw sendError;
    }
  }, [locale, selectedMapKey, sendSocketMessage]);

  const stopAfk = useCallback(async () => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:afk:stop");
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "停止挂机失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const claimOfflineReward = useCallback(async () => {
    try {
      setStatus("saving");
      setError(null);
      const currentGuestToken = guestToken ?? getStoredGuestToken();

      if (!currentGuestToken) {
        throw new Error(localizeErrorMessage(locale, "游客会话不存在，请重新登录。"));
      }

      const payload = await requestJson<{ ok: boolean; snapshot: SessionSnapshot }>("/api/afk/claim", {
        body: JSON.stringify({ guestToken: currentGuestToken }),
        method: "POST",
      });

      handleIncomingSnapshot(payload.snapshot);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        sendSocketMessage("game:session:start", { guestToken: currentGuestToken });
      } else {
        void connectSocket(currentGuestToken);
      }
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "领取收益失败。"));
      throw sendError;
    }
  }, [connectSocket, guestToken, handleIncomingSnapshot, locale, sendSocketMessage]);

  const createMarketListing = useCallback(async (backpackId: string, price: number, quantity: number) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:market:create", { backpackId, price, quantity });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "上架商品失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const cancelMarketListing = useCallback(async (listingId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:market:cancel", { listingId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "下架商品失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const dismissMarketSoldNotification = useCallback(async (listingId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:market:sold:dismiss", { listingId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "处理出售通知失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const buyMarketListing = useCallback(async (listingId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:market:buy", { listingId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "购买商品失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const dropBackpackItem = useCallback(async (backpackId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:backpack:drop", { backpackId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "丢弃物品失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const equipBackpackItem = useCallback(async (backpackId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:backpack:equip", { backpackId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "装备物品失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const learnSkillBook = useCallback(async (backpackId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:backpack:learn-skill-book", { backpackId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "学习技能书失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const configureSkillLoadout = useCallback(async (skillKey: string, action: "equip" | "unequip") => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:skill:configure-loadout", { action, skillKey });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "配置技能失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const unequipBackpackItem = useCallback(async (backpackId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:backpack:unequip", { backpackId });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "脱下物品失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const sendChatMessage = useCallback(async (channelKey: ChatChannelKey, content: string) => {
    try {
      setError(null);
      sendSocketMessage("game:chat:send", { channelKey, content });
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "发送聊天消息失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const challengePlayer = useCallback(async (targetRoleId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:pvp:challenge", { targetRoleId });
      setActivePanel("afk");
    } catch (sendError) {
      setStatus("error");
      setError(localizeErrorMessage(locale, sendError instanceof Error ? sendError.message : "发起切磋失败。"));
      throw sendError;
    }
  }, [locale, sendSocketMessage]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === "error" ? "ready" : current));
  }, []);

  const value = useMemo<GameSessionContextValue>(
    () => ({
      activePanel,
      accountLogin,
      buyMarketListing,
      cancelMarketListing,
      chatMessages,
      challengePlayer,
      claimOfflineReward,
      createMarketListing,
      createRole,
      deleteAccountRole,
      dismissMarketSoldNotification,
      dismissError,
      configureSkillLoadout,
      dropBackpackItem,
      equipBackpackItem,
      error,
      guestLogin,
      isRealtimeReady,
      learnSkillBook,
      registerAccount,
      sendChatMessage,
      selectedMapKey,
      selectMap: setSelectedMapKey,
      setActivePanel,
      snapshot,
      startAfk,
      status,
      stopAfk,
      unequipBackpackItem,
    }),
    [
      activePanel,
      accountLogin,
      buyMarketListing,
      cancelMarketListing,
      chatMessages,
      challengePlayer,
      claimOfflineReward,
      createMarketListing,
      createRole,
      deleteAccountRole,
      dismissMarketSoldNotification,
      dismissError,
      configureSkillLoadout,
      dropBackpackItem,
      equipBackpackItem,
      error,
      guestLogin,
      isRealtimeReady,
      learnSkillBook,
      registerAccount,
      sendChatMessage,
      selectedMapKey,
      snapshot,
      startAfk,
      status,
      stopAfk,
      unequipBackpackItem,
    ],
  );

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() {
  const context = useContext(GameSessionContext);

  if (!context) {
    throw new Error("useGameSession must be used within GameSessionProvider");
  }

  return context;
}
