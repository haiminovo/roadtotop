// ============================================================
// WebSocket 实时协议定义
// ============================================================

// --- 客户端 -> 服务端 消息类型 ---
export type ClientMessageType =
  | 'game:session:start'
  | 'game:afk:start'
  | 'game:afk:stop'
  | 'game:afk:claim'
  | 'game:backpack:equip'
  | 'game:backpack:unequip'
  | 'game:backpack:drop'
  | 'game:backpack:learn-skill-book'
  | 'game:skill:configure-loadout'
  | 'game:market:create'
  | 'game:market:cancel'
  | 'game:market:buy'
  | 'game:pvp:challenge'
  | 'game:chat:send';

export interface ClientMessage {
  type: ClientMessageType;
  payload?: Record<string, unknown>;
}

// --- 服务端 -> 客户端 消息类型 ---
export type ServerMessageType =
  | 'game:error'
  | 'game:session:ready'
  | 'game:state:update'
  | 'game:chat:history'
  | 'game:chat:message'
  | 'game:pvp:challenge_result';

export interface ServerMessage {
  type: ServerMessageType;
  payload?: unknown;
}

// --- 验证函数 ---
export function validateClientMessage(data: unknown): ClientMessage | null {
  if (!data || typeof data !== 'object') return null;
  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== 'string') return null;
  return { type: msg.type as ClientMessageType, payload: msg.payload as Record<string, unknown> };
}

export function parseServerMessage(data: string): ServerMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed.type !== 'string') return null;
    return parsed as ServerMessage;
  } catch {
    return null;
  }
}
