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
import type {
  AccountLoginDraft,
  AccountRegistrationDraft,
  ConnectionStatus,
  CreateRoleDraft,
  GameSessionContextValue,
  SessionSnapshot,
} from "@/features/game/types";

const GUEST_TOKEN_KEY = "roadtotop.guest-token";
const RETURNING_FROM_BACKGROUND_KEY = "roadtotop.returning-from-background";

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
  options?: { returningFromBackground?: boolean },
) {
  const searchParams = new URLSearchParams({
    guestToken,
  });

  if (options?.returningFromBackground) {
    searchParams.set("returning", "1");
  }

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

function hasPendingReturnSettlement() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(RETURNING_FROM_BACKGROUND_KEY) === "1";
}

function setPendingReturnSettlement() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RETURNING_FROM_BACKGROUND_KEY, "1");
}

function clearPendingReturnSettlement() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(RETURNING_FROM_BACKGROUND_KEY);
}

function isLocalDevelopmentHost() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
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

async function getWebSocketUrl() {
  if (typeof window === "undefined") {
    return null;
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

  if (isLocalDevelopmentHost()) {
    return null;
  }

  return getFallbackWebSocketUrl();
}

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelKey>("afk");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [selectedMapKey, setSelectedMapKey] = useState<MapKey>("palmia-wilds");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("booting");
  const reconnectTimerRef = useRef<number | null>(null);
  const autoBackgroundHandledRef = useRef(false);
  const backgroundStartRequestRef = useRef<Promise<void> | null>(null);
  const guestTokenRef = useRef<string | null>(null);
  const selectedMapKeyRef = useRef<MapKey>("palmia-wilds");
  const shouldReconnectRef = useRef(true);
  const snapshotRef = useRef<SessionSnapshot | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const handleIncomingSnapshot = useCallback((nextSnapshot: SessionSnapshot) => {
    setError(null);
    setSnapshot(nextSnapshot);
    setStatus("ready");
    setSelectedMapKey(nextSnapshot.afk.mapKey ?? nextSnapshot.config.maps[0]?.key ?? "palmia-wilds");
  }, []);

  const sendSocketMessage = useCallback((type: string, payload?: Record<string, unknown>) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("与挂机服务器的连接尚未建立。");
    }

    socket.send(JSON.stringify({ payload, type }));
  }, []);

  const connectSocket = useCallback(async (nextGuestToken: string) => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

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
          snapshot?: SessionSnapshot;
        };
        type: string;
      };

      if (packet.type === "game:error") {
        setStatus("error");
        setError(packet.payload?.content ?? "连接挂机服务器失败。");
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
      setStatus("error");
      setError("挂机长连接建立失败。");
    });
  }, [handleIncomingSnapshot]);

  const loadSessionForToken = useCallback(async (nextGuestToken: string) => {
    setStoredGuestToken(nextGuestToken);
    setGuestToken(nextGuestToken);
    guestTokenRef.current = nextGuestToken;
    const returningFromBackground = hasPendingReturnSettlement();
    const nextSnapshot = await fetchSessionSnapshot(nextGuestToken, { returningFromBackground });
    clearPendingReturnSettlement();
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
  }, []);

  const silentlyStartBackgroundAfk = useCallback(() => {
    const currentGuestToken = guestTokenRef.current ?? getStoredGuestToken();
    const currentSnapshot = snapshotRef.current;
    const mapKey =
      currentSnapshot?.afk.mapKey
      ?? selectedMapKeyRef.current
      ?? currentSnapshot?.config.maps[0]?.key
      ?? "palmia-wilds";

    if (!currentGuestToken || !currentSnapshot?.role || !mapKey) {
      return;
    }

    setPendingReturnSettlement();

    backgroundStartRequestRef.current = fetch("/api/afk/start", {
      body: JSON.stringify({
        guestToken: currentGuestToken,
        mapKey,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "POST",
    })
      .then(() => undefined)
      .catch(() => {
        // Best effort only. Re-entry will still resync from the server.
      });
  }, []);

  const resumeFromBackground = useCallback(() => {
    const currentGuestToken = guestTokenRef.current ?? getStoredGuestToken();

    autoBackgroundHandledRef.current = false;

    if (!currentGuestToken || !hasPendingReturnSettlement()) {
      if (currentGuestToken && !socketRef.current) {
        void connectSocket(currentGuestToken);
      }
      return;
    }

    setStatus("booting");
    setError(null);

    const backgroundStartRequest = backgroundStartRequestRef.current ?? Promise.resolve();

    void backgroundStartRequest
      .finally(() => {
        backgroundStartRequestRef.current = null;

        return fetchSessionSnapshot(currentGuestToken, { returningFromBackground: true })
          .then((nextSnapshot) => {
            clearPendingReturnSettlement();
            handleIncomingSnapshot(nextSnapshot);
            void connectSocket(currentGuestToken);
          })
          .catch((resumeError) => {
            setStatus("error");
            setError(resumeError instanceof Error ? resumeError.message : "恢复挂机会话失败。");
            void connectSocket(currentGuestToken);
          });
      });
  }, [connectSocket, handleIncomingSnapshot]);

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
      setError(loginError instanceof Error ? loginError.message : "游客登录失败。");
    }
  }, [loadSessionForToken]);

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
      setError(loginError instanceof Error ? loginError.message : "账号登录失败。");
      throw loginError;
    }
  }, [loadSessionForToken]);

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
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    selectedMapKeyRef.current = selectedMapKey;
  }, [selectedMapKey]);

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

      if (autoBackgroundHandledRef.current) {
        return;
      }

      autoBackgroundHandledRef.current = true;
      silentlyStartBackgroundAfk();
      closeSocketConnection();
    };

    const handlePageHide = () => {
      if (autoBackgroundHandledRef.current) {
        return;
      }

      autoBackgroundHandledRef.current = true;
      silentlyStartBackgroundAfk();
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
  }, [closeSocketConnection, resumeFromBackground, silentlyStartBackgroundAfk]);

  const createRole = useCallback(
    async (draft: CreateRoleDraft) => {
      const currentGuestToken = guestToken ?? getStoredGuestToken();

      if (!currentGuestToken) {
        throw new Error("游客会话不存在，请重新登录。");
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
        setError(mutationError instanceof Error ? mutationError.message : "创建角色失败。");
        throw mutationError;
      }
    },
    [connectSocket, guestToken, handleIncomingSnapshot, sendSocketMessage],
  );

  const registerAccount = useCallback(async (draft: AccountRegistrationDraft) => {
    const currentGuestToken = guestToken ?? getStoredGuestToken();

    if (!currentGuestToken) {
      throw new Error("游客会话不存在，请重新登录。");
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
      setError(mutationError instanceof Error ? mutationError.message : "注册账号失败。");
      throw mutationError;
    }
  }, [guestToken, handleIncomingSnapshot]);

  const deleteAccountRole = useCallback(async () => {
    const currentGuestToken = guestToken ?? getStoredGuestToken();

    if (!currentGuestToken) {
      throw new Error("账号会话不存在，请重新登录。");
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
      setError(mutationError instanceof Error ? mutationError.message : "删除角色失败。");
      throw mutationError;
    }
  }, [connectSocket, guestToken, handleIncomingSnapshot, sendSocketMessage]);

  const startAfk = useCallback(async () => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:afk:start", { mapKey: selectedMapKey });
      setActivePanel("afk");
    } catch (sendError) {
      setStatus("error");
      setError(sendError instanceof Error ? sendError.message : "开始挂机失败。");
      throw sendError;
    }
  }, [selectedMapKey, sendSocketMessage]);

  const stopAfk = useCallback(async () => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:afk:stop");
    } catch (sendError) {
      setStatus("error");
      setError(sendError instanceof Error ? sendError.message : "停止挂机失败。");
      throw sendError;
    }
  }, [sendSocketMessage]);

  const claimOfflineReward = useCallback(async () => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:afk:claim");
    } catch (sendError) {
      setStatus("error");
      setError(sendError instanceof Error ? sendError.message : "领取收益失败。");
      throw sendError;
    }
  }, [sendSocketMessage]);

  const dropBackpackItem = useCallback(async (backpackId: string) => {
    try {
      setStatus("saving");
      setError(null);
      sendSocketMessage("game:backpack:drop", { backpackId });
    } catch (sendError) {
      setStatus("error");
      setError(sendError instanceof Error ? sendError.message : "丢弃物品失败。");
      throw sendError;
    }
  }, [sendSocketMessage]);

  const sendChatMessage = useCallback(async (channelKey: ChatChannelKey, content: string) => {
    try {
      setError(null);
      sendSocketMessage("game:chat:send", { channelKey, content });
    } catch (sendError) {
      setStatus("error");
      setError(sendError instanceof Error ? sendError.message : "发送聊天消息失败。");
      throw sendError;
    }
  }, [sendSocketMessage]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === "error" ? "ready" : current));
  }, []);

  const value = useMemo<GameSessionContextValue>(
    () => ({
      activePanel,
      accountLogin,
      chatMessages,
      claimOfflineReward,
      createRole,
      deleteAccountRole,
      dismissError,
      dropBackpackItem,
      error,
      guestLogin,
      registerAccount,
      sendChatMessage,
      selectedMapKey,
      selectMap: setSelectedMapKey,
      setActivePanel,
      snapshot,
      startAfk,
      status,
      stopAfk,
    }),
    [
      activePanel,
      accountLogin,
      chatMessages,
      claimOfflineReward,
      createRole,
      deleteAccountRole,
      dismissError,
      dropBackpackItem,
      error,
      guestLogin,
      registerAccount,
      sendChatMessage,
      selectedMapKey,
      snapshot,
      startAfk,
      status,
      stopAfk,
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
