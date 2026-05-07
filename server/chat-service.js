const { query, withTransaction } = require("./db");

const CHAT_CHANNELS = [
  { key: "world", label: "世界", summary: "默认公共频道，适合喊话和日常交流。" },
  { key: "trade", label: "交易", summary: "买卖、收购和交换物品。" },
  { key: "tavern", label: "酒馆", summary: "招募、组队和冒险情报。" },
];

const CHAT_MESSAGE_LIMIT = 80;
const CHAT_MESSAGE_MAX_LENGTH = 160;
const CHAT_SEND_COOLDOWN_MS = 3000;
const BASE_HEALTH = 50;
const HEALTH_PER_VITALITY = 12;
const HEALTH_PER_LEVEL = 2;

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isValidChatChannel(channelKey) {
  return CHAT_CHANNELS.some((channel) => channel.key === channelKey);
}

function normalizeNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function getMaxHealth(vitality, level) {
  return (
    BASE_HEALTH
    + Math.max(0, Math.floor(vitality)) * HEALTH_PER_VITALITY
    + Math.max(1, Math.floor(level)) * HEALTH_PER_LEVEL
  );
}

function getBackpackEquippedCount(backpackRow) {
  return (backpackRow.equipped_slot_groups || []).length;
}

function getRoleEffectiveStats(role, backpack = []) {
  const nextStats = {
    strength: normalizeNumber(role.strength),
    agility: normalizeNumber(role.agility),
    intelligence: normalizeNumber(role.intelligence),
    vitality: normalizeNumber(role.vitality),
  };

  backpack.forEach((item) => {
    const equippedCount = getBackpackEquippedCount(item);

    if (equippedCount <= 0 || !item.stat_json) {
      return;
    }

    nextStats.strength += normalizeNumber(item.stat_json.strength) * equippedCount;
    nextStats.agility += normalizeNumber(item.stat_json.agility) * equippedCount;
    nextStats.intelligence += normalizeNumber(item.stat_json.intelligence) * equippedCount;
    nextStats.vitality += normalizeNumber(item.stat_json.vitality) * equippedCount;
  });

  return nextStats;
}

function normalizeEquippedSlotGroups(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => {
      if (!Array.isArray(group)) {
        return null;
      }

      const normalizedGroup = group
        .filter((slotKey) => typeof slotKey === "string" && slotKey.trim().length > 0)
        .map((slotKey) => slotKey.trim());

      return normalizedGroup.length > 0 ? normalizedGroup : null;
    })
    .filter(Boolean);
}

function normalizeChatRoleProfile(role, backpack) {
  const effectiveStats = getRoleEffectiveStats(role, backpack);
  const maxHealth = getMaxHealth(effectiveStats.vitality, role.level);

  return {
    roleId: role.role_id,
    name: role.name,
    raceKey: role.race_key,
    classKey: role.class_key,
    level: normalizeNumber(role.level),
    currentHealth: Math.min(maxHealth, normalizeNumber(role.current_health)),
    maxHealth,
    gold: normalizeNumber(role.gold),
    aetherCrystal: normalizeNumber(role.aether_crystal),
    avatarSeed: role.avatar_seed,
    stats: effectiveStats,
    equippedItems: backpack
      .filter((item) => getBackpackEquippedCount(item) > 0)
      .map((item) => ({
        backpackId: item.backpack_id,
        itemId: item.item_id,
        name: item.name,
        rarity: item.rarity,
        slot: item.slot,
        equippedCount: getBackpackEquippedCount(item),
        equippedSlotGroups: item.equipped_slot_groups || [],
      })),
  };
}

async function getChatRoleProfiles(roleIds) {
  const uniqueRoleIds = [...new Set(roleIds.filter((roleId) => typeof roleId === "string" && roleId.trim().length > 0))];

  if (uniqueRoleIds.length === 0) {
    return new Map();
  }

  const [rolesResult, backpackResult] = await Promise.all([
    query(
      `
        SELECT
          role_id,
          name,
          race_key,
          class_key,
          level,
          gold,
          aether_crystal,
          strength,
          agility,
          intelligence,
          vitality,
          current_health,
          avatar_seed
        FROM "role"
        WHERE role_id = ANY($1::text[])
      `,
      [uniqueRoleIds],
    ),
    query(
      `
        SELECT
          backpack.role_id,
          backpack.backpack_id,
          backpack.item_id,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
          item.slot,
          item.stat_json
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = ANY($1::text[])
      `,
      [uniqueRoleIds],
    ),
  ]);

  const backpackByRoleId = new Map();

  backpackResult.rows.forEach((item) => {
    const normalizedItem = {
      ...item,
      equipped_slot_groups: normalizeEquippedSlotGroups(item.equipped_slot_groups),
    };
    const current = backpackByRoleId.get(item.role_id);

    if (current) {
      current.push(normalizedItem);
      return;
    }

    backpackByRoleId.set(item.role_id, [normalizedItem]);
  });

  return new Map(
    rolesResult.rows.map((role) => [
      role.role_id,
      normalizeChatRoleProfile(role, backpackByRoleId.get(role.role_id) || []),
    ]),
  );
}

function normalizeChatMessage(row, roleProfiles = new Map()) {
  return {
    channelKey: row.channel_key,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
    id: row.chat_id,
    senderName: row.sender_name,
    senderRole: row.role_id ? (roleProfiles.get(row.role_id) || null) : null,
    senderRoleId: row.role_id || null,
    senderUserId: row.user_id,
  };
}

async function findUserByGuestToken(guestToken) {
  const result = await query(
    `SELECT user_id, guest_token FROM "user" WHERE guest_token = $1`,
    [guestToken],
  );

  return result.rows[0] || null;
}

async function findRoleByUserId(userId) {
  const result = await query(
    `
      SELECT role_id, user_id, name
      FROM "role"
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

async function requireChatAuthor(guestToken) {
  const normalizedGuestToken = typeof guestToken === "string" ? guestToken.trim() : "";

  if (!normalizedGuestToken) {
    throw createServiceError("缺少游客 token。", 400);
  }

  const user = await findUserByGuestToken(normalizedGuestToken);

  if (!user) {
    throw createServiceError("游客会话不存在，请重新登录。", 401);
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw createServiceError("创建角色后才能发言。", 403);
  }

  return { role, user };
}

async function getRecentChatMessages(limit = CHAT_MESSAGE_LIMIT) {
  const result = await query(
    `
      SELECT chat_id, user_id, role_id, channel_key, sender_name, content, created_at
      FROM (
        SELECT chat_id, user_id, role_id, channel_key, sender_name, content, created_at
        FROM chat_logs
        ORDER BY created_at DESC
        LIMIT $1
      ) recent_logs
      ORDER BY created_at ASC
    `,
    [limit],
  );

  const roleProfiles = await getChatRoleProfiles(result.rows.map((row) => row.role_id));
  return result.rows.map((row) => normalizeChatMessage(row, roleProfiles));
}

async function createChatMessageForGuest(guestToken, channelKey, content) {
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedChannelKey = typeof channelKey === "string" ? channelKey.trim() : "";

  if (!isValidChatChannel(normalizedChannelKey)) {
    throw createServiceError("聊天频道不存在。", 404);
  }

  if (!normalizedContent) {
    throw createServiceError("消息内容不能为空。", 400);
  }

  if (normalizedContent.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw createServiceError(`消息不能超过 ${CHAT_MESSAGE_MAX_LENGTH} 个字符。`, 400);
  }

  const { role, user } = await requireChatAuthor(guestToken);
  const chatId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const result = await withTransaction(async (client) => {
    await client.query(
      `
        SELECT user_id
        FROM "user"
        WHERE user_id = $1
        FOR UPDATE
      `,
      [user.user_id],
    );

    const latestMessageResult = await client.query(
      `
        SELECT created_at
        FROM chat_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [user.user_id],
    );

    const latestMessage = latestMessageResult.rows[0];

    if (latestMessage?.created_at) {
      const elapsedMs = Date.now() - new Date(latestMessage.created_at).getTime();

      if (elapsedMs < CHAT_SEND_COOLDOWN_MS) {
        throw createServiceError("发言过快，请等待3秒后再试。", 429);
      }
    }

    return client.query(
      `
        INSERT INTO chat_logs (
          chat_id,
          user_id,
          role_id,
          channel_key,
          sender_name,
          content,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING chat_id, user_id, role_id, channel_key, sender_name, content, created_at
      `,
      [
        chatId,
        user.user_id,
        role.role_id,
        normalizedChannelKey,
        role.name,
        normalizedContent,
      ],
    );
  });

  const roleProfiles = await getChatRoleProfiles([result.rows[0]?.role_id]);
  return normalizeChatMessage(result.rows[0], roleProfiles);
}

module.exports = {
  CHAT_CHANNELS,
  createChatMessageForGuest,
  getRecentChatMessages,
  isValidChatChannel,
};
