const { query, withTransaction } = require("./db");

const STARTING_CHARACTER = "无名旅人";

function makeTimestamp(value) {
  return value ? new Date(value).getTime() : null;
}

function roundResource(value) {
  return Math.max(0, Math.floor(value));
}

function createPlayerState(playerId, characterName) {
  const now = Date.now();

  return {
    adventureEndsAt: null,
    adventureRewardIngots: 0,
    characterName: characterName || STARTING_CHARACTER,
    forgingIngots: 544,
    guildReputation: 7200,
    idleSilverPerMinute: 2340,
    idleStaminaPerMinute: 96,
    lastUpdatedAt: now,
    playerId,
    silver: 128440,
    stamina: 2819,
    unclaimedSilver: 0,
    unclaimedStamina: 0,
    villageRenown: 1284,
  };
}

function syncPlayer(player, now = Date.now()) {
  const elapsedMs = Math.max(0, now - player.lastUpdatedAt);
  const minuteFactor = elapsedMs / 60000;

  if (minuteFactor > 0) {
    player.unclaimedSilver += player.idleSilverPerMinute * minuteFactor;
    player.unclaimedStamina += player.idleStaminaPerMinute * minuteFactor;
    player.lastUpdatedAt = now;
  }

  let adventureFinished = false;

  if (player.adventureEndsAt && now >= player.adventureEndsAt) {
    player.forgingIngots += player.adventureRewardIngots;
    player.guildReputation += 45;
    player.adventureEndsAt = null;
    player.adventureRewardIngots = 0;
    adventureFinished = true;
  }

  return { adventureFinished };
}

function snapshotPlayer(player) {
  return {
    adventure: player.adventureEndsAt
      ? {
          returnsAt: player.adventureEndsAt,
          rewardEstimate: `预计带回 ${roundResource(player.adventureRewardIngots)} 枚锻造锭`,
        }
      : null,
    characterName: player.characterName,
    forgingIngots: roundResource(player.forgingIngots),
    guildReputation: roundResource(player.guildReputation),
    idleSilverPerMinute: roundResource(player.idleSilverPerMinute),
    idleStaminaPerMinute: roundResource(player.idleStaminaPerMinute),
    lastUpdatedAt: player.lastUpdatedAt,
    playerId: player.playerId,
    silver: roundResource(player.silver),
    stamina: roundResource(player.stamina),
    unclaimedSilver: roundResource(player.unclaimedSilver),
    unclaimedStamina: roundResource(player.unclaimedStamina),
    villageRenown: roundResource(player.villageRenown),
  };
}

function hydratePlayer(row) {
  return {
    adventureEndsAt: makeTimestamp(row.adventure_ends_at),
    adventureRewardIngots: Number(row.adventure_reward_ingots),
    characterName: row.character_name,
    forgingIngots: Number(row.forging_ingots),
    guildReputation: Number(row.guild_reputation),
    idleSilverPerMinute: Number(row.idle_silver_per_minute),
    idleStaminaPerMinute: Number(row.idle_stamina_per_minute),
    lastUpdatedAt: makeTimestamp(row.last_updated_at),
    playerId: row.player_id,
    silver: Number(row.silver),
    stamina: Number(row.stamina),
    unclaimedSilver: Number(row.unclaimed_silver),
    unclaimedStamina: Number(row.unclaimed_stamina),
    villageRenown: Number(row.village_renown),
  };
}

async function findPlayer(playerId) {
  if (!playerId) {
    return null;
  }

  const result = await query("SELECT * FROM players WHERE player_id = $1", [playerId]);

  if (result.rowCount === 0) {
    return null;
  }

  return hydratePlayer(result.rows[0]);
}

async function persistPlayer(player, client = null) {
  const executor = client ?? { query };

  await executor.query(
    `
      INSERT INTO players (
        player_id,
        character_name,
        silver,
        stamina,
        forging_ingots,
        village_renown,
        guild_reputation,
        unclaimed_silver,
        unclaimed_stamina,
        idle_silver_per_minute,
        idle_stamina_per_minute,
        adventure_ends_at,
        adventure_reward_ingots,
        last_updated_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (player_id) DO UPDATE SET
        character_name = EXCLUDED.character_name,
        silver = EXCLUDED.silver,
        stamina = EXCLUDED.stamina,
        forging_ingots = EXCLUDED.forging_ingots,
        village_renown = EXCLUDED.village_renown,
        guild_reputation = EXCLUDED.guild_reputation,
        unclaimed_silver = EXCLUDED.unclaimed_silver,
        unclaimed_stamina = EXCLUDED.unclaimed_stamina,
        idle_silver_per_minute = EXCLUDED.idle_silver_per_minute,
        idle_stamina_per_minute = EXCLUDED.idle_stamina_per_minute,
        adventure_ends_at = EXCLUDED.adventure_ends_at,
        adventure_reward_ingots = EXCLUDED.adventure_reward_ingots,
        last_updated_at = EXCLUDED.last_updated_at,
        updated_at = NOW()
    `,
    [
      player.playerId,
      player.characterName,
      roundResource(player.silver),
      roundResource(player.stamina),
      roundResource(player.forgingIngots),
      roundResource(player.villageRenown),
      roundResource(player.guildReputation),
      roundResource(player.unclaimedSilver),
      roundResource(player.unclaimedStamina),
      roundResource(player.idleSilverPerMinute),
      roundResource(player.idleStaminaPerMinute),
      player.adventureEndsAt ? new Date(player.adventureEndsAt) : null,
      roundResource(player.adventureRewardIngots),
      new Date(player.lastUpdatedAt),
    ],
  );
}

async function loadOrCreatePlayer(playerId, characterName) {
  const existing = await findPlayer(playerId);

  if (existing) {
    return existing;
  }

  const newPlayerId = playerId || `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const player = createPlayerState(newPlayerId, characterName);
  await persistPlayer(player);
  return player;
}

async function appendChatLog(message) {
  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO chat_logs (chat_id, player_id, character_name, content, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        message.id,
        message.playerId,
        message.characterName,
        message.content,
        new Date(message.createdAt),
      ],
    );
  });
}

module.exports = {
  appendChatLog,
  loadOrCreatePlayer,
  persistPlayer,
  roundResource,
  snapshotPlayer,
  syncPlayer,
};
