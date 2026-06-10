'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type {
  SessionSnapshot, GameSessionContextValue, ConnectionStatus,
} from '../types';
import type { ActivityKey, RaceKey, ClassKey, BodySlotType } from '@/lib/game-config';
import { parseServerMessage } from '@/../shared/realtime-protocol';

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

export function useGameSession(): GameSessionContextValue {
  const ctx = useContext(GameSessionContext);
  if (!ctx) throw new Error('useGameSession must be used within GameSessionProvider');
  return ctx;
}

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('booting');
  const wsRef = useRef<WebSocket | null>(null);
  const guestTokenRef = useRef<string>('');

  // 获取或创建 guest token
  useEffect(() => {
    let token = localStorage.getItem('guest_token');
    if (!token) {
      // 生成唯一 token: guest_ + 时间戳 + 随机字符
      token = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('guest_token', token);
    }
    guestTokenRef.current = token;
  }, []);

  // WebSocket 连接
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('ready');
        // 发送认证消息
        ws.send(JSON.stringify({
          type: 'game:session:start',
          payload: { guestToken: guestTokenRef.current },
        }));
      };

      ws.onmessage = (event) => {
        const msg = parseServerMessage(event.data);
        if (!msg) return;

        switch (msg.type) {
          case 'game:session:ready':
            setSnapshot(msg.payload as SessionSnapshot);
            break;
          case 'game:state:update':
            setSnapshot(msg.payload as SessionSnapshot);
            break;
          case 'game:chat:message':
            // 聊天消息通过 snapshot 处理，或单独处理
            break;
          case 'game:error':
            console.error('[Game Error]', (msg.payload as { message: string })?.message);
            break;
        }
      };

      ws.onclose = () => {
        setConnectionStatus('error');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, []);

  // 发送消息
  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // 操作函数
  const createRole = useCallback((name: string, raceKey: RaceKey, classKey: ClassKey) => {
    send('game:role:create', { name, raceKey, classKey });
  }, [send]);

  const startAfk = useCallback((activityKey: ActivityKey, mapKey: string) => {
    send('game:afk:start', { activityKey, mapKey });
  }, [send]);

  const stopAfk = useCallback(() => {
    send('game:afk:stop');
  }, [send]);

  const claimOfflineReward = useCallback(() => {
    send('game:afk:claim');
  }, [send]);

  const equipItem = useCallback((backpackId: number, slot: BodySlotType) => {
    send('game:backpack:equip', { backpackId, slot });
  }, [send]);

  const unequipItem = useCallback((backpackId: number) => {
    send('game:backpack:unequip', { backpackId });
  }, [send]);

  const dropItem = useCallback((backpackId: number) => {
    send('game:backpack:drop', { backpackId });
  }, [send]);

  const learnSkillBook = useCallback((backpackId: number) => {
    send('game:backpack:learn-skill-book', { backpackId });
  }, [send]);

  const configureSkillLoadout = useCallback((skillKeys: string[]) => {
    send('game:skill:configure-loadout', { skillKeys });
  }, [send]);

  const createMarketListing = useCallback((backpackId: number, price: number) => {
    send('game:market:create', { backpackId, price });
  }, [send]);

  const cancelMarketListing = useCallback((listingId: number) => {
    send('game:market:cancel', { listingId });
  }, [send]);

  const buyMarketListing = useCallback((listingId: number) => {
    send('game:market:buy', { listingId });
  }, [send]);

  const challengePvp = useCallback((targetRoleId: number) => {
    send('game:pvp:challenge', { targetRoleId });
  }, [send]);

  const sendChat = useCallback((channelKey: string, content: string) => {
    send('game:chat:send', { channelKey, content });
  }, [send]);

  const value: GameSessionContextValue = {
    snapshot,
    connectionStatus,
    createRole,
    startAfk,
    stopAfk,
    claimOfflineReward,
    equipItem,
    unequipItem,
    dropItem,
    learnSkillBook,
    configureSkillLoadout,
    createMarketListing,
    cancelMarketListing,
    buyMarketListing,
    challengePvp,
    sendChat,
  };

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
}
