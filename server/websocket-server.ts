// ============================================================
// WebSocket 服务器 - 连接管理 + 消息路由
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import { validateClientMessage } from '../shared/realtime-protocol.js';
import { ensureDatabaseInitialized, query } from './db.js';
import { getGameConfig, invalidateConfigCache } from './dynamic-game-config.js';
import {
  getSessionSnapshot, createRole, startAfk, stopAfk, claimOfflineReward,
  equipItem, unequipItem, dropItem, learnSkillBook, configureSkillLoadout,
  createMarketListing, cancelMarketListing, buyMarketListing, challengePvp,
  settleAfkState,
} from './game-service.js';
import { saveChatMessage, getChannelHistory, getAllChannelHistories } from './chat-service.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: number | null;
  roleId: number | null;
  lastChatTime: number;
}

const clients = new Map<WebSocket, ConnectedClient>();

export function startWebSocketServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    const client: ConnectedClient = { ws, userId: null, roleId: null, lastChatTime: 0 };
    clients.set(ws, client);

    ws.on('message', async (data) => {
      try {
        const msg = validateClientMessage(JSON.parse(data.toString()));
        if (!msg) {
          sendError(ws, '无效的消息格式');
          return;
        }
        await handleMessage(client, msg);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '未知错误';
        sendError(ws, message);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  // 心跳检测
  setInterval(() => {
    for (const [ws, client] of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clients.delete(ws);
      }
    }
  }, 30000);

  console.log(`[WS] WebSocket server started on port ${port}`);
  return wss;
}

async function handleMessage(client: ConnectedClient, msg: { type: string; payload?: Record<string, unknown> }) {
  const { type, payload } = msg;

  switch (type) {
    case 'game:session:start': {
      const guestToken = payload?.guestToken as string;
      if (!guestToken) { sendError(client.ws, '缺少 guestToken'); return; }

      // 查找或创建用户
      let userResult = await query('SELECT * FROM "user" WHERE guest_token=$1', [guestToken]);
      if (userResult.rows.length === 0) {
        userResult = await query(
          `INSERT INTO "user" (guest_token, account_type) VALUES ($1, 'guest') RETURNING *`,
          [guestToken]
        );
      }
      const user = userResult.rows[0];
      client.userId = user.user_id;

      // 获取角色
      const roleResult = await query('SELECT * FROM role WHERE user_id=$1', [user.user_id]);
      if (roleResult.rows.length > 0) {
        client.roleId = roleResult.rows[0].role_id;
        const snapshot = await getSessionSnapshot(user.user_id);
        send(client.ws, 'game:session:ready', snapshot);
      } else {
        // 没有角色，需要创建 - 加载配置数据
        const config = await getGameConfig();
        send(client.ws, 'game:session:ready', {
          account: { guestToken, mode: 'guest', username: null, userId: user.user_id },
          needCreateRole: true,
          config: {
            activities: config.activityConfigs,
            classes: config.classConfigs,
            levels: [],
            maps: config.mapConfigs,
            races: config.raceConfigs,
          },
        });
      }
      break;
    }

    case 'game:role:create': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      const name = payload?.name as string;
      const raceKey = payload?.raceKey as string;
      const classKey = payload?.classKey as string;
      if (!name || !raceKey || !classKey) { sendError(client.ws, '参数不完整'); return; }

      await createRole(client.userId, name, raceKey, classKey);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:session:ready', snapshot);
      break;
    }

    case 'game:state:poll': {
      if (!client.userId) return;
      try {
        await settleAfkState(client.userId);
        const snapshot = await getSessionSnapshot(client.userId);
        if (snapshot) send(client.ws, 'game:state:update', snapshot);
      } catch (e) {
        // 轮询错误静默处理
      }
      break;
    }

    case 'game:afk:start': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      const activityKey = payload?.activityKey as string || 'combat';
      const mapKey = payload?.mapKey as string || 'plains';
      await startAfk(client.userId, activityKey, mapKey);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:afk:stop': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await stopAfk(client.userId);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:afk:claim': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await claimOfflineReward(client.userId);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:backpack:equip': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await equipItem(client.userId, payload?.backpackId as number, payload?.slot as string);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:backpack:unequip': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await unequipItem(client.userId, payload?.backpackId as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:backpack:drop': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await dropItem(client.userId, payload?.backpackId as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:backpack:learn-skill-book': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await learnSkillBook(client.userId, payload?.backpackId as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:skill:configure-loadout': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await configureSkillLoadout(client.userId, payload?.skillKeys as string[]);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:market:create': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await createMarketListing(client.userId, payload?.backpackId as number, payload?.price as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:market:cancel': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await cancelMarketListing(client.userId, payload?.listingId as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:market:buy': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      await buyMarketListing(client.userId, payload?.listingId as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      break;
    }

    case 'game:pvp:challenge': {
      if (!client.userId) { sendError(client.ws, '未登录'); return; }
      const result = await challengePvp(client.userId, payload?.targetRoleId as number);
      const snapshot = await getSessionSnapshot(client.userId);
      send(client.ws, 'game:state:update', snapshot);
      send(client.ws, 'game:pvp:challenge_result', result);
      break;
    }

    case 'game:chat:send': {
      if (!client.userId || !client.roleId) { sendError(client.ws, '未登录'); return; }
      const channelKey = payload?.channelKey as string || 'world';
      const content = payload?.content as string;
      if (!content || content.length > 160) { sendError(client.ws, '消息内容无效'); return; }

      // 冷却检查
      const now = Date.now();
      if (now - client.lastChatTime < 3000) { sendError(client.ws, '说话太快了，请稍后再试'); return; }
      client.lastChatTime = now;

      // 获取角色名
      const roleResult = await query('SELECT name FROM role WHERE role_id=$1', [client.roleId]);
      const senderName = roleResult.rows[0]?.name || '未知';

      const saved = await saveChatMessage({
        userId: client.userId, roleId: client.roleId,
        channelKey, senderName, content,
      });

      // 广播给所有连接的客户端
      broadcast('game:chat:message', saved);
      break;
    }

    case 'game:chat:history': {
      const channelKey = payload?.channelKey as string || 'world';
      const history = await getChannelHistory(channelKey);
      send(client.ws, 'game:chat:history', { channelKey, messages: history });
      break;
    }

    default:
      sendError(client.ws, `未知消息类型: ${type}`);
  }
}

function send(ws: WebSocket, type: string, payload?: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function sendError(ws: WebSocket, message: string) {
  send(ws, 'game:error', { message });
}

function broadcast(type: string, payload?: unknown) {
  for (const [ws] of clients) {
    send(ws, type, payload);
  }
}
