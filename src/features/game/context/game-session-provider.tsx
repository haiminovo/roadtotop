'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type {
  SessionSnapshot, GameSessionContextValue, ConnectionStatus, ChatMessageData,
} from '../types';
import type { ActivityKey, RaceKey, ClassKey, BodySlotType } from '@/lib/game-config';
import { parseServerMessage } from '@/../shared/realtime-protocol';

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

export function useGameSession(): GameSessionContextValue {
  const ctx = useContext(GameSessionContext);
  if (!ctx) throw new Error('useGameSession must be used within GameSessionProvider');
  return ctx;
}

interface BattleLogEntry {
  timestamp: number;
  message: string;
  type: string;
}

export function GameSessionProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('booting');
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const [activityLogs, setActivityLogs] = useState<BattleLogEntry[]>([]);
  const prevBattleRef = useRef<string>('');
  const prevEncountersRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const guestTokenRef = useRef<string>('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 获取或创建 guest token
  useEffect(() => {
    let token = localStorage.getItem('guest_token');
    if (!token) {
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
        ws.send(JSON.stringify({
          type: 'game:session:start',
          payload: { guestToken: guestTokenRef.current },
        }));
        ws.send(JSON.stringify({ type: 'game:chat:history', payload: { channelKey: 'world' } }));
      };

      ws.onmessage = (event) => {
        const msg = parseServerMessage(event.data);
        if (!msg) return;

        switch (msg.type) {
          case 'game:session:ready':
            setSnapshot(msg.payload as SessionSnapshot);
            break;
          case 'game:state:update': {
            const newSnapshot = msg.payload as SessionSnapshot;
            setSnapshot(newSnapshot);
            // 收集战斗日志
            if (newSnapshot.afk?.battle?.logs) {
              const logs = newSnapshot.afk.battle.logs;
              const firstAlive = newSnapshot.afk.battle.enemies.find(e => e.alive);
              const battleKey = `${newSnapshot.afk.battle.totalEnemies}_${newSnapshot.afk.battle.defeatedCount}_${firstAlive?.health || 0}_${newSnapshot.afk.battle.result}`;
              if (battleKey !== prevBattleRef.current) {
                // 新战斗或状态变化，追加新日志
                setActivityLogs(prev => {
                  const existingKeys = new Set(prev.map(l => `${l.timestamp}_${l.type}_${l.message}`));
                  const newLogs = logs.filter(l => !existingKeys.has(`${l.timestamp}_${l.type}_${l.message}`));
                  const combined = [...prev, ...newLogs];
                  return combined.slice(-100);
                });
                prevBattleRef.current = battleKey;
              }
            }
            // 收集活动遭遇记录（采集/钓鱼等）
            if (newSnapshot.afk?.recentEncounters) {
              const encounters = newSnapshot.afk.recentEncounters;
              if (encounters.length !== prevEncountersRef.current) {
                setActivityLogs(prev => {
                  const existingKeys = new Set(prev.map(l => `${l.timestamp}_${l.type}_${l.message}`));
                  const newLogs = encounters
                    .map(enc => ({
                      timestamp: enc.timestamp,
                      message: `${enc.title} - ${enc.description}`,
                      type: 'info' as const,
                    }))
                    .filter(l => !existingKeys.has(`${l.timestamp}_${l.type}_${l.message}`));
                  const combined = [...prev, ...newLogs];
                  return combined.slice(-100);
                });
                prevEncountersRef.current = encounters.length;
              }
            }
            break;
          }
          case 'game:chat:message':
            setChatMessages(prev => [...prev.slice(-79), msg.payload as ChatMessageData]);
            break;
          case 'game:chat:history':
            setChatMessages((msg.payload as { messages: ChatMessageData[] }).messages);
            break;
          case 'game:error':
            console.warn('[Game Error]', (msg.payload as { message: string })?.message);
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

  // 挂机状态轮询 - 每2秒拉取一次更新
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'game:state:poll' }));
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
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

  const equipItem = useCallback((backpackId: number, slot: BodySlotType, replaceBackpackId?: number) => {
    send('game:backpack:equip', { backpackId, slot, replaceBackpackId });
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

  const repairEquipment = useCallback((backpackId: number) => {
    send('game:backpack:repair', { backpackId });
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

  const clearChannel = useCallback((channelKey: string) => {
    if (channelKey === 'activity') {
      setActivityLogs([]);
    } else {
      setChatMessages(prev => prev.filter(m => m.channelKey !== channelKey));
    }
  }, []);

  const value: GameSessionContextValue = {
    snapshot,
    connectionStatus,
    chatMessages,
    activityLogs,
    createRole,
    startAfk,
    stopAfk,
    claimOfflineReward,
    equipItem,
    unequipItem,
    dropItem,
    repairEquipment,
    learnSkillBook,
    configureSkillLoadout,
    createMarketListing,
    cancelMarketListing,
    buyMarketListing,
    challengePvp,
    sendChat,
    clearChannel,
  };

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
}
