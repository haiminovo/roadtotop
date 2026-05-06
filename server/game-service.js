const { query, withTransaction } = require("./db");
const {
  DEFAULT_AFK_ENCOUNTER_CHANCES,
  DEFAULT_BATTLE_ENEMIES,
  DEFAULT_CLASS_CONFIGS,
  DEFAULT_ITEM_CATALOG,
  DEFAULT_LEVEL_TABLE,
  DEFAULT_MAP_CONFIGS,
  DEFAULT_RACE_CONFIGS,
  DEFAULT_SYSTEM_BALANCE,
  refreshRuntimeGameConfig,
} = require("./dynamic-game-config");

const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
const AFK_TASK_SECONDS = 10;
const LEVEL_CAP = 30;
const EXP_PER_LEVEL = 100;
const EXP_GROWTH_PER_LEVEL = 10;
const LEVEL_CURVE_VERSION = 2;
const BASE_HEALTH = 50;
const HEALTH_PER_VITALITY = 12;
const HEALTH_PER_LEVEL = 2;
const DEFAULT_BODY_SLOT_CAPACITIES = {
  head: 1,
  hand: 2,
  torso: 1,
  legs: 1,
  feet: 1,
  neck: 1,
  accessory: 2,
};
const OFFLINE_MODAL_THRESHOLD_MS = 45 * 1000;
const MAX_RECENT_ENCOUNTERS = 8;
const MAX_RECENT_BATTLE_LOGS = 16;
const MARKET_CATEGORY_OPTIONS = [{ key: "equipment", label: "装备" }];
let MARKET_FEE_RATE_PERCENT = DEFAULT_SYSTEM_BALANCE.marketFeeRatePercent;
let BATTLE_TRIGGER_CHANCE = DEFAULT_SYSTEM_BALANCE.battleTriggerChance;
let ACTION_BAR_TARGET = DEFAULT_SYSTEM_BALANCE.actionBarTarget;
let PLAYER_HEAL_RATIO = DEFAULT_SYSTEM_BALANCE.playerHealRatio;
let PLAYER_GUARD_RATIO = DEFAULT_SYSTEM_BALANCE.playerGuardRatio;
let ENEMY_HEAL_RATIO = DEFAULT_SYSTEM_BALANCE.enemyHealRatio;
let ENEMY_GUARD_RATIO = DEFAULT_SYSTEM_BALANCE.enemyGuardRatio;
let SPELL_BASE_CHANCE = DEFAULT_SYSTEM_BALANCE.spellBaseChance;
let INTELLIGENCE_SPELL_BONUS_THRESHOLD = DEFAULT_SYSTEM_BALANCE.intelligenceSpellBonusThreshold;
let EXECUTION_REWARD_TICK_SECONDS = DEFAULT_SYSTEM_BALANCE.executionRewardTickSeconds;
let PLAYER_GUARD_HEALTH_THRESHOLD = DEFAULT_SYSTEM_BALANCE.playerGuardHealthThreshold;
let ENEMY_GUARD_HEALTH_THRESHOLD = DEFAULT_SYSTEM_BALANCE.enemyGuardHealthThreshold;
let PLAYER_GUARD_COOLDOWN_TURNS = DEFAULT_SYSTEM_BALANCE.playerGuardCooldownTurns;
let ENEMY_GUARD_COOLDOWN_TURNS = DEFAULT_SYSTEM_BALANCE.enemyGuardCooldownTurns;
let battleEnemyTemplates = DEFAULT_BATTLE_ENEMIES;
let itemSeeds = DEFAULT_ITEM_CATALOG;
let itemSeedById = new Map(itemSeeds.map((item) => [item.itemId, item]));
let raceConfigs = DEFAULT_RACE_CONFIGS;
let classConfigs = DEFAULT_CLASS_CONFIGS;
let mapConfigs = DEFAULT_MAP_CONFIGS;
let afkEncounterChances = DEFAULT_AFK_ENCOUNTER_CHANCES;
let afkEncounterPoolByTier = {
  common: [],
  rare: [],
  legendary: [],
};

function applyRuntimeConfig(config) {
  MARKET_FEE_RATE_PERCENT = config.systemBalance.marketFeeRatePercent;
  BATTLE_TRIGGER_CHANCE = config.systemBalance.battleTriggerChance;
  ACTION_BAR_TARGET = config.systemBalance.actionBarTarget;
  PLAYER_HEAL_RATIO = config.systemBalance.playerHealRatio;
  PLAYER_GUARD_RATIO = config.systemBalance.playerGuardRatio;
  ENEMY_HEAL_RATIO = config.systemBalance.enemyHealRatio;
  ENEMY_GUARD_RATIO = config.systemBalance.enemyGuardRatio;
  SPELL_BASE_CHANCE = config.systemBalance.spellBaseChance;
  INTELLIGENCE_SPELL_BONUS_THRESHOLD = config.systemBalance.intelligenceSpellBonusThreshold;
  EXECUTION_REWARD_TICK_SECONDS = config.systemBalance.executionRewardTickSeconds;
  PLAYER_GUARD_HEALTH_THRESHOLD = config.systemBalance.playerGuardHealthThreshold;
  ENEMY_GUARD_HEALTH_THRESHOLD = config.systemBalance.enemyGuardHealthThreshold;
  PLAYER_GUARD_COOLDOWN_TURNS = config.systemBalance.playerGuardCooldownTurns;
  ENEMY_GUARD_COOLDOWN_TURNS = config.systemBalance.enemyGuardCooldownTurns;
  battleEnemyTemplates = config.battleEnemyTemplates;
  itemSeeds = config.itemCatalog;
  itemSeedById = config.itemSeedById;
  raceConfigs = config.raceConfigs;
  classConfigs = config.classConfigs;
  mapConfigs = config.mapConfigs;
  afkEncounterChances = config.afkEncounterChances;
  afkEncounterPoolByTier = config.afkEncounterPoolByTier;
}

async function ensureRuntimeGameConfig() {
  applyRuntimeConfig(await refreshRuntimeGameConfig());
}

function getExpRequiredForLevel(level) {
  const safeLevel = Math.min(LEVEL_CAP - 1, Math.max(1, Math.floor(level)));
  return EXP_PER_LEVEL + (safeLevel - 1) * EXP_GROWTH_PER_LEVEL;
}

function getLevelBaseExp(level) {
  const safeLevel = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  const completedLevels = safeLevel - 1;
  return (
    completedLevels * EXP_PER_LEVEL
    + ((completedLevels * Math.max(0, completedLevels - 1)) / 2) * EXP_GROWTH_PER_LEVEL
  );
}

const levelTable = DEFAULT_LEVEL_TABLE;

function toMillis(value) {
  return value ? new Date(value).getTime() : null;
}

function normalizeNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function normalizeSignedNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
}

function migrateLegacyRoleExp(role) {
  if ((role.exp_curve_version || 1) >= LEVEL_CURVE_VERSION) {
    role.level = getLevelFromExp(role.exp);
    return false;
  }

  const safeLevel = Math.min(levelTable.length, Math.max(1, Math.floor(role.level)));
  const safeExp = Math.max(0, Math.floor(role.exp));
  const legacyBaseExp = (safeLevel - 1) * EXP_PER_LEVEL;
  const legacyProgress = Math.max(0, safeExp - legacyBaseExp);

  if (safeLevel >= levelTable.length) {
    role.exp = getLevelBaseExp(levelTable.length) + legacyProgress;
  } else {
    const legacyProgressRatio = Math.min(1, legacyProgress / EXP_PER_LEVEL);
    role.exp = getLevelBaseExp(safeLevel) + Math.round(getExpRequiredForLevel(safeLevel) * legacyProgressRatio);
  }

  role.level = getLevelFromExp(role.exp);
  role.exp_curve_version = LEVEL_CURVE_VERSION;
  return true;
}

function calculateMarketFee(price) {
  const normalizedPrice = normalizeNumber(price);
  const feeAmount = Math.floor((normalizedPrice * MARKET_FEE_RATE_PERCENT) / 100);
  return {
    feeAmount,
    sellerReceiveAmount: Math.max(0, normalizedPrice - feeAmount),
  };
}

function getRarityRank(rarity) {
  return {
    white: 1,
    green: 2,
    blue: 3,
    purple: 4,
    orange: 5,
  }[rarity] || 0;
}

function sortBackpackRows(backpack) {
  backpack.sort((left, right) => {
    const leftEquippedCount = (left.equipped_slot_groups || []).length;
    const rightEquippedCount = (right.equipped_slot_groups || []).length;

    if (leftEquippedCount !== rightEquippedCount) {
      return rightEquippedCount - leftEquippedCount;
    }

    const rarityDelta = getRarityRank(right.rarity) - getRarityRank(left.rarity);

    if (rarityDelta !== 0) {
      return rarityDelta;
    }

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function buildMarketSnapshot(roleId, activeListings, ownListings) {
  return {
    feeRatePercent: MARKET_FEE_RATE_PERCENT,
    categoryOptions: [...MARKET_CATEGORY_OPTIONS],
    rarityOptions: ["white", "green", "blue", "purple", "orange"],
    slotOptions: ["head", "hand", "torso", "legs", "feet", "neck", "accessory"],
    listings: activeListings.map((listing) => ({
      listingId: listing.listing_id,
      itemId: listing.item_id,
      categoryKey: listing.category_key,
      name: listing.name,
      rarity: listing.rarity,
      slot: listing.slot,
      slotUsage: listing.slot_usage,
      description: listing.description,
      sellPrice: listing.sell_price,
      stats: listing.stat_json || {},
      price: listing.price,
      sellerName: listing.seller_name,
      availableCount: normalizeNumber(listing.available_count),
      createdAt: toMillis(listing.created_at) || Date.now(),
      isOwnListing: roleId === listing.seller_role_id,
    })),
    myListings: ownListings.map((listing) => ({
      listingId: listing.listing_id,
      itemId: listing.item_id,
      categoryKey: listing.category_key,
      name: listing.name,
      rarity: listing.rarity,
      slot: listing.slot,
      slotUsage: listing.slot_usage,
      description: listing.description,
      sellPrice: listing.sell_price,
      stats: listing.stat_json || {},
      price: listing.price,
      status: listing.status,
      createdAt: toMillis(listing.created_at) || Date.now(),
      soldAt: toMillis(listing.sold_at),
      cancelledAt: toMillis(listing.cancelled_at),
      buyerRoleId: listing.buyer_role_id || null,
      sellerReceiveAmount: listing.seller_receive_amount || 0,
      feeAmount: listing.fee_amount || 0,
      quantity: normalizeNumber(listing.listing_count || 0),
      sellerNoticeSeen: Boolean(listing.seller_notice_seen),
    })),
  };
}

function getBodySlotCapacities(raceKey) {
  const race = raceConfigs.find((item) => item.key === raceKey) || null;
  const adjustments = race?.bodySlotAdjustments || {};

  return {
    head: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.head + (adjustments.head || 0)),
    hand: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.hand + (adjustments.hand || 0)),
    torso: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.torso + (adjustments.torso || 0)),
    legs: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.legs + (adjustments.legs || 0)),
    feet: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.feet + (adjustments.feet || 0)),
    neck: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.neck + (adjustments.neck || 0)),
    accessory: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.accessory + (adjustments.accessory || 0)),
  };
}

function getBodySlotTypeLabel(slotType) {
  return {
    head: "头部",
    hand: "手部",
    torso: "上身",
    legs: "下身",
    feet: "脚部",
    neck: "脖颈",
    accessory: "饰品",
  }[slotType] || slotType;
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

function buildBodySlotKeys(capacities) {
  return [
    ["head", capacities.head],
    ["hand", capacities.hand],
    ["torso", capacities.torso],
    ["legs", capacities.legs],
    ["feet", capacities.feet],
    ["neck", capacities.neck],
    ["accessory", capacities.accessory],
  ].flatMap(([slotType, count]) =>
    Array.from({ length: Math.max(0, count) }, (_, index) => `${slotType}-${index + 1}`),
  );
}

function buildAvailableBodySlotKeys(capacities, slotType) {
  const count = Math.max(0, capacities[slotType] || 0);
  return Array.from({ length: count }, (_, index) => `${slotType}-${index + 1}`);
}

function getBodySlotIndex(slotKey) {
  return Number(slotKey.split("-")[1]) || 0;
}

function allocateEquipmentSlots(role, backpack, item) {
  if (item.quantity <= getBackpackEquippedCount(item)) {
    throw new Error("这件物品已经没有可装备的数量了。");
  }

  const capacities = getBodySlotCapacities(role.race_key);
  const candidateSlotKeys = buildAvailableBodySlotKeys(capacities, item.slot);

  if (candidateSlotKeys.length < item.slot_usage) {
    throw new Error("当前种族没有足够的对应肢体槽位。");
  }

  const occupiedSlots = new Set(
    backpack.flatMap((entry) => (entry.equipped_slot_groups || []).flatMap((group) => group)),
  );
  const freeSlots = candidateSlotKeys.filter((slotKey) => !occupiedSlots.has(slotKey));

  if (freeSlots.length >= item.slot_usage) {
    const allocatedSlots = freeSlots.slice(0, item.slot_usage);
    item.equipped_slot_groups.push(allocatedSlots);
    item.equipped = item.equipped_slot_groups.length > 0;
    return allocatedSlots;
  }

  const releasedSlots = [...freeSlots];
  const groupsToRelease = [];
  const slotOwners = new Map();

  backpack.forEach((entry) => {
    (entry.equipped_slot_groups || []).forEach((group) => {
      if (!group.every((slotKey) => candidateSlotKeys.includes(slotKey))) {
        return;
      }

      group.forEach((slotKey) => {
        slotOwners.set(slotKey, { entry, group });
      });
    });
  });

  const candidateSlotsByPriority = [...candidateSlotKeys].sort((left, right) => getBodySlotIndex(right) - getBodySlotIndex(left));
  const markedGroups = new Set();

  for (const slotKey of candidateSlotsByPriority) {
    if (releasedSlots.length >= item.slot_usage) {
      break;
    }

    const owner = slotOwners.get(slotKey);

    if (!owner || markedGroups.has(owner.group)) {
      continue;
    }

    markedGroups.add(owner.group);
    groupsToRelease.push(owner);
    releasedSlots.push(...owner.group);
  }

  if (releasedSlots.length < item.slot_usage) {
    throw new Error("对应肢体部位已经被占满，无法继续装备。");
  }

  const groupsMarkedForRelease = new Set(groupsToRelease.map((entry) => entry.group));
  const touchedEntries = new Set(groupsToRelease.map((entry) => entry.entry));

  touchedEntries.forEach((entry) => {
    entry.equipped_slot_groups = (entry.equipped_slot_groups || []).filter((group) => !groupsMarkedForRelease.has(group));
    entry.equipped = entry.equipped_slot_groups.length > 0;
  });

  const availableAfterRelease = candidateSlotKeys.filter((slotKey) => releasedSlots.includes(slotKey));
  const allocatedSlots = availableAfterRelease.slice(0, item.slot_usage);
  item.equipped_slot_groups.push(allocatedSlots);
  item.equipped = item.equipped_slot_groups.length > 0;

  return allocatedSlots;
}

function removeOneEquippedGroup(backpackItem) {
  if (!backpackItem.equipped_slot_groups || backpackItem.equipped_slot_groups.length === 0) {
    throw new Error("这件物品当前没有处于装备状态。");
  }

  backpackItem.equipped_slot_groups.shift();
  backpackItem.equipped = backpackItem.equipped_slot_groups.length > 0;
}

function buildRoleBodySlots(role, backpack) {
  const capacities = getBodySlotCapacities(role.race_key);
  const bodySlotKeys = buildBodySlotKeys(capacities);
  const equippedBySlotKey = new Map();

  for (const item of backpack) {
    for (const group of item.equipped_slot_groups || []) {
      for (const slotKey of group) {
        equippedBySlotKey.set(slotKey, item);
      }
    }
  }

  return bodySlotKeys.map((slotKey) => {
    const [slotType, indexText] = slotKey.split("-");
    const equippedItem = equippedBySlotKey.get(slotKey) || null;
    const capacity = capacities[slotType];
    const index = Number(indexText);
    const label = capacity > 1 && Number.isFinite(index)
      ? `${getBodySlotTypeLabel(slotType)} ${index}`
      : getBodySlotTypeLabel(slotType);

    return {
      key: slotKey,
      label,
      slotType,
      item: equippedItem
        ? {
            backpackId: equippedItem.backpack_id,
            itemId: equippedItem.item_id,
            name: equippedItem.name,
            rarity: equippedItem.rarity,
          }
        : null,
    };
  });
}

function resolveEncounterRewardItems(reward) {
  return (reward.items || [])
    .map((itemReward) => {
      const quantity = normalizeNumber(itemReward.quantity);
      const itemSeed = itemSeedById.get(itemReward.itemId);

      if (!itemSeed || quantity <= 0) {
        return null;
      }

      return {
        itemId: itemSeed.itemId,
        quantity,
        name: itemSeed.name,
        rarity: itemSeed.rarity,
        slot: itemSeed.slot,
        slotUsage: itemSeed.slotUsage,
        description: itemSeed.description,
        sellPrice: itemSeed.sellPrice,
        stats: itemSeed.stats,
      };
    })
    .filter(Boolean);
}

function applyEncounterItemsToBackpack(backpack, itemDrops) {
  if (!itemDrops.length) {
    return false;
  }

  let didMutate = false;

  for (const itemDrop of itemDrops) {
    const existing = backpack.find((entry) => entry.item_id === itemDrop.itemId);

    if (existing) {
      existing.quantity += itemDrop.quantity;
      didMutate = true;
      continue;
    }

    backpack.push({
      backpack_id: `bag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      item_id: itemDrop.itemId,
      quantity: itemDrop.quantity,
      equipped: false,
      equipped_slot_groups: [],
      name: itemDrop.name,
      rarity: itemDrop.rarity,
      slot: itemDrop.slot,
      slot_usage: itemDrop.slotUsage,
      description: itemDrop.description,
      sell_price: itemDrop.sellPrice,
      stat_json: itemDrop.stats,
    });
    didMutate = true;
  }

  if (didMutate) {
    sortBackpackRows(backpack);
  }

  return didMutate;
}

function makeEncounterId() {
  return `encounter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getMaxHealth(vitality, level) {
  return (
    BASE_HEALTH
    + Math.max(0, Math.floor(vitality)) * HEALTH_PER_VITALITY
    + Math.max(1, Math.floor(level)) * HEALTH_PER_LEVEL
  );
}

function normalizeEncounterLog(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      if (
        typeof entry.id !== "string"
        || typeof entry.key !== "string"
        || typeof entry.title !== "string"
        || typeof entry.description !== "string"
        || !["common", "rare", "legendary"].includes(entry.tier)
      ) {
        return null;
      }

      const reward = entry.reward && typeof entry.reward === "object" ? entry.reward : {};
      const triggeredAt = Number(entry.triggeredAt);

      if (!Number.isFinite(triggeredAt)) {
        return null;
      }

      return {
        id: entry.id,
        key: entry.key,
        tier: entry.tier,
        title: entry.title,
        description: entry.description,
        reward: {
          gold: normalizeNumber(reward.gold),
          aetherCrystal: normalizeNumber(reward.aetherCrystal),
          exp: normalizeNumber(reward.exp),
          healthDelta: normalizeSignedNumber(reward.healthDelta),
          items: Array.isArray(reward.items)
            ? reward.items
              .map((itemReward) => {
                if (!itemReward || typeof itemReward !== "object") {
                  return null;
                }

                const quantity = normalizeNumber(itemReward.quantity);

                if (typeof itemReward.itemId !== "string" || quantity <= 0) {
                  return null;
                }

                return {
                  itemId: itemReward.itemId,
                  quantity,
                  name: typeof itemReward.name === "string" ? itemReward.name : undefined,
                  rarity: ["white", "green", "blue", "purple", "orange"].includes(itemReward.rarity)
                    ? itemReward.rarity
                    : undefined,
                };
              })
              .filter(Boolean)
            : [],
        },
        triggeredAt,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_RECENT_ENCOUNTERS);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeBattleLog(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      if (typeof entry.id !== "string" || typeof entry.text !== "string") {
        return null;
      }

      return {
        id: entry.id,
        text: entry.text,
        timestamp: normalizeNumber(entry.timestamp),
        type: typeof entry.type === "string" ? entry.type : "system",
      };
    })
    .filter(Boolean)
    .slice(0, MAX_RECENT_BATTLE_LOGS);
}

function makeBattleLogId() {
  return `battle-log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeBattleId() {
  return `battle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function calculatePhysicalDamage(strength) {
  return Math.max(1, Math.round(normalizeNumber(strength) * 2));
}

function calculateSpellDamage(intelligence) {
  return Math.max(1, Math.round(normalizeNumber(intelligence) * 2.5));
}

function calculateDamageReduction(vitality) {
  return clamp(normalizeNumber(vitality) / 20, 0, 0.85);
}

function calculateDodgeChance(agility) {
  return clamp(normalizeNumber(agility) / 50, 0, 0.75);
}

function buildBattleCombatant({
  currentHealth,
  intelligence,
  label,
  maxHealth,
  name,
  side,
  skillUsesRemaining,
  stats,
}) {
  return {
    actionBar: 0,
    currentHealth: normalizeNumber(currentHealth),
    defenseTurns: 0,
    guardCooldownTurns: 0,
    intelligence,
    label,
    maxHealth: normalizeNumber(maxHealth),
    name,
    side,
    skillUsesRemaining: {
      guard: normalizeNumber(skillUsesRemaining?.guard),
      spell: normalizeNumber(skillUsesRemaining?.spell),
    },
    stats: {
      strength: normalizeNumber(stats.strength),
      agility: normalizeNumber(stats.agility),
      intelligence: normalizeNumber(stats.intelligence),
      vitality: normalizeNumber(stats.vitality),
    },
  };
}

function getPlayerBattleProfile(role, backpack = []) {
  const stats = getRoleEffectiveStats(role, backpack);
  const maxHealth = getRoleMaxHealth(role, backpack);

  return {
    currentHealth: clamp(normalizeNumber(role.current_health), 1, maxHealth),
    label: "我方",
    maxHealth,
    name: role.name,
    stats,
  };
}

function scaleEnemyStat(baseValue, multiplier, variance = 0.12) {
  const scaled = baseValue * multiplier;
  const offset = 1 - variance + Math.random() * variance * 2;
  return Math.max(4, Math.round(scaled * offset));
}

function createEnemyProfile(role, backpack = [], mapKey = null) {
  const playerProfile = getPlayerBattleProfile(role, backpack);
  const template = battleEnemyTemplates[Math.floor(Math.random() * battleEnemyTemplates.length)] || battleEnemyTemplates[0];
  const map = getMapConfig(mapKey);
  const mapLevelBonus = map ? 1 : 0;
  const level = Math.max(1, normalizeNumber(role.level) + (Math.random() < 0.35 ? 1 : 0) + mapLevelBonus);
  const stats = {
    strength: scaleEnemyStat(playerProfile.stats.strength, template.statWeights.strength),
    agility: scaleEnemyStat(playerProfile.stats.agility, template.statWeights.agility),
    intelligence: scaleEnemyStat(playerProfile.stats.intelligence, template.statWeights.intelligence),
    vitality: scaleEnemyStat(playerProfile.stats.vitality, template.statWeights.vitality),
  };
  const maxHealth = Math.max(30, stats.vitality * 10);

  return {
    key: template.key,
    level,
    name: template.name,
    summary: template.summary,
    skillCaps: {
      guard: normalizeNumber(template.skillCaps?.guard),
      spell: normalizeNumber(template.skillCaps?.spell),
    },
    currentHealth: maxHealth,
    maxHealth,
    stats,
  };
}

function createBattleState(role, backpack = [], mapKey = null, startedAt = Date.now()) {
  const player = getPlayerBattleProfile(role, backpack);
  const enemy = createEnemyProfile(role, backpack, mapKey);
  const battleId = makeBattleId();

  return {
    active: true,
    battleId,
    enemy,
    lastResolvedAt: startedAt,
    logs: normalizeBattleLog([
      {
        id: makeBattleLogId(),
        text: `${enemy.name} 闯入挂机路线，自动战斗开始。`,
        timestamp: startedAt,
        type: "system",
      },
    ]),
    outcome: null,
    player: buildBattleCombatant({
      currentHealth: player.currentHealth,
      intelligence: player.stats.intelligence,
      label: "我方",
      maxHealth: player.maxHealth,
      name: player.name,
      side: "player",
      skillUsesRemaining: {
        guard: 0,
        spell: 0,
      },
      stats: player.stats,
    }),
    status: "active",
    turnCount: 0,
    winner: null,
    enemyCombatant: buildBattleCombatant({
      currentHealth: enemy.currentHealth,
      intelligence: enemy.stats.intelligence,
      label: "敌方",
      maxHealth: enemy.maxHealth,
      name: enemy.name,
      side: "enemy",
      skillUsesRemaining: enemy.skillCaps,
      stats: enemy.stats,
    }),
  };
}

function normalizeBattleState(value) {
  if (!value || typeof value !== "object") {
    return { active: false, logs: [] };
  }

  const playerStats = value.player?.stats && typeof value.player.stats === "object" ? value.player.stats : {};
  const enemyStats = value.enemyCombatant?.stats && typeof value.enemyCombatant.stats === "object" ? value.enemyCombatant.stats : {};
  const enemy = value.enemy && typeof value.enemy === "object" ? value.enemy : {};

  return {
    active: Boolean(value.active),
    battleId: typeof value.battleId === "string" ? value.battleId : null,
    enemy: {
      key: typeof enemy.key === "string" ? enemy.key : "unknown-enemy",
      level: normalizeNumber(enemy.level),
      name: typeof enemy.name === "string" ? enemy.name : "未知敌人",
      summary: typeof enemy.summary === "string" ? enemy.summary : "",
      skillCaps: {
        guard: normalizeNumber(enemy.skillCaps?.guard),
        spell: normalizeNumber(enemy.skillCaps?.spell),
      },
      currentHealth: normalizeNumber(enemy.currentHealth),
      maxHealth: normalizeNumber(enemy.maxHealth),
      stats: {
        strength: normalizeNumber(enemy.stats?.strength),
        agility: normalizeNumber(enemy.stats?.agility),
        intelligence: normalizeNumber(enemy.stats?.intelligence),
        vitality: normalizeNumber(enemy.stats?.vitality),
      },
    },
    enemyCombatant: {
      actionBar: normalizeNumber(value.enemyCombatant?.actionBar),
      currentHealth: normalizeNumber(value.enemyCombatant?.currentHealth),
      defenseTurns: normalizeNumber(value.enemyCombatant?.defenseTurns),
      guardCooldownTurns: normalizeNumber(value.enemyCombatant?.guardCooldownTurns),
      intelligence: normalizeNumber(value.enemyCombatant?.intelligence),
      label: typeof value.enemyCombatant?.label === "string" ? value.enemyCombatant.label : "敌方",
      maxHealth: normalizeNumber(value.enemyCombatant?.maxHealth),
      name: typeof value.enemyCombatant?.name === "string" ? value.enemyCombatant.name : "未知敌人",
      side: "enemy",
      skillUsesRemaining: {
        guard: normalizeNumber(value.enemyCombatant?.skillUsesRemaining?.guard),
        spell: normalizeNumber(value.enemyCombatant?.skillUsesRemaining?.spell),
      },
      stats: {
        strength: normalizeNumber(enemyStats.strength),
        agility: normalizeNumber(enemyStats.agility),
        intelligence: normalizeNumber(enemyStats.intelligence),
        vitality: normalizeNumber(enemyStats.vitality),
      },
    },
    lastResolvedAt: normalizeNumber(value.lastResolvedAt),
    logs: normalizeBattleLog(value.logs),
    outcome: value.outcome && typeof value.outcome === "object"
      ? {
        loser: typeof value.outcome.loser === "string" ? value.outcome.loser : null,
        summary: typeof value.outcome.summary === "string" ? value.outcome.summary : "",
        winner: typeof value.outcome.winner === "string" ? value.outcome.winner : null,
      }
      : null,
    player: {
      actionBar: normalizeNumber(value.player?.actionBar),
      currentHealth: normalizeNumber(value.player?.currentHealth),
      defenseTurns: normalizeNumber(value.player?.defenseTurns),
      guardCooldownTurns: normalizeNumber(value.player?.guardCooldownTurns),
      intelligence: normalizeNumber(value.player?.intelligence),
      label: typeof value.player?.label === "string" ? value.player.label : "我方",
      maxHealth: normalizeNumber(value.player?.maxHealth),
      name: typeof value.player?.name === "string" ? value.player.name : "我方",
      side: "player",
      skillUsesRemaining: {
        guard: normalizeNumber(value.player?.skillUsesRemaining?.guard),
        spell: normalizeNumber(value.player?.skillUsesRemaining?.spell),
      },
      stats: {
        strength: normalizeNumber(playerStats.strength),
        agility: normalizeNumber(playerStats.agility),
        intelligence: normalizeNumber(playerStats.intelligence),
        vitality: normalizeNumber(playerStats.vitality),
      },
    },
    status: value.status === "finished" ? "finished" : "active",
    turnCount: normalizeNumber(value.turnCount),
    winner: value.winner === "player" || value.winner === "enemy" ? value.winner : null,
  };
}

function isBattleActive(battleState) {
  return Boolean(battleState?.active && battleState?.status === "active");
}

function addBattleLog(battleState, text, type = "system", timestamp = Date.now()) {
  battleState.logs = [
    {
      id: makeBattleLogId(),
      text,
      timestamp,
      type,
    },
    ...normalizeBattleLog(battleState.logs),
  ].slice(0, MAX_RECENT_BATTLE_LOGS);
}

function getBattleCombatantBySide(battleState, side) {
  return side === "player" ? battleState.player : battleState.enemyCombatant;
}

function getOpponentSide(side) {
  return side === "player" ? "enemy" : "player";
}

function maybeConsumeDefense(combatant) {
  if (combatant.defenseTurns > 0) {
    combatant.defenseTurns = Math.max(0, combatant.defenseTurns - 1);
  }
}

function decideBattleAction(actor, target) {
  const actorHealthRatio = actor.maxHealth > 0 ? actor.currentHealth / actor.maxHealth : 0;
  const targetHealthRatio = target.maxHealth > 0 ? target.currentHealth / target.maxHealth : 0;
  const guardThreshold = actor.side === "player" ? PLAYER_GUARD_HEALTH_THRESHOLD : ENEMY_GUARD_HEALTH_THRESHOLD;
  const canUseGuard = actor.side === "player" || actor.skillUsesRemaining.guard > 0;
  const canUseSpell = actor.side === "player" || actor.skillUsesRemaining.spell > 0;

  if (actorHealthRatio < guardThreshold && actor.guardCooldownTurns <= 0 && canUseGuard) {
    return {
      action: "guard",
      amount: actor.side === "player"
        ? Math.max(10, Math.round(actor.maxHealth * PLAYER_HEAL_RATIO))
        : Math.max(8, Math.round(actor.maxHealth * ENEMY_HEAL_RATIO)),
      guardRatio: actor.side === "player" ? PLAYER_GUARD_RATIO : ENEMY_GUARD_RATIO,
    };
  }

  if (targetHealthRatio < 0.2 && canUseSpell) {
    return {
      action: "spell",
      damage: calculateSpellDamage(actor.stats.intelligence),
    };
  }

  const spellChance = actor.stats.intelligence >= INTELLIGENCE_SPELL_BONUS_THRESHOLD ? SPELL_BASE_CHANCE : 0.35;

  if (canUseSpell && Math.random() < spellChance) {
    return {
      action: "spell",
      damage: calculateSpellDamage(actor.stats.intelligence),
    };
  }

  return {
    action: "attack",
    damage: calculatePhysicalDamage(actor.stats.strength),
  };
}

function applyBattleDamage(attacker, defender, battleAction) {
  if (Math.random() < calculateDodgeChance(defender.stats.agility)) {
    return {
      didDodge: true,
      damage: 0,
    };
  }

  const reductionRate = calculateDamageReduction(defender.stats.vitality) + (
    defender.defenseTurns > 0
      ? (defender.side === "player" ? PLAYER_GUARD_RATIO : ENEMY_GUARD_RATIO)
      : 0
  );
  const damage = Math.max(1, Math.round(battleAction.damage * (1 - clamp(reductionRate, 0, 0.9))));

  defender.currentHealth = Math.max(0, defender.currentHealth - damage);
  return {
    didDodge: false,
    damage,
  };
}

function resolveBattleAction(battleState, actingSide, timestamp) {
  const actor = getBattleCombatantBySide(battleState, actingSide);
  const defender = getBattleCombatantBySide(battleState, getOpponentSide(actingSide));

  if (actor.currentHealth <= 0 || defender.currentHealth <= 0) {
    return;
  }

  actor.actionBar = 0;
  battleState.turnCount += 1;
  actor.guardCooldownTurns = Math.max(0, actor.guardCooldownTurns - 1);

  const decision = decideBattleAction(actor, defender);

  if (decision.action === "guard") {
    actor.currentHealth = Math.min(actor.maxHealth, actor.currentHealth + decision.amount);
    actor.defenseTurns = 1;
    actor.guardCooldownTurns = actor.side === "player" ? PLAYER_GUARD_COOLDOWN_TURNS : ENEMY_GUARD_COOLDOWN_TURNS;
    if (actor.side === "enemy") {
      actor.skillUsesRemaining.guard = Math.max(0, actor.skillUsesRemaining.guard - 1);
    }
    addBattleLog(
      battleState,
      `${actor.name} 进入防御姿态并恢复了 ${decision.amount} 点生命。`,
      "guard",
      timestamp,
    );
    maybeConsumeDefense(defender);
    return;
  }

  const damageResult = applyBattleDamage(actor, defender, {
    damage: decision.damage,
  });

  if (decision.action === "spell" && actor.side === "enemy") {
    actor.skillUsesRemaining.spell = Math.max(0, actor.skillUsesRemaining.spell - 1);
  }

  if (damageResult.didDodge) {
    addBattleLog(
      battleState,
      `${actor.name}${decision.action === "spell" ? " 施放法术" : " 发动普攻"}，但被 ${defender.name} 闪避了。`,
      "dodge",
      timestamp,
    );
  } else {
    addBattleLog(
      battleState,
      `${actor.name}${decision.action === "spell" ? " 施放法术" : " 发动普攻"}，对 ${defender.name} 造成 ${damageResult.damage} 点伤害。`,
      decision.action,
      timestamp,
    );
  }

  maybeConsumeDefense(actor);
  maybeConsumeDefense(defender);

  if (defender.currentHealth <= 0) {
    battleState.active = false;
    battleState.status = "finished";
    battleState.winner = actingSide;
    battleState.outcome = {
      loser: defender.side,
      summary: `${actor.name} 击败了 ${defender.name}。`,
      winner: actingSide,
    };
    addBattleLog(
      battleState,
      battleState.outcome.summary,
      "result",
      timestamp,
    );
  }
}

function syncBattleStateToRole(role, battleState, backpack = []) {
  if (!battleState?.player) {
    return false;
  }

  const maxHealth = getRoleMaxHealth(role, backpack);
  const nextHealth = clamp(normalizeNumber(battleState.player.currentHealth), 0, maxHealth);

  if (nextHealth === normalizeNumber(role.current_health)) {
    return false;
  }

  role.current_health = nextHealth;
  return true;
}

function handleBattleOutcome(role, battleState, backpack = []) {
  if (!battleState?.outcome || battleState.outcome.winner !== "enemy") {
    return false;
  }

  const nextLevel = Math.max(1, normalizeNumber(role.level) - 1);
  role.level = nextLevel;
  role.exp = getLevelBaseExp(nextLevel);
  role.current_health = getRoleMaxHealth(role, backpack);
  battleState.player.currentHealth = role.current_health;
  addBattleLog(
    battleState,
    `${role.name} 在战斗中倒下，等级下降 1 级并重整状态。`,
    "penalty",
    Date.now(),
  );
  return true;
}

function resolveBattleProgress(role, afk, backpack = [], options = {}) {
  const now = options.now || Date.now();
  const battleState = normalizeBattleState(afk.battle_state);

  if (!isBattleActive(battleState)) {
    afk.battle_state = battleState;
    return {
      battleStarted: false,
      battleState,
      didMutateAfk: false,
      didMutateRole: false,
      finished: false,
    };
  }

  const lastResolvedAt = battleState.lastResolvedAt || now;
  const elapsedSeconds = Math.max(0, Math.floor((now - lastResolvedAt) / 1000));

  if (elapsedSeconds <= 0) {
    afk.battle_state = battleState;
    return {
      battleStarted: false,
      battleState,
      didMutateAfk: false,
      didMutateRole: false,
      finished: false,
    };
  }

  let didMutateRole = false;

  for (let second = 0; second < elapsedSeconds; second += 1) {
    if (!isBattleActive(battleState)) {
      break;
    }

    const timestamp = lastResolvedAt + (second + 1) * 1000;
    battleState.player.actionBar = Math.min(ACTION_BAR_TARGET, battleState.player.actionBar + battleState.player.stats.agility);
    battleState.enemyCombatant.actionBar = Math.min(ACTION_BAR_TARGET, battleState.enemyCombatant.actionBar + battleState.enemyCombatant.stats.agility);

    while (
      isBattleActive(battleState)
      && (battleState.player.actionBar >= ACTION_BAR_TARGET || battleState.enemyCombatant.actionBar >= ACTION_BAR_TARGET)
    ) {
      if (
        battleState.player.actionBar >= ACTION_BAR_TARGET
        && battleState.enemyCombatant.actionBar >= ACTION_BAR_TARGET
      ) {
        const playerActsFirst = battleState.player.stats.agility >= battleState.enemyCombatant.stats.agility;
        resolveBattleAction(battleState, playerActsFirst ? "player" : "enemy", timestamp);

        if (isBattleActive(battleState)) {
          resolveBattleAction(battleState, playerActsFirst ? "enemy" : "player", timestamp);
        }
        continue;
      }

      if (battleState.player.actionBar >= ACTION_BAR_TARGET) {
        resolveBattleAction(battleState, "player", timestamp);
        continue;
      }

      resolveBattleAction(battleState, "enemy", timestamp);
    }
  }

  battleState.lastResolvedAt = lastResolvedAt + elapsedSeconds * 1000;
  didMutateRole = syncBattleStateToRole(role, battleState, backpack) || didMutateRole;

  if (!isBattleActive(battleState) && battleState.outcome?.winner === "enemy") {
    didMutateRole = handleBattleOutcome(role, battleState, backpack) || didMutateRole;
  }

  battleState.enemy.currentHealth = battleState.enemyCombatant.currentHealth;
  afk.battle_state = battleState;

  return {
    battleStarted: false,
    battleState,
    didMutateAfk: true,
    didMutateRole,
    finished: !isBattleActive(battleState),
  };
}

function pickRandomEncounter(tier) {
  const pool = afkEncounterPoolByTier[tier];

  if (!pool || pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function resolveEncounterTierByRoll(roll) {
  if (roll < afkEncounterChances.legendary) {
    return "legendary";
  }

  if (roll < afkEncounterChances.legendary + afkEncounterChances.rare) {
    return "rare";
  }

  if (roll < afkEncounterChances.legendary + afkEncounterChances.rare + afkEncounterChances.common) {
    return "common";
  }

  return null;
}

function buildEncounterDelta(executions, settledAt) {
  const delta = {
    aetherCrystal: 0,
    encounters: [],
    exp: 0,
    gold: 0,
    itemDrops: [],
  };

  for (let index = 0; index < executions; index += 1) {
    const tier = resolveEncounterTierByRoll(Math.random());

    if (!tier) {
      continue;
    }

    const encounter = pickRandomEncounter(tier);

    if (!encounter) {
      continue;
    }

    const reward = {
      gold: normalizeNumber(encounter.reward.gold),
      aetherCrystal: normalizeNumber(encounter.reward.aetherCrystal),
      exp: normalizeNumber(encounter.reward.exp),
      ...(normalizeSignedNumber(encounter.reward.healthDelta) !== 0
        ? { healthDelta: normalizeSignedNumber(encounter.reward.healthDelta) }
        : {}),
      items: resolveEncounterRewardItems(encounter.reward).map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        name: item.name,
        rarity: item.rarity,
      })),
    };

    delta.gold += reward.gold;
    delta.aetherCrystal += reward.aetherCrystal;
    delta.exp += reward.exp;
    delta.itemDrops.push(
      ...reward.items.map((itemReward) => {
        const itemSeed = itemSeedById.get(itemReward.itemId);

        if (!itemSeed) {
          return null;
        }

        return {
          itemId: itemSeed.itemId,
          quantity: itemReward.quantity,
          name: itemSeed.name,
          rarity: itemSeed.rarity,
          slot: itemSeed.slot,
          description: itemSeed.description,
          sellPrice: itemSeed.sellPrice,
          stats: itemSeed.stats,
        };
      }).filter(Boolean),
    );
    delta.encounters.push({
      id: makeEncounterId(),
      key: encounter.key,
      tier,
      title: encounter.title,
      description: encounter.description,
      reward,
      triggeredAt: settledAt,
    });
  }

  return delta;
}

function getLevelFromExp(exp) {
  const safeExp = Math.max(0, Math.floor(exp));

  for (let index = levelTable.length - 1; index >= 0; index -= 1) {
    if (safeExp >= levelTable[index].totalExpRequired) {
      return levelTable[index].level;
    }
  }

  return 1;
}

function getCurrentLevelProgress(exp) {
  const currentLevel = getLevelFromExp(exp);
  const currentBase = getLevelBaseExp(currentLevel);
  const nextLevelExp = currentLevel >= LEVEL_CAP ? 0 : getExpRequiredForLevel(currentLevel);

  return {
    currentLevel,
    currentLevelExp: Math.max(0, exp - currentBase),
    nextLevelExp,
  };
}

function getMapConfig(mapKey) {
  return mapConfigs.find((item) => item.key === mapKey) || null;
}

function buildHourlyReward(mapKey) {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds: 3600,
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds: 3600,
    gold: map.goldPerMinute * 60,
    aetherCrystal: Math.floor(map.aetherPerMinute * 60),
    exp: map.expPerMinute * 60,
  };
}

function buildRewardForSeconds(mapKey, seconds) {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds,
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds,
    gold: Math.floor((seconds * map.goldPerMinute) / 60),
    aetherCrystal: Math.floor((seconds * map.aetherPerMinute) / 60),
    exp: Math.floor((seconds * map.expPerMinute) / 60),
  };
}

function createSimulationSummary() {
  return {
    battleStarted: false,
    didMutateAfk: false,
    didMutateBackpack: false,
    didMutateRole: false,
    itemDrops: [],
  };
}

function addRewardToPending(afk, reward) {
  afk.pending_gold += reward.gold;
  afk.pending_aether_crystal += reward.aetherCrystal;
  afk.pending_exp += reward.exp;
}

function getRoleMaxHealth(role, backpack = []) {
  return getMaxHealth(getRoleEffectiveStats(role, backpack).vitality, role.level);
}

function normalizeRoleHealth(role, backpack = []) {
  const maxHealth = getRoleMaxHealth(role, backpack);
  const rawHealth = Number(role.current_health);
  const nextHealth = Number.isFinite(rawHealth) && rawHealth > 0
    ? Math.min(maxHealth, Math.floor(rawHealth))
    : maxHealth;

  if (nextHealth === role.current_health) {
    return false;
  }

  role.current_health = nextHealth;
  return true;
}

function applyEncounterEffectsToRole(role, encounters, backpack = []) {
  let didMutate = false;

  for (const encounter of encounters) {
    const healthDelta = normalizeSignedNumber(encounter.reward.healthDelta);

    if (healthDelta === 0) {
      continue;
    }

    didMutate = true;

    if (healthDelta > 0) {
      role.current_health = Math.min(getRoleMaxHealth(role, backpack), role.current_health + healthDelta);
      continue;
    }

    role.current_health += healthDelta;

    if (role.current_health > 0) {
      continue;
    }

    const nextLevel = Math.max(1, role.level - 1);
    role.level = nextLevel;
    role.exp = getLevelBaseExp(nextLevel);
    role.current_health = getRoleMaxHealth(role, backpack);
  }

  return didMutate;
}

function applyRewardToRole(role, reward, backpack = []) {
  if (reward.gold <= 0 && reward.aetherCrystal <= 0 && reward.exp <= 0) {
    return false;
  }

  const previousLevel = role.level;
  const previousMaxHealth = getRoleMaxHealth(role, backpack);
  role.gold += reward.gold;
  role.aether_crystal += reward.aetherCrystal;
  role.exp += reward.exp;
  role.level = getLevelFromExp(role.exp);
  const nextMaxHealth = getRoleMaxHealth(role, backpack);

  if (role.level > previousLevel) {
    role.current_health = Math.min(
      nextMaxHealth,
      role.current_health + Math.max(0, nextMaxHealth - previousMaxHealth),
    );
  } else {
    role.current_health = Math.min(nextMaxHealth, role.current_health);
  }

  return true;
}

function applyPendingRewardToRole(role, afk, backpack = []) {
  return applyRewardToRole(role, {
    aetherCrystal: afk.pending_aether_crystal,
    encounters: [],
    exp: afk.pending_exp,
    itemDrops: [],
    executions: 0,
    gold: afk.pending_gold,
  }, backpack);
}

function maybeStartBattle(data, timestamp, summary) {
  if (isBattleActive(data.afk.battle_state) || Math.random() >= BATTLE_TRIGGER_CHANCE) {
    return false;
  }

  data.afk.battle_state = createBattleState(data.role, data.backpack, data.afk.map_key, timestamp);
  summary.battleStarted = true;
  summary.didMutateAfk = true;
  summary.didMutateRole = syncBattleStateToRole(data.role, data.afk.battle_state, data.backpack) || summary.didMutateRole;
  return true;
}

function resolveAfkExecution(data, timestamp, options, summary) {
  const baseReward = buildRewardForSeconds(data.afk.map_key, AFK_TASK_SECONDS);
  const encounterDelta = buildEncounterDelta(1, timestamp);
  const rewardDelta = {
    aetherCrystal: baseReward.aetherCrystal + encounterDelta.aetherCrystal,
    encounters: encounterDelta.encounters,
    exp: baseReward.exp + encounterDelta.exp,
    itemDrops: encounterDelta.itemDrops,
    executions: 1,
    gold: baseReward.gold + encounterDelta.gold,
  };

  addRewardToPending(data.afk, rewardDelta);
  data.afk.recent_encounters = [
    ...encounterDelta.encounters.slice().reverse(),
    ...normalizeEncounterLog(data.afk.recent_encounters),
  ].slice(0, MAX_RECENT_ENCOUNTERS);

  summary.didMutateAfk = true;
  summary.didMutateRole = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack) || summary.didMutateRole;
  summary.didMutateBackpack = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops) || summary.didMutateBackpack;
  summary.itemDrops.push(...rewardDelta.itemDrops);

  if (options.autoApplyReward) {
    summary.didMutateRole = applyRewardToRole(data.role, rewardDelta, data.backpack) || summary.didMutateRole;
    consumePendingReward(data.afk, rewardDelta);
  }

  maybeStartBattle(data, timestamp, summary);
}

function settleAfkState(data, options = {}) {
  const now = options.now || Date.now();
  const summary = createSimulationSummary();

  if (data.afk.status !== "active" || !data.afk.map_key || !data.afk.last_settled_at) {
    return summary;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(data.afk.last_settled_at).getTime()) / 1000),
  );

  if (elapsedSeconds <= 0) {
    return summary;
  }

  const grantedSeconds = options.capSeconds === undefined
    ? elapsedSeconds
    : Math.min(elapsedSeconds, Math.max(0, options.capSeconds));

  if (grantedSeconds <= 0) {
    return summary;
  }

  let simulatedTimestamp = new Date(data.afk.last_settled_at).getTime();

  for (let second = 0; second < grantedSeconds; second += 1) {
    simulatedTimestamp += 1000;

    if (isBattleActive(data.afk.battle_state)) {
      const battleProgress = resolveBattleProgress(data.role, data.afk, data.backpack, { now: simulatedTimestamp });
      summary.didMutateAfk = battleProgress.didMutateAfk || summary.didMutateAfk;
      summary.didMutateRole = battleProgress.didMutateRole || summary.didMutateRole;
      continue;
    }

    data.afk.accrued_seconds = normalizeNumber(data.afk.accrued_seconds) + EXECUTION_REWARD_TICK_SECONDS;
    summary.didMutateAfk = true;

    if (data.afk.accrued_seconds < AFK_TASK_SECONDS) {
      continue;
    }

    data.afk.accrued_seconds = 0;
    resolveAfkExecution(data, simulatedTimestamp, options, summary);
  }

  data.afk.last_settled_at = new Date(now);

  if (data.afk.battle_state && typeof data.afk.battle_state === "object") {
    data.afk.battle_state.lastResolvedAt = now;
    summary.didMutateAfk = true;
  }

  return summary;
}

function consumePendingReward(afk, reward) {
  afk.pending_gold = Math.max(0, afk.pending_gold - reward.gold);
  afk.pending_aether_crystal = Math.max(0, afk.pending_aether_crystal - reward.aetherCrystal);
  afk.pending_exp = Math.max(0, afk.pending_exp - reward.exp);
}

function discardCurrentTaskProgress(afk) {
  afk.accrued_seconds = 0;
}

async function persistRole(client, role) {
  await client.query(
    `
      UPDATE "role"
      SET
        level = $2,
        exp = $3,
        exp_curve_version = $4,
        gold = $5,
        aether_crystal = $6,
        current_health = $7,
        updated_at = NOW()
      WHERE role_id = $1
    `,
    [
      role.role_id,
      role.level,
      normalizeNumber(role.exp),
      role.exp_curve_version || LEVEL_CURVE_VERSION,
      normalizeNumber(role.gold),
      normalizeNumber(role.aether_crystal),
      normalizeNumber(role.current_health),
    ],
  );
}

async function persistAfk(client, afk) {
  await client.query(
    `
      UPDATE afk
      SET
        status = $2,
        map_key = $3,
        started_at = $4,
        last_settled_at = $5,
        pending_gold = $6,
        pending_aether_crystal = $7,
        pending_exp = $8,
        accrued_seconds = $9,
        recent_encounters = $10::jsonb,
        battle_state = $11::jsonb,
        updated_at = NOW()
      WHERE afk_id = $1
    `,
    [
      afk.afk_id,
      afk.status,
      afk.map_key,
      afk.started_at,
      afk.last_settled_at,
      normalizeNumber(afk.pending_gold),
      normalizeNumber(afk.pending_aether_crystal),
      normalizeNumber(afk.pending_exp),
      normalizeNumber(afk.accrued_seconds),
      JSON.stringify(normalizeEncounterLog(afk.recent_encounters)),
      JSON.stringify(normalizeBattleState(afk.battle_state)),
    ],
  );
}

async function persistBackpackItemRewards(client, roleId, itemDrops) {
  if (!itemDrops.length) {
    return;
  }

  const itemDropsById = itemDrops.reduce((accumulator, itemDrop) => {
    const current = accumulator.get(itemDrop.itemId);

    if (current) {
      current.quantity += itemDrop.quantity;
      return accumulator;
    }

    accumulator.set(itemDrop.itemId, {
      backpackId: itemDrop.backpackId || `bag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      quantity: itemDrop.quantity,
    });
    return accumulator;
  }, new Map());

  for (const [itemId, entry] of itemDropsById.entries()) {
    const updated = await client.query(
      `
        UPDATE backpack
        SET
          quantity = backpack.quantity + $3,
          updated_at = NOW()
        WHERE role_id = $1 AND item_id = $2
        RETURNING backpack_id
      `,
      [roleId, itemId, entry.quantity],
    );

    if (updated.rowCount > 0) {
      continue;
    }

    await client.query(
      `
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, equipped_slot_groups, created_at, updated_at)
        VALUES ($1, $2, $3, $4, FALSE, '[]'::jsonb, NOW(), NOW())
      `,
      [entry.backpackId, roleId, itemId, entry.quantity],
    );
  }
}

async function persistBackpackEquipState(client, backpack) {
  for (const item of backpack) {
    await client.query(
      `
        UPDATE backpack
        SET
          equipped = $2,
          equipped_slot_groups = $3::jsonb,
          updated_at = NOW()
        WHERE backpack_id = $1
      `,
      [
        item.backpack_id,
        (item.equipped_slot_groups || []).length > 0,
        JSON.stringify(item.equipped_slot_groups || []),
      ],
    );
  }
}

async function upsertBackpackItemQuantity(client, roleId, itemId, quantity) {
  const normalizedQuantity = normalizeNumber(quantity);

  if (normalizedQuantity <= 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, equipped_slot_groups, created_at, updated_at)
      VALUES ($1, $2, $3, $4, FALSE, '[]'::jsonb, NOW(), NOW())
      ON CONFLICT (role_id, item_id)
      DO UPDATE SET
        quantity = backpack.quantity + EXCLUDED.quantity,
        updated_at = NOW()
    `,
    [`bag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, roleId, itemId, normalizedQuantity],
  );
}

async function getMarketActiveSummaryRows() {
  const result = await query(
    `
      WITH ranked_listings AS (
        SELECT
          market_listing.listing_id,
          market_listing.seller_role_id,
          seller_role.name AS seller_name,
          market_listing.item_id,
          market_listing.category_key,
          market_listing.price,
          market_listing.status,
          market_listing.buyer_role_id,
          market_listing.sold_price,
          market_listing.fee_amount,
          market_listing.seller_receive_amount,
          market_listing.created_at,
          market_listing.updated_at,
          market_listing.sold_at,
          market_listing.cancelled_at,
          item.name,
          item.rarity,
          item.slot,
          item.slot_usage,
          item.description,
          item.sell_price,
          item.stat_json,
          ROW_NUMBER() OVER (
            PARTITION BY market_listing.item_id
            ORDER BY market_listing.price ASC, market_listing.created_at ASC, market_listing.listing_id ASC
          ) AS row_number,
          COUNT(*) OVER (PARTITION BY market_listing.item_id) AS available_count
        FROM market_listing
        JOIN item ON item.item_id = market_listing.item_id
        JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
        WHERE market_listing.status = 'active'
      )
      SELECT
        listing_id,
        seller_role_id,
        seller_name,
        item_id,
        category_key,
        price,
        status,
        buyer_role_id,
        sold_price,
        fee_amount,
        seller_receive_amount,
        created_at,
        updated_at,
        sold_at,
        cancelled_at,
        name,
        rarity,
        slot,
        slot_usage,
        description,
        sell_price,
        stat_json,
        available_count
      FROM ranked_listings
      WHERE row_number = 1
      ORDER BY price ASC, rarity DESC, name ASC
    `,
  );

  return result.rows;
}

async function getMarketOwnListingRows(roleId) {
  const result = await query(
    `
      SELECT
        MIN(market_listing.listing_id) AS listing_id,
        market_listing.seller_role_id,
        seller_role.name AS seller_name,
        market_listing.item_id,
        market_listing.category_key,
        market_listing.price,
        market_listing.status,
        MIN(market_listing.buyer_role_id) AS buyer_role_id,
        MIN(market_listing.sold_price) AS sold_price,
        SUM(market_listing.fee_amount) AS fee_amount,
        SUM(market_listing.seller_receive_amount) AS seller_receive_amount,
        BOOL_AND(market_listing.seller_notice_seen) AS seller_notice_seen,
        MIN(market_listing.created_at) AS created_at,
        MAX(market_listing.updated_at) AS updated_at,
        MAX(market_listing.sold_at) AS sold_at,
        MAX(market_listing.cancelled_at) AS cancelled_at,
        item.name,
        item.rarity,
        item.slot,
        item.slot_usage,
        item.description,
        item.sell_price,
        item.stat_json,
        COUNT(*)::INTEGER AS listing_count
      FROM market_listing
      JOIN item ON item.item_id = market_listing.item_id
      JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
      WHERE
        market_listing.seller_role_id = $1
        AND NOT (market_listing.status = 'sold' AND market_listing.seller_notice_seen = TRUE)
      GROUP BY
        market_listing.seller_role_id,
        seller_role.name,
        market_listing.item_id,
        market_listing.category_key,
        market_listing.price,
        market_listing.status,
        item.name,
        item.rarity,
        item.slot,
        item.slot_usage,
        item.description,
        item.sell_price,
        item.stat_json
      ORDER BY
        CASE market_listing.status
          WHEN 'sold' THEN CASE WHEN BOOL_AND(market_listing.seller_notice_seen) THEN 1 ELSE 0 END
          WHEN 'active' THEN 2
          ELSE 3
        END,
        COALESCE(MAX(market_listing.sold_at), MIN(market_listing.created_at)) DESC
      LIMIT 24
    `,
    [roleId],
  );

  return result.rows;
}

async function getMarketSnapshotForRole(roleId) {
  const [activeListings, ownListings] = await Promise.all([
    getMarketActiveSummaryRows(),
    roleId ? getMarketOwnListingRows(roleId) : Promise.resolve([]),
  ]);

  return buildMarketSnapshot(roleId || null, activeListings, ownListings);
}

async function deleteBackpackEntry(client, roleId, backpackId) {
  const result = await client.query(
    `
      DELETE FROM backpack
      WHERE role_id = $1 AND backpack_id = $2
    `,
    [roleId, backpackId],
  );

  return result.rowCount > 0;
}

async function findUserByGuestToken(guestToken) {
  const result = await query(
    `
      SELECT
        user_id,
        guest_token,
        account_type,
        username,
        last_login_at,
        last_seen_at
      FROM "user"
      WHERE guest_token = $1
    `,
    [guestToken],
  );

  return result.rows[0] || null;
}

async function findRoleByUserId(userId) {
  const result = await query(
    `
      SELECT
        role_id,
        user_id,
        name,
        race_key,
        class_key,
        level,
        exp,
        exp_curve_version,
        gold,
        aether_crystal,
        strength,
        agility,
        intelligence,
        vitality,
        current_health,
        avatar_seed
      FROM "role"
      WHERE user_id = $1
    `,
    [userId],
  );

  const role = result.rows[0] || null;

  if (role && migrateLegacyRoleExp(role)) {
    await query(
      `
        UPDATE "role"
        SET
          level = $2,
          exp = $3,
          exp_curve_version = $4,
          updated_at = NOW()
        WHERE role_id = $1
      `,
      [role.role_id, role.level, role.exp, role.exp_curve_version],
    );
  }

  return role;
}

async function requireDashboardData(guestToken) {
  await ensureRuntimeGameConfig();
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw new Error("角色不存在，请先创建角色。");
  }

  const [afkResult, backpackResult] = await Promise.all([
    query(
      `
        SELECT
          afk_id,
          role_id,
          status,
          map_key,
          started_at,
          last_settled_at,
          pending_gold,
        pending_aether_crystal,
        pending_exp,
        accrued_seconds,
        recent_encounters,
        battle_state
        FROM afk
        WHERE role_id = $1
      `,
      [role.role_id],
    ),
    query(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
          item.slot,
          item.slot_usage,
          item.description,
          item.sell_price,
          item.stat_json
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = $1
        ORDER BY backpack.equipped DESC, item.rarity DESC, item.name ASC
      `,
      [role.role_id],
    ),
  ]);

  const afk = afkResult.rows[0];

  if (!afk) {
    throw new Error("挂机状态不存在，请重新创建角色。");
  }

  afk.recent_encounters = normalizeEncounterLog(afk.recent_encounters);
  afk.battle_state = normalizeBattleState(afk.battle_state);
  backpackResult.rows.forEach((item) => {
    const itemSeed = itemSeedById.get(item.item_id);
    if (itemSeed) {
      item.slot = itemSeed.slot;
      item.slot_usage = itemSeed.slotUsage;
    }
    item.equipped_slot_groups = normalizeEquippedSlotGroups(item.equipped_slot_groups);
    item.equipped = item.equipped_slot_groups.length > 0;
  });
  sortBackpackRows(backpackResult.rows);
  const market = await getMarketSnapshotForRole(role.role_id);

  return {
    afk,
    backpack: backpackResult.rows,
    market,
    role,
    user,
  };
}

function buildSnapshot(data, options = {}) {
  const progress = getCurrentLevelProgress(data.role.exp);
  const currentMap = data.afk.map_key ? getMapConfig(data.afk.map_key) : null;
  const bodySlotCapacities = getBodySlotCapacities(data.role.race_key);
  const bodySlots = buildRoleBodySlots(data.role, data.backpack);
  const effectiveStats = getRoleEffectiveStats(data.role, data.backpack);
  const maxHealth = getRoleMaxHealth(data.role, data.backpack);
  const battleState = normalizeBattleState(data.afk.battle_state);
  const currentHealth = isBattleActive(battleState)
    ? clamp(normalizeNumber(battleState.player.currentHealth), 0, maxHealth)
    : Math.min(maxHealth, normalizeNumber(data.role.current_health));

  return {
    serverTime: Date.now(),
    account: {
      guestToken: data.user.guest_token,
      hasRole: true,
      mode: data.user.account_type || "guest",
      username: data.user.username || null,
      userId: data.user.user_id,
    },
    config: {
      classes: classConfigs,
      levels: levelTable,
      maps: mapConfigs,
      races: raceConfigs,
    },
    role: {
      roleId: data.role.role_id,
      name: data.role.name,
      raceKey: data.role.race_key,
      classKey: data.role.class_key,
      level: data.role.level,
      exp: data.role.exp,
      currentLevelExp: progress.currentLevelExp,
      nextLevelExp: progress.nextLevelExp,
      currentHealth,
      maxHealth,
      gold: data.role.gold,
      aetherCrystal: data.role.aether_crystal,
      avatarSeed: data.role.avatar_seed,
      stats: effectiveStats,
      bodySlotCapacities,
      bodySlots,
    },
    backpack: data.backpack.map((item) => ({
      backpackId: item.backpack_id,
      itemId: item.item_id,
      quantity: item.quantity,
      equipped: item.equipped,
      equippedCount: getBackpackEquippedCount(item),
      equippedSlotGroups: item.equipped_slot_groups || [],
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
      slotUsage: item.slot_usage,
      description: item.description,
      sellPrice: item.sell_price,
      stats: item.stat_json || {},
    })),
    afk: {
      status: data.afk.status,
      mapKey: data.afk.map_key,
      startedAt: toMillis(data.afk.started_at),
      lastSettledAt: toMillis(data.afk.last_settled_at),
      shouldShowOfflineRewardModal: options.shouldShowOfflineRewardModal || false,
      accruedSeconds: data.afk.accrued_seconds,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap,
      pendingReward: {
        seconds: data.afk.accrued_seconds,
        gold: data.afk.pending_gold,
        aetherCrystal: data.afk.pending_aether_crystal,
        exp: data.afk.pending_exp,
      },
      battle: battleState.battleId ? {
        battleId: battleState.battleId,
        active: isBattleActive(battleState),
        status: battleState.status,
        turnCount: battleState.turnCount,
        winner: battleState.winner,
        outcome: battleState.outcome,
        player: {
          actionBar: battleState.player.actionBar,
          currentHealth,
          maxHealth,
          defenseTurns: battleState.player.defenseTurns,
          skillUsesRemaining: battleState.player.skillUsesRemaining,
          stats: battleState.player.stats,
          name: battleState.player.name,
        },
        enemy: {
          key: battleState.enemy.key,
          level: battleState.enemy.level,
          name: battleState.enemy.name,
          summary: battleState.enemy.summary,
          actionBar: battleState.enemyCombatant.actionBar,
          currentHealth: battleState.enemyCombatant.currentHealth,
          maxHealth: battleState.enemyCombatant.maxHealth,
          defenseTurns: battleState.enemyCombatant.defenseTurns,
          skillUsesRemaining: battleState.enemyCombatant.skillUsesRemaining,
          stats: battleState.enemyCombatant.stats,
        },
        logs: battleState.logs,
      } : null,
      estimatedHourlyReward: buildHourlyReward(data.afk.map_key),
      encounterRates: afkEncounterChances,
      recentEncounters: normalizeEncounterLog(data.afk.recent_encounters),
    },
    market: data.market,
  };
}

function buildBootstrapSnapshot(user, market) {
  return {
    account: {
      guestToken: user.guest_token,
      hasRole: false,
      mode: user.account_type || "guest",
      username: user.username || null,
      userId: user.user_id,
    },
    afk: {
      status: "idle",
      mapKey: null,
      startedAt: null,
      lastSettledAt: null,
      shouldShowOfflineRewardModal: false,
      accruedSeconds: 0,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap: null,
      pendingReward: {
        seconds: 0,
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
      },
      battle: null,
      estimatedHourlyReward: {
        seconds: 3600,
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
      },
      encounterRates: afkEncounterChances,
      recentEncounters: [],
    },
    market,
    backpack: [],
    config: {
      classes: classConfigs,
      levels: levelTable,
      maps: mapConfigs,
      races: raceConfigs,
    },
    role: null,
    serverTime: Date.now(),
  };
}

async function getSessionSnapshot(guestToken) {
  await ensureRuntimeGameConfig();
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    return buildBootstrapSnapshot(user, await getMarketSnapshotForRole(null));
  }

  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;
  const simulation = settleAfkState(data, {
    capSeconds: wasOffline ? MAX_OFFLINE_SECONDS : undefined,
    now,
    autoApplyReward: !wasOffline,
  });

  const shouldShowOfflineRewardModal =
    wasOffline &&
    (data.afk.pending_gold > 0 || data.afk.pending_aether_crystal > 0 || data.afk.pending_exp > 0);

  await withTransaction(async (client) => {
    await client.query(`UPDATE "user" SET last_seen_at = NOW() WHERE user_id = $1`, [data.user.user_id]);
    if (didNormalizeRoleHealth || simulation.didMutateRole) {
      await persistRole(client, data.role);
    }
    if (simulation.itemDrops.length > 0) {
      await persistBackpackItemRewards(client, data.role.role_id, simulation.itemDrops);
    }
    await persistAfk(client, data.afk);
    if (simulation.didMutateBackpack) {
      await persistBackpackEquipState(client, data.backpack);
    }
  });

  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal });
}

async function startAfkForGuest(guestToken, mapKey) {
  await ensureRuntimeGameConfig();
  const map = getMapConfig(mapKey);

  if (!map) {
    throw new Error("地图不存在。");
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data, { now, autoApplyReward: true });

  if (data.afk.status === "active") {
    throw new Error("当前已经处于挂机中，请先停止。");
  }

  data.afk.status = "active";
  data.afk.map_key = mapKey;
  data.afk.started_at = new Date(now);
  data.afk.last_settled_at = new Date(now);
  data.afk.battle_state = normalizeBattleState(data.afk.battle_state);

  await withTransaction(async (client) => {
    await persistAfk(client, data.afk);
  });

  return getSessionSnapshot(guestToken);
}

async function stopAfkForGuest(guestToken) {
  await ensureRuntimeGameConfig();
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const simulation = settleAfkState(data, { now, autoApplyReward: true });

  if (data.afk.status === "idle") {
    return buildSnapshot(data);
  }

  if (isBattleActive(data.afk.battle_state)) {
    throw new Error("战斗进行中，暂时不能停止挂机。");
  }

  data.afk.status = "idle";
  data.afk.last_settled_at = new Date(now);
  discardCurrentTaskProgress(data.afk);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth || simulation.didMutateRole) {
      await persistRole(client, data.role);
    }
    if (simulation.itemDrops.length > 0) {
      await persistBackpackItemRewards(client, data.role.role_id, simulation.itemDrops);
    }
    await persistAfk(client, data.afk);
    if (simulation.didMutateBackpack) {
      await persistBackpackEquipState(client, data.backpack);
    }
  });

  return getSessionSnapshot(guestToken);
}

async function claimAfkRewardForGuest(guestToken) {
  await ensureRuntimeGameConfig();
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const simulation = settleAfkState(data, {
    capSeconds: MAX_OFFLINE_SECONDS,
    now,
    autoApplyReward: false,
  });

  if (
    data.afk.pending_gold <= 0 &&
    data.afk.pending_aether_crystal <= 0 &&
    data.afk.pending_exp <= 0
  ) {
    if (didNormalizeRoleHealth || simulation.didMutateRole || simulation.didMutateBackpack || simulation.didMutateAfk) {
      await withTransaction(async (client) => {
        if (didNormalizeRoleHealth || simulation.didMutateRole) {
          await persistRole(client, data.role);
        }
        if (simulation.itemDrops.length > 0) {
          await persistBackpackItemRewards(client, data.role.role_id, simulation.itemDrops);
        }
        await persistAfk(client, data.afk);
        if (simulation.didMutateBackpack) {
          await persistBackpackEquipState(client, data.backpack);
        }
      });
    }
    return buildSnapshot(data);
  }

  const didClaimPendingReward = applyPendingRewardToRole(data.role, data.afk, data.backpack);
  data.afk.pending_gold = 0;
  data.afk.pending_aether_crystal = 0;
  data.afk.pending_exp = 0;
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth || simulation.didMutateRole || didClaimPendingReward) {
      await persistRole(client, data.role);
    }
    if (simulation.itemDrops.length > 0) {
      await persistBackpackItemRewards(client, data.role.role_id, simulation.itemDrops);
    }
    await persistAfk(client, data.afk);
    if (simulation.didMutateBackpack) {
      await persistBackpackEquipState(client, data.backpack);
    }
  });

  return getSessionSnapshot(guestToken);
}

async function dropBackpackItemForGuest(guestToken, backpackId) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要丢弃的物品不存在。");
  }

  await withTransaction(async (client) => {
    const deleted = await deleteBackpackEntry(client, data.role.role_id, normalizedBackpackId);

    if (!deleted) {
      throw new Error("物品丢弃失败，请稍后重试。");
    }
  });

  return getSessionSnapshot(guestToken);
}

async function equipBackpackItemForGuest(guestToken, backpackId) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要装备的物品不存在。");
  }

  allocateEquipmentSlots(data.role, data.backpack, matchedItem);
  sortBackpackRows(data.backpack);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth) {
      await persistRole(client, data.role);
    }
    await persistBackpackEquipState(client, data.backpack);
  });

  return getSessionSnapshot(guestToken);
}

async function unequipBackpackItemForGuest(guestToken, backpackId) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要脱下的物品不存在。");
  }

  removeOneEquippedGroup(matchedItem);
  sortBackpackRows(data.backpack);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth) {
      await persistRole(client, data.role);
    }
    await persistBackpackEquipState(client, data.backpack);
  });

  return getSessionSnapshot(guestToken);
}

async function createMarketListingForGuest(guestToken, backpackId, price, quantity) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";
  const normalizedPrice = normalizeNumber(price);
  const normalizedQuantity = normalizeNumber(quantity);

  if (!normalizedBackpackId) {
    throw new Error("缺少背包物品标识。");
  }

  if (normalizedPrice <= 0) {
    throw new Error("上架价格必须大于 0。");
  }

  if (normalizedQuantity <= 0) {
    throw new Error("上架数量必须大于 0。");
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw new Error("要上架的物品不存在。");
  }

  if (matchedItem.quantity <= (matchedItem.equipped_slot_groups || []).length) {
    throw new Error("这件物品没有可上架的剩余数量。");
  }

  await withTransaction(async (client) => {
    const backpackResult = await client.query(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
          item.slot,
          item.slot_usage,
          item.description,
          item.sell_price,
          item.stat_json
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = $1 AND backpack.backpack_id = $2
        FOR UPDATE
      `,
      [data.role.role_id, normalizedBackpackId],
    );
    const lockedBackpackItem = backpackResult.rows[0];

    if (!lockedBackpackItem) {
      throw new Error("要上架的物品不存在。");
    }

    lockedBackpackItem.equipped_slot_groups = normalizeEquippedSlotGroups(lockedBackpackItem.equipped_slot_groups);
    const sellableQuantity = Math.max(0, lockedBackpackItem.quantity - getBackpackEquippedCount(lockedBackpackItem));

    if (sellableQuantity <= 0) {
      throw new Error("这件物品没有可上架的剩余数量。");
    }

    if (normalizedQuantity > sellableQuantity) {
      throw new Error("上架数量超过了当前可出售数量。");
    }

    if (lockedBackpackItem.quantity <= normalizedQuantity) {
      const deleted = await deleteBackpackEntry(client, data.role.role_id, lockedBackpackItem.backpack_id);

      if (!deleted) {
        throw new Error("上架失败，请稍后重试。");
      }
    } else {
      await client.query(
        `
          UPDATE backpack
          SET quantity = quantity - $3, updated_at = NOW()
          WHERE backpack_id = $1 AND role_id = $2 AND quantity >= $3
        `,
        [lockedBackpackItem.backpack_id, data.role.role_id, normalizedQuantity],
      );
    }

    for (let index = 0; index < normalizedQuantity; index += 1) {
      await client.query(
        `
          INSERT INTO market_listing (
            listing_id,
            seller_role_id,
            item_id,
            category_key,
            price,
            status,
            fee_amount,
            seller_receive_amount,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, 'equipment', $4, 'active', 0, 0, NOW(), NOW())
        `,
        [`listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index}`, data.role.role_id, lockedBackpackItem.item_id, normalizedPrice],
      );
    }
  });

  return getSessionSnapshot(guestToken);
}

async function cancelMarketListingForGuest(guestToken, listingId) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query(
      `
        SELECT listing_id, seller_role_id, item_id, status
        FROM market_listing
        WHERE listing_id = $1
        FOR UPDATE
      `,
      [normalizedListingId],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.seller_role_id !== data.role.role_id) {
      throw new Error("要下架的挂单不存在。");
    }

    if (listing.status !== "active") {
      throw new Error("该挂单当前不能下架。");
    }

    const siblingResult = await client.query(
      `
        SELECT COUNT(*)::INTEGER AS listing_count
        FROM market_listing
        WHERE
          seller_role_id = $1
          AND item_id = $2
          AND price = $3
          AND status = 'active'
      `,
      [data.role.role_id, listing.item_id, listing.price],
    );
    const listingCount = normalizeNumber(siblingResult.rows[0]?.listing_count || 0);

    await client.query(
      `
        UPDATE market_listing
        SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
        WHERE
          seller_role_id = $1
          AND item_id = $2
          AND price = $3
          AND status = 'active'
      `,
      [data.role.role_id, listing.item_id, listing.price],
    );

    await upsertBackpackItemQuantity(client, data.role.role_id, listing.item_id, Math.max(1, listingCount));
  });

  return getSessionSnapshot(guestToken);
}

async function buyMarketListingForGuest(guestToken, listingId) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query(
      `
        SELECT listing_id, seller_role_id, item_id, price, status, created_at
        FROM market_listing
        WHERE listing_id = $1
        FOR UPDATE
      `,
      [normalizedListingId],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.status !== "active") {
      throw new Error("这件商品已经被买走或下架了。");
    }

    if (listing.seller_role_id === data.role.role_id) {
      throw new Error("不能购买自己上架的物品。");
    }

    const cheapestResult = await client.query(
      `
        SELECT listing_id
        FROM market_listing
        WHERE item_id = $1 AND status = 'active'
        ORDER BY price ASC, created_at ASC, listing_id ASC
        LIMIT 1
      `,
      [listing.item_id],
    );

    if (cheapestResult.rows[0]?.listing_id !== listing.listing_id) {
      throw new Error("当前只能购买这件商品中最便宜的那一件。");
    }

    const [buyerRoleResult, sellerRoleResult, sellerAfkResult] = await Promise.all([
      client.query(`SELECT role_id, gold, level, exp, aether_crystal, current_health FROM "role" WHERE role_id = $1 FOR UPDATE`, [data.role.role_id]),
      client.query(`SELECT role_id, gold, level, exp, aether_crystal, current_health FROM "role" WHERE role_id = $1 FOR UPDATE`, [listing.seller_role_id]),
      client.query(
        `
          SELECT
            afk_id,
            role_id,
            status,
            map_key,
            started_at,
            last_settled_at,
            pending_gold,
            pending_aether_crystal,
            pending_exp,
            accrued_seconds,
            recent_encounters
          FROM afk
          WHERE role_id = $1
          FOR UPDATE
        `,
        [listing.seller_role_id],
      ),
    ]);

    const buyerRole = buyerRoleResult.rows[0];
    const sellerRole = sellerRoleResult.rows[0];
    const sellerAfk = sellerAfkResult.rows[0];

    if (!buyerRole || !sellerRole || !sellerAfk) {
      throw new Error("交易角色不存在，请稍后重试。");
    }

    if (buyerRole.gold < listing.price) {
      throw new Error("金币不足，无法购买这件商品。");
    }

    const { feeAmount, sellerReceiveAmount } = calculateMarketFee(listing.price);

    await client.query(`UPDATE "role" SET gold = gold - $2, updated_at = NOW() WHERE role_id = $1`, [buyerRole.role_id, listing.price]);
    sellerAfk.pending_gold += sellerReceiveAmount;
    await persistAfk(client, sellerAfk);
    await upsertBackpackItemQuantity(client, buyerRole.role_id, listing.item_id, 1);
    await client.query(
      `
        UPDATE market_listing
        SET
          status = 'sold',
          buyer_role_id = $2,
          sold_price = $3,
          fee_amount = $4,
          seller_receive_amount = $5,
          seller_notice_seen = FALSE,
          sold_at = NOW(),
          updated_at = NOW()
        WHERE listing_id = $1 AND status = 'active'
      `,
      [listing.listing_id, buyerRole.role_id, listing.price, feeAmount, sellerReceiveAmount],
    );
  });

  return getSessionSnapshot(guestToken);
}

async function dismissMarketSoldNotificationForGuest(guestToken, listingId) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query(
      `
        SELECT listing_id, seller_role_id, item_id, price, status
        FROM market_listing
        WHERE listing_id = $1
        FOR UPDATE
      `,
      [normalizedListingId],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.seller_role_id !== data.role.role_id || listing.status !== "sold") {
      throw new Error("要处理的出售通知不存在。");
    }

    await client.query(
      `
        UPDATE market_listing
        SET
          seller_notice_seen = TRUE,
          updated_at = NOW()
        WHERE
          seller_role_id = $1
          AND item_id = $2
          AND price = $3
          AND status = 'sold'
          AND seller_notice_seen = FALSE
      `,
      [data.role.role_id, listing.item_id, listing.price],
    );
  });

  return getSessionSnapshot(guestToken);
}

module.exports = {
  AFK_TASK_SECONDS,
  buyMarketListingForGuest,
  cancelMarketListingForGuest,
  dismissMarketSoldNotificationForGuest,
  getSessionSnapshot,
  createMarketListingForGuest,
  startAfkForGuest,
  stopAfkForGuest,
  claimAfkRewardForGuest,
  dropBackpackItemForGuest,
  equipBackpackItemForGuest,
  unequipBackpackItemForGuest,
};
