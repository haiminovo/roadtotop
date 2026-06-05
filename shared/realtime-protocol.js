const CLIENT_MESSAGE_TYPES = Object.freeze({
  AFK_CLAIM: "game:afk:claim",
  AFK_START: "game:afk:start",
  AFK_STOP: "game:afk:stop",
  BACKPACK_DROP: "game:backpack:drop",
  BACKPACK_EQUIP: "game:backpack:equip",
  BACKPACK_LEARN_SKILL_BOOK: "game:backpack:learn-skill-book",
  BACKPACK_UNEQUIP: "game:backpack:unequip",
  CHAT_SEND: "game:chat:send",
  MARKET_BUY: "game:market:buy",
  MARKET_CANCEL: "game:market:cancel",
  MARKET_CREATE: "game:market:create",
  MARKET_CREATE_BUY_ORDER: "game:market:create-buy-order",
  MARKET_SOLD_DISMISS: "game:market:sold:dismiss",
  PVP_CHALLENGE: "game:pvp:challenge",
  SESSION_START: "game:session:start",
  SKILL_CONFIGURE_LOADOUT: "game:skill:configure-loadout",
});

const SERVER_MESSAGE_TYPES = Object.freeze({
  CHAT_HISTORY: "game:chat:history",
  CHAT_MESSAGE: "game:chat:message",
  ERROR: "game:error",
  SESSION_READY: "game:session:ready",
  STATE_UPDATE: "game:state:update",
});

const CLIENT_MESSAGE_SCHEMAS = Object.freeze({
  [CLIENT_MESSAGE_TYPES.AFK_CLAIM]: {},
  [CLIENT_MESSAGE_TYPES.AFK_START]: { activityKey: "string", mapKey: "string" },
  [CLIENT_MESSAGE_TYPES.AFK_STOP]: {},
  [CLIENT_MESSAGE_TYPES.BACKPACK_DROP]: { backpackId: "string" },
  [CLIENT_MESSAGE_TYPES.BACKPACK_EQUIP]: { backpackId: "string" },
  [CLIENT_MESSAGE_TYPES.BACKPACK_LEARN_SKILL_BOOK]: { backpackId: "string" },
  [CLIENT_MESSAGE_TYPES.BACKPACK_UNEQUIP]: { backpackId: "string" },
  [CLIENT_MESSAGE_TYPES.CHAT_SEND]: { channelKey: "string", content: "string" },
  [CLIENT_MESSAGE_TYPES.MARKET_BUY]: { listingId: "string" },
  [CLIENT_MESSAGE_TYPES.MARKET_CANCEL]: { listingId: "string" },
  [CLIENT_MESSAGE_TYPES.MARKET_CREATE]: { backpackId: "string", price: "number", quantity: "number" },
  [CLIENT_MESSAGE_TYPES.MARKET_CREATE_BUY_ORDER]: { itemId: "string", price: "number", quantity: "number" },
  [CLIENT_MESSAGE_TYPES.MARKET_SOLD_DISMISS]: { listingId: "string" },
  [CLIENT_MESSAGE_TYPES.PVP_CHALLENGE]: { targetRoleId: "string" },
  [CLIENT_MESSAGE_TYPES.SESSION_START]: { guestToken: "string" },
  [CLIENT_MESSAGE_TYPES.SKILL_CONFIGURE_LOADOUT]: { action: "skillAction", skillKey: "string" },
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePayload(payload) {
  return isPlainObject(payload) ? payload : {};
}

function isValidFieldValue(value, kind) {
  if (kind === "string") {
    return typeof value === "string" && value.trim().length > 0;
  }

  if (kind === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (kind === "skillAction") {
    return value === "equip" || value === "unequip";
  }

  return false;
}

function createClientMessage(type, payload = {}) {
  return {
    payload: normalizePayload(payload),
    type,
  };
}

function validateClientMessage(value) {
  if (!isPlainObject(value) || typeof value.type !== "string") {
    return {
      ok: false,
      error: "消息格式错误，缺少有效的消息类型。",
    };
  }

  const schema = CLIENT_MESSAGE_SCHEMAS[value.type];

  if (!schema) {
    return {
      ok: false,
      error: `未知的消息类型：${value.type}`,
    };
  }

  const payload = normalizePayload(value.payload);

  for (const [field, kind] of Object.entries(schema)) {
    if (!isValidFieldValue(payload[field], kind)) {
      return {
        ok: false,
        error: `消息 ${value.type} 缺少有效字段：${field}`,
      };
    }
  }

  return {
    message: {
      payload,
      type: value.type,
    },
    ok: true,
  };
}

function parseServerMessage(value) {
  if (!isPlainObject(value) || typeof value.type !== "string") {
    return null;
  }

  return {
    payload: normalizePayload(value.payload),
    type: value.type,
  };
}

module.exports = {
  CLIENT_MESSAGE_TYPES,
  SERVER_MESSAGE_TYPES,
  createClientMessage,
  parseServerMessage,
  validateClientMessage,
};
