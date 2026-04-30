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
import type {
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
  const [error, setError] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [selectedMapKey, setSelectedMapKey] = useState<MapKey>("palmia-wilds");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("booting");
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);
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

      setStoredGuestToken(payload.account.guestToken);
      setGuestToken(payload.account.guestToken);
      await connectSocket(payload.account.guestToken);
    } catch (loginError) {
      setStatus("error");
      setError(loginError instanceof Error ? loginError.message : "游客登录失败。");
    }
  }, [connectSocket]);

  useEffect(() => {
    const storedToken = getStoredGuestToken();

    if (storedToken) {
      setGuestToken(storedToken);
      void guestLogin();
      return;
    }

    setStatus("ready");
  }, [guestLogin]);

  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

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

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === "error" ? "ready" : current));
  }, []);

  const value = useMemo<GameSessionContextValue>(
    () => ({
      activePanel,
      claimOfflineReward,
      createRole,
      dismissError,
      error,
      guestLogin,
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
      claimOfflineReward,
      createRole,
      dismissError,
      error,
      guestLogin,
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
