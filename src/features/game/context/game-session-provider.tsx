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
import { TICK_REFRESH_MS, type MapKey, type PanelKey } from "@/lib/game-config";
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

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelKey>("afk");
  const [error, setError] = useState<string | null>(null);
  const [selectedMapKey, setSelectedMapKey] = useState<MapKey>("palmia-wilds");
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("booting");
  const pollTimerRef = useRef<number | null>(null);

  const loadSession = useCallback(async (guestToken: string) => {
    const payload = await requestJson<{ ok: boolean; snapshot: SessionSnapshot }>(
      `/api/session?guestToken=${encodeURIComponent(guestToken)}`,
      { method: "GET" },
    );

    setSnapshot(payload.snapshot);
    setStatus("ready");
    setSelectedMapKey(payload.snapshot.afk.mapKey ?? payload.snapshot.config.maps[0]?.key ?? "palmia-wilds");
    return payload.snapshot;
  }, []);

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
      await loadSession(payload.account.guestToken);
    } catch (loginError) {
      setStatus("error");
      setError(loginError instanceof Error ? loginError.message : "游客登录失败。");
    }
  }, [loadSession]);

  useEffect(() => {
    const storedToken = getStoredGuestToken();

    if (storedToken) {
      void guestLogin();
      return;
    }

    setStatus("ready");
  }, [guestLogin]);

  useEffect(() => {
    if (!snapshot?.account.guestToken || !snapshot.role) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    pollTimerRef.current = window.setInterval(() => {
      void loadSession(snapshot.account.guestToken).catch((pollError) => {
        setStatus("error");
        setError(pollError instanceof Error ? pollError.message : "刷新会话失败。");
      });
    }, TICK_REFRESH_MS);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [loadSession, snapshot?.account.guestToken, snapshot?.role]);

  const performSnapshotMutation = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const guestToken = getStoredGuestToken();

      if (!guestToken) {
        throw new Error("游客会话不存在，请重新登录。");
      }

      setStatus("saving");
      setError(null);

      try {
        const payload = await requestJson<{ ok: boolean; snapshot: SessionSnapshot }>(path, {
          body: JSON.stringify({ guestToken, ...body }),
          method: "POST",
        });
        setSnapshot(payload.snapshot);
        setStatus("ready");
        if (payload.snapshot.afk.mapKey) {
          setSelectedMapKey(payload.snapshot.afk.mapKey);
        }
      } catch (mutationError) {
        setStatus("error");
        setError(mutationError instanceof Error ? mutationError.message : "提交失败。");
        throw mutationError;
      }
    },
    [],
  );

  const createRole = useCallback(
    async (draft: CreateRoleDraft) => {
      await performSnapshotMutation("/api/role/create", draft);
      setActivePanel("afk");
    },
    [performSnapshotMutation],
  );

  const startAfk = useCallback(async () => {
    await performSnapshotMutation("/api/afk/start", { mapKey: selectedMapKey });
    setActivePanel("afk");
  }, [performSnapshotMutation, selectedMapKey]);

  const stopAfk = useCallback(async () => {
    await performSnapshotMutation("/api/afk/stop", {});
  }, [performSnapshotMutation]);

  const claimOfflineReward = useCallback(async () => {
    await performSnapshotMutation("/api/afk/claim", {});
  }, [performSnapshotMutation]);

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
