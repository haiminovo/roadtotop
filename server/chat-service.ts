// ============================================================
// 聊天服务 - 消息存储和广播
// ============================================================

import { query } from './db.js';

export interface ChatMessageData {
  chatId?: number;
  userId: number;
  roleId: number;
  channelKey: string;
  senderName: string;
  content: string;
  createdAt?: string;
}

// 存储消息
export async function saveChatMessage(msg: ChatMessageData): Promise<ChatMessageData> {
  const result = await query(
    `INSERT INTO chat_log (user_id, role_id, channel_key, sender_name, content)
     VALUES ($1, $2, $3, $4, $5) RETURNING chat_id, created_at`,
    [msg.userId, msg.roleId, msg.channelKey, msg.senderName, msg.content]
  );
  return { ...msg, chatId: result.rows[0].chat_id, createdAt: result.rows[0].created_at };
}

// 获取频道历史消息
export async function getChannelHistory(channelKey: string, limit = 80): Promise<ChatMessageData[]> {
  const result = await query(
    `SELECT chat_id as "chatId", user_id as "userId", role_id as "roleId",
            channel_key as "channelKey", sender_name as "senderName",
            content, created_at as "createdAt"
     FROM chat_log WHERE channel_key=$1 ORDER BY created_at DESC LIMIT $2`,
    [channelKey, limit]
  );
  return result.rows.reverse();
}

// 获取所有频道的最新消息
export async function getAllChannelHistories(limit = 80): Promise<Record<string, ChatMessageData[]>> {
  const channels = ['world', 'trade', 'tavern'];
  const histories: Record<string, ChatMessageData[]> = {};
  for (const channel of channels) {
    histories[channel] = await getChannelHistory(channel, limit);
  }
  return histories;
}
