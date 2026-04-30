const { query, withTransaction } = require("./db");

const CHAT_CHANNELS = [
  { key: "world", label: "世界", summary: "默认公共频道，适合喊话和日常交流。" },
  { key: "trade", label: "交易", summary: "买卖、收购和交换物品。" },
  { key: "tavern", label: "酒馆", summary: "招募、组队和冒险情报。" },
];

const CHAT_MESSAGE_LIMIT = 80;
const CHAT_MESSAGE_MAX_LENGTH = 160;
const CHAT_SEND_COOLDOWN_MS = 3000;

function isValidChatChannel(channelKey) {
  return CHAT_CHANNELS.some((channel) => channel.key === channelKey);
}

function normalizeChatMessage(row) {
  return {
    channelKey: row.channel_key,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
    id: row.chat_id,
    senderName: row.sender_name,
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
    throw new Error("缺少游客 token。");
  }

  const user = await findUserByGuestToken(normalizedGuestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw new Error("创建角色后才能发言。");
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

  return result.rows.map(normalizeChatMessage);
}

async function createChatMessageForGuest(guestToken, channelKey, content) {
  const normalizedContent = typeof content === "string" ? content.trim() : "";
  const normalizedChannelKey = typeof channelKey === "string" ? channelKey.trim() : "";

  if (!isValidChatChannel(normalizedChannelKey)) {
    throw new Error("聊天频道不存在。");
  }

  if (!normalizedContent) {
    throw new Error("消息内容不能为空。");
  }

  if (normalizedContent.length > CHAT_MESSAGE_MAX_LENGTH) {
    throw new Error(`消息不能超过 ${CHAT_MESSAGE_MAX_LENGTH} 个字符。`);
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
        throw new Error("发言过快，请等待3秒后再试。");
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

  return normalizeChatMessage(result.rows[0]);
}

module.exports = {
  CHAT_CHANNELS,
  createChatMessageForGuest,
  getRecentChatMessages,
  isValidChatChannel,
};
