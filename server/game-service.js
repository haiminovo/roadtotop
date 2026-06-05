const { query, withTransaction } = require("./db");
const {
  calculateMarketFee: calculateSharedMarketFee,
  normalizeNonNegativeInteger,
} = require("../shared/domain/economy");
const {
  DEFAULT_CLASS_CONFIGS,
  DEFAULT_ITEM_CATALOG,
  DEFAULT_LEVEL_TABLE,
  DEFAULT_MAP_CONFIGS,
  DEFAULT_RACE_CONFIGS,
  DEFAULT_SKILL_TEMPLATES,
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
const MARKET_CATEGORY_OPTIONS = [
  { key: "equipment", label: "装备" },
  { key: "skill_book", label: "技能书" },
  { key: "material", label: "材料" },
];
const PLAYER_SKILL_SLOT_BASE = 2;
const PLAYER_SKILL_SLOT_MAX = 6;
const PLAYER_BATTLE_SKILL_USE_BASE = 1;
const PLAYER_BATTLE_SKILL_USE_PER_INTELLIGENCE = 4;
const PLAYER_BATTLE_SKILL_USE_MAX_BONUS = 5;
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
let battleEnemyTemplatesByMap = {};
let itemSeeds = DEFAULT_ITEM_CATALOG;
let itemSeedById = new Map(itemSeeds.map((item) => [item.itemId, item]));
let raceConfigs = DEFAULT_RACE_CONFIGS;
let classConfigs = DEFAULT_CLASS_CONFIGS;
let mapConfigs = DEFAULT_MAP_CONFIGS;
let activityConfigs = [];
let skillTemplates = DEFAULT_SKILL_TEMPLATES;
let skillTemplateByKey = new Map(skillTemplates.map((skill) => [skill.key, skill]));
let eventRules = [];

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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
  battleEnemyTemplatesByMap = config.battleEnemyTemplatesByMap || {};
  itemSeeds = config.itemCatalog;
  itemSeedById = config.itemSeedById;
  raceConfigs = config.raceConfigs;
  classConfigs = config.classConfigs;
  mapConfigs = config.mapConfigs;
  activityConfigs = Array.isArray(config.activityConfigs) ? config.activityConfigs : [];
  eventRules = Array.isArray(config.eventRules) ? config.eventRules : [];
  skillTemplates = Array.isArray(config.skillTemplates) ? config.skillTemplates : DEFAULT_SKILL_TEMPLATES;
  skillTemplateByKey = config.skillTemplateByKey || new Map(skillTemplates.map((skill) => [skill.key, skill]));
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
  return normalizeNonNegativeInteger(value);
}

function normalizeSignedNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
}

function normalizeItemType(value) {
  return value === "skill_book" || value === "material" || value === "equipment"
    ? value
    : "equipment";
}

function normalizeSkillKey(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getSkillQualityRank(quality) {
  return {
    white: 1,
    green: 2,
    blue: 3,
    purple: 4,
    orange: 5,
  }[quality] || 0;
}

function normalizeSkillLevel(level, maxLevel = 10) {
  return clamp(normalizeNumber(level) || 1, 1, Math.max(1, normalizeNumber(maxLevel) || 10));
}

function getSkillLevelBonus(level) {
  return Math.max(0, normalizeSkillLevel(level) - 1);
}

function calculatePlayerSkillSlotCount(intelligence) {
  const bonus = Math.floor(normalizeNumber(intelligence) / 6);
  return clamp(PLAYER_SKILL_SLOT_BASE + bonus, PLAYER_SKILL_SLOT_BASE, PLAYER_SKILL_SLOT_MAX);
}

function calculateBattleSkillUseLimit(intelligence) {
  const bonus = Math.min(
    PLAYER_BATTLE_SKILL_USE_MAX_BONUS,
    Math.floor(normalizeNumber(intelligence) / PLAYER_BATTLE_SKILL_USE_PER_INTELLIGENCE),
  );
  return PLAYER_BATTLE_SKILL_USE_BASE + bonus;
}

function getSkillDefinition(skillKey) {
  return skillTemplateByKey.get(skillKey) || null;
}

function buildDefaultPlayerSkillState() {
  return {
    acquiredBooks: [],
    equippedSkillKeys: [],
    learnedSkills: [],
  };
}

function normalizePlayerSkillState(value, role = null, effectiveStats = null) {
  const raw = value && typeof value === "object" ? value : {};
  const fallback = buildDefaultPlayerSkillState(role);
  const learnedSkillsRaw = Array.isArray(raw.learnedSkills) ? raw.learnedSkills : fallback.learnedSkills;
  const acquiredBooksRaw = Array.isArray(raw.acquiredBooks) ? raw.acquiredBooks : fallback.acquiredBooks;

  const learnedSkills = learnedSkillsRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || typeof entry.skillKey !== "string") {
        return null;
      }

      const definition = getSkillDefinition(entry.skillKey);

      if (!definition) {
        return null;
      }

      return {
        acquisitionHint: typeof entry.acquisitionHint === "string" && entry.acquisitionHint.trim().length > 0
          ? entry.acquisitionHint
          : definition.acquisitionHint,
        learnedAt: normalizeNumber(entry.learnedAt) || Date.now(),
        level: normalizeSkillLevel(entry.level, definition.maxLevel),
        quality: ["white", "green", "blue", "purple", "orange"].includes(entry.quality)
          ? entry.quality
          : definition.quality,
        skillKey: definition.key,
      };
    })
    .filter(Boolean);

  const learnedSkillKeySet = new Set(learnedSkills.map((entry) => entry.skillKey));

  const acquiredBooks = acquiredBooksRaw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || typeof entry.skillKey !== "string") {
        return null;
      }

      const definition = getSkillDefinition(entry.skillKey);

      if (!definition) {
        return null;
      }

      return {
        acquiredAt: normalizeNumber(entry.acquiredAt) || Date.now(),
        acquisitionHint: typeof entry.acquisitionHint === "string" && entry.acquisitionHint.trim().length > 0
          ? entry.acquisitionHint
          : definition.acquisitionHint,
        quality: ["white", "green", "blue", "purple", "orange"].includes(entry.quality)
          ? entry.quality
          : definition.quality,
        skillKey: definition.key,
      };
    })
    .filter(Boolean);

  const equippedSkillKeysRaw = Array.isArray(raw.equippedSkillKeys) ? raw.equippedSkillKeys : fallback.equippedSkillKeys;
  const stats = effectiveStats || getRoleEffectiveStats(role || {}, []);
  const skillSlotCount = calculatePlayerSkillSlotCount(stats.intelligence);
  const equippedSkillKeys = [];

  equippedSkillKeysRaw.forEach((skillKey) => {
    if (
      typeof skillKey === "string"
      && learnedSkillKeySet.has(skillKey)
      && getSkillDefinition(skillKey)
      && !equippedSkillKeys.includes(skillKey)
      && equippedSkillKeys.length < skillSlotCount
    ) {
      equippedSkillKeys.push(skillKey);
    }
  });

  learnedSkills.sort((left, right) => {
    const qualityDelta = getSkillQualityRank(right.quality) - getSkillQualityRank(left.quality);

    if (qualityDelta !== 0) {
      return qualityDelta;
    }

    return right.level - left.level;
  });

  acquiredBooks.sort((left, right) => right.acquiredAt - left.acquiredAt);

  return {
    acquiredBooks,
    equippedSkillKeys,
    learnedSkills,
  };
}

function buildPlayerSkillCollection(role, backpack = []) {
  const stats = getRoleEffectiveStats(role, backpack);
  const normalizedState = normalizePlayerSkillState(role.skill_state, role, stats);
  const learnedSkillMap = new Map(normalizedState.learnedSkills.map((entry) => [entry.skillKey, entry]));
  const skillSlotCount = calculatePlayerSkillSlotCount(stats.intelligence);
  const battleSkillUseLimit = calculateBattleSkillUseLimit(stats.intelligence);
  const equippedSkills = normalizedState.equippedSkillKeys
    .map((skillKey) => {
      const definition = getSkillDefinition(skillKey);
      const learned = learnedSkillMap.get(skillKey);

      if (!definition || !learned) {
        return null;
      }

      return {
        ...definition,
        acquisitionHint: learned.acquisitionHint,
        level: learned.level,
        quality: learned.quality,
      };
    })
    .filter(Boolean);

  const learnedSkills = normalizedState.learnedSkills
    .map((entry) => {
      const definition = getSkillDefinition(entry.skillKey);

      if (!definition) {
        return null;
      }

      return {
        ...definition,
        acquisitionHint: entry.acquisitionHint,
        equipped: normalizedState.equippedSkillKeys.includes(entry.skillKey),
        learnedAt: entry.learnedAt,
        level: entry.level,
        quality: entry.quality,
      };
    })
    .filter(Boolean);

  const skillBooks = normalizedState.acquiredBooks
    .map((entry) => {
      const definition = getSkillDefinition(entry.skillKey);

      if (!definition) {
        return null;
      }

      return {
        acquisitionHint: entry.acquisitionHint,
        acquiredAt: entry.acquiredAt,
        description: definition.description,
        iconText: definition.iconText,
        quality: entry.quality,
        skillKey: definition.key,
        skillName: definition.name,
      };
    })
    .filter(Boolean);

  role.skill_state = {
    acquiredBooks: normalizedState.acquiredBooks,
    equippedSkillKeys: equippedSkills.map((skill) => skill.key),
    learnedSkills: normalizedState.learnedSkills,
  };

  return {
    battleSkillUseLimit,
    equippedSkills,
    learnedSkills,
    skillBooks,
    skillSlotCount,
    skillSlotsRemaining: Math.max(0, skillSlotCount - equippedSkills.length),
  };
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
  return calculateSharedMarketFee(price, MARKET_FEE_RATE_PERCENT);
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

function buildMarketSnapshot(roleId, activeListings, ownListings, buyOrders) {
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
    buyOrders: (buyOrders || []).map((order) => ({
      orderId: order.order_id,
      itemId: order.item_id,
      categoryKey: order.category_key,
      price: normalizeNumber(order.price),
      quantity: normalizeNumber(order.quantity),
      filledQuantity: normalizeNumber(order.filled_quantity || 0),
      buyerName: order.buyer_name || "未知",
      createdAt: toMillis(order.created_at) || Date.now(),
      isOwnOrder: roleId === order.buyer_role_id,
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

function isEquipmentItem(backpackRow) {
  return normalizeItemType(backpackRow?.item_type) === "equipment";
}

function getRoleEffectiveStats(role, backpack = []) {
  const nextStats = {
    strength: normalizeNumber(role.strength),
    agility: normalizeNumber(role.agility),
    intelligence: normalizeNumber(role.intelligence),
    vitality: normalizeNumber(role.vitality),
  };

  backpack.forEach((item) => {
    if (!isEquipmentItem(item)) {
      return;
    }

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

function addLearnedSkillFromBook(role, skillKey, options = {}) {
  const definition = getSkillDefinition(skillKey);

  if (!definition) {
    throw createServiceError("技能书对应的技能不存在，无法学习。", 409);
  }

  const now = options.now || Date.now();
  const sourceHint = typeof options.acquisitionHint === "string" && options.acquisitionHint.trim().length > 0
    ? options.acquisitionHint.trim()
    : `通过技能书 ${options.bookName || definition.name} 学会。`;
  const normalizedState = normalizePlayerSkillState(role.skill_state, role);
  const existing = normalizedState.learnedSkills.find((entry) => entry.skillKey === definition.key);

  if (existing) {
    throw createServiceError("该技能已经学会，无需重复学习。", 409);
  }

  normalizedState.learnedSkills.push({
    skillKey: definition.key,
    level: 1,
    quality: definition.quality,
    acquisitionHint: sourceHint,
    learnedAt: now,
  });

  normalizedState.acquiredBooks.push({
    skillKey: definition.key,
    quality: definition.quality,
    acquisitionHint: sourceHint,
    acquiredAt: now,
  });

  role.skill_state = normalizePlayerSkillState(normalizedState, role);
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
  if (!isEquipmentItem(item)) {
    throw createServiceError("只有装备类型物品才能穿戴。", 409);
  }

  if (item.quantity <= getBackpackEquippedCount(item)) {
    throw createServiceError("这件物品已经没有可装备的数量了。", 409);
  }

  const capacities = getBodySlotCapacities(role.race_key);
  const candidateSlotKeys = buildAvailableBodySlotKeys(capacities, item.slot);

  if (candidateSlotKeys.length < item.slot_usage) {
    throw createServiceError("当前种族没有足够的对应肢体槽位。", 409);
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
    throw createServiceError("对应肢体部位已经被占满，无法继续装备。", 409);
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
  if (!isEquipmentItem(backpackItem)) {
    throw createServiceError("只有装备类型物品才能卸下。", 409);
  }

  if (!backpackItem.equipped_slot_groups || backpackItem.equipped_slot_groups.length === 0) {
    throw createServiceError("这件物品当前没有处于装备状态。", 409);
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
      item_type: itemDrop.itemType,
      skill_key: itemDrop.skillKey,
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

function buildEncounterRewardFromItemDrops(itemDrops = []) {
  if (!Array.isArray(itemDrops) || itemDrops.length === 0) {
    return [];
  }

  return itemDrops
    .map((drop) => {
      if (!drop || typeof drop !== "object" || typeof drop.itemId !== "string") {
        return null;
      }

      const quantity = normalizeNumber(drop.quantity);

      if (quantity <= 0) {
        return null;
      }

      return {
        itemId: drop.itemId,
        quantity,
        name: typeof drop.name === "string" ? drop.name : undefined,
        rarity: ["white", "green", "blue", "purple", "orange"].includes(drop.rarity)
          ? drop.rarity
          : undefined,
      };
    })
    .filter(Boolean);
}

function prependRecentEncounter(afk, encounter) {
  if (!afk || typeof afk !== "object" || !encounter || typeof encounter !== "object") {
    return false;
  }

  const normalizedEncounter = normalizeEncounterLog([encounter])[0];

  if (!normalizedEncounter) {
    return false;
  }

  afk.recent_encounters = [
    normalizedEncounter,
    ...normalizeEncounterLog(afk.recent_encounters),
  ].slice(0, MAX_RECENT_ENCOUNTERS);

  return true;
}

function getSortedEventRulesByTrigger(triggerType) {
  return eventRules
    .filter((rule) => rule?.enabled !== false && rule?.trigger?.type === triggerType)
    .slice()
    .sort((left, right) => normalizeSignedNumber(left?.priority) - normalizeSignedNumber(right?.priority));
}

function ruleMatchesTrigger(rule, context = {}) {
  const trigger = rule?.trigger || {};
  if (trigger.type === "afk_tick") {
    if (!Array.isArray(trigger.activityKeys) || trigger.activityKeys.length !== 1) {
      return false;
    }
    if (!Array.isArray(trigger.mapKeys) || trigger.mapKeys.length !== 1) {
      return false;
    }
  }

  if (Array.isArray(trigger.mapKeys) && trigger.mapKeys.length > 0) {
    if (!context.mapKey || !trigger.mapKeys.includes(context.mapKey)) {
      return false;
    }
  }

  if (Array.isArray(trigger.activityKeys) && trigger.activityKeys.length > 0) {
    if (!context.activityKey || !trigger.activityKeys.includes(context.activityKey)) {
      return false;
    }
  }

  if (Array.isArray(trigger.enemyKeys) && trigger.enemyKeys.length > 0) {
    if (!context.enemyKey || !trigger.enemyKeys.includes(context.enemyKey)) {
      return false;
    }
  }

  return true;
}

function toBackpackItemDrop(itemSeed, quantity) {
  return {
    itemId: itemSeed.itemId,
    quantity,
    name: itemSeed.name,
    rarity: itemSeed.rarity,
    itemType: normalizeItemType(itemSeed.itemType),
    skillKey: normalizeSkillKey(itemSeed.skillKey),
    slot: itemSeed.slot,
    slotUsage: itemSeed.slotUsage,
    description: itemSeed.description,
    sellPrice: itemSeed.sellPrice,
    stats: itemSeed.stats,
  };
}

function applyRuleAction(action, accumulator) {
  const actionChance = action?.chance === undefined ? 1 : Number(action.chance);
  if (!Number.isFinite(actionChance) || actionChance <= 0 || Math.random() >= actionChance) {
    return;
  }

  switch (action.type) {
    case "grant_gold":
      accumulator.gold += normalizeNumber(action.amount);
      break;
    case "grant_aether":
      accumulator.aetherCrystal += normalizeNumber(action.amount);
      break;
    case "grant_exp":
      accumulator.exp += normalizeNumber(action.amount);
      break;
    case "adjust_health":
      accumulator.healthDelta += normalizeSignedNumber(action.amount);
      break;
    case "grant_item": {
      if (typeof action.itemId !== "string" || !action.itemId.trim()) {
        return;
      }
      const itemSeed = itemSeedById.get(action.itemId);
      if (!itemSeed) {
        return;
      }
      let quantity = 0;
      if (Number.isFinite(Number(action.quantity))) {
        quantity = Math.max(1, normalizeNumber(action.quantity));
      } else {
        const min = Math.max(1, normalizeNumber(action.min || 1));
        const max = Math.max(min, normalizeNumber(action.max || min));
        quantity = min + Math.floor(Math.random() * (max - min + 1));
      }
      if (quantity <= 0) {
        return;
      }
      accumulator.itemDrops.push(toBackpackItemDrop(itemSeed, quantity));
      break;
    }
    default:
      break;
  }
}

function evaluateEventRules(triggerType, context = {}) {
  const matches = [];
  const rules = getSortedEventRulesByTrigger(triggerType);

  rules.forEach((rule) => {
    if (!ruleMatchesTrigger(rule, context)) {
      return;
    }

    const chance = Number(rule.chance);
    if (!Number.isFinite(chance) || chance <= 0 || Math.random() >= chance) {
      return;
    }

    const reward = {
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
      healthDelta: 0,
      itemDrops: [],
    };

    (Array.isArray(rule.actions) ? rule.actions : []).forEach((action) => {
      if (!action || typeof action !== "object") {
        return;
      }
      applyRuleAction(action, reward);
    });

    matches.push({
      rule,
      reward,
    });
  });

  return matches;
}

function getEncounterRatesFromEventRules(context = {}) {
  const rates = {
    common: 0,
    rare: 0,
    legendary: 0,
  };

  eventRules.forEach((rule) => {
    if (rule?.enabled === false || rule?.trigger?.type !== "afk_tick") {
      return;
    }
    if (!ruleMatchesTrigger(rule, context)) {
      return;
    }
    const tier = rule?.encounter?.tier;
    if (tier !== "common" && tier !== "rare" && tier !== "legendary") {
      return;
    }
    const chance = Number(rule.chance);
    if (!Number.isFinite(chance) || chance <= 0) {
      return;
    }
    rates[tier] += chance;
  });

  return rates;
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
  return Math.max(1, Math.round(normalizeNumber(strength) * 2.8));
}

function calculateDamageReduction(vitality) {
  return clamp(normalizeNumber(vitality) / 60, 0, 0.45);
}

function calculateSecondaryStats(stats) {
  const strength = Math.max(1, normalizeNumber(stats?.strength));
  const agility = Math.max(1, normalizeNumber(stats?.agility));
  const intelligence = Math.max(1, normalizeNumber(stats?.intelligence));
  const vitality = Math.max(1, normalizeNumber(stats?.vitality));

  return {
    critChance: clamp(0.04 + agility * 0.004 + strength * 0.001, 0.04, 0.42),
    critDamage: clamp(1.3 + strength * 0.012 + intelligence * 0.005, 1.3, 2.35),
    dodgeChance: clamp(0.01 + agility * 0.0028 + intelligence * 0.0008, 0.01, 0.2),
    blockChance: clamp(0.015 + vitality * 0.0018 + strength * 0.0008, 0.015, 0.15),
    blockDamageReduction: clamp(0.08 + vitality * 0.0025 + strength * 0.0012, 0.08, 0.28),
    healthRegenRate: clamp(0.0015 + vitality * 0.0002 + intelligence * 0.0001, 0, 0.012),
  };
}

function summarizeBattleEffect(effect) {
  if (!effect) {
    return "";
  }

  const amount = Number(effect.magnitude) || 0;

  switch (effect.effectType) {
    case "attack_up":
      return `攻击提升 ${Math.round(amount * 100)}%`;
    case "attack_down":
      return `攻击降低 ${Math.round(amount * 100)}%`;
    case "defense_up":
      return `防御提升 ${Math.round(amount * 100)}%`;
    case "defense_down":
      return `防御降低 ${Math.round(amount * 100)}%`;
    case "damage_over_time":
      return `持续掉血 ${Math.round(amount * 100)}%`;
    case "heal_over_time":
      return `持续回血 ${Math.round(amount * 100)}%`;
    case "intelligence_up":
      return `智力提升 ${normalizeSignedNumber(amount)}`;
    case "intelligence_down":
      return `智力降低 ${normalizeSignedNumber(amount)}`;
    case "vitality_up":
      return `体质提升 ${normalizeSignedNumber(amount)}`;
    case "vitality_down":
      return `体质降低 ${normalizeSignedNumber(amount)}`;
    case "agility_up":
      return `敏捷提升 ${normalizeSignedNumber(amount)}`;
    case "agility_down":
      return `敏捷降低 ${normalizeSignedNumber(amount)}`;
    case "interrupt_cast":
      return "打断读条";
    default:
      return effect.name || "状态效果";
  }
}

function normalizeBattleEffects(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      return {
        key: typeof entry.key === "string" ? entry.key : `effect-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceSkillKey: typeof entry.sourceSkillKey === "string" ? entry.sourceSkillKey : "",
        sourceSkillName: typeof entry.sourceSkillName === "string" ? entry.sourceSkillName : "",
        name: typeof entry.name === "string" ? entry.name : "状态",
        description: typeof entry.description === "string" ? entry.description : "",
        effectType: typeof entry.effectType === "string" ? entry.effectType : "attack_up",
        target: typeof entry.target === "string" ? entry.target : "enemy",
        magnitude: Number(entry.magnitude) || 0,
        remainingTurns: Math.max(0, normalizeNumber(entry.remainingTurns)),
        durationTurns: Math.max(1, normalizeNumber(entry.durationTurns) || 1),
        summary: typeof entry.summary === "string" ? entry.summary : "",
      };
    })
    .filter(Boolean);
}

function getCombatantStatModifiers(combatant) {
  const modifiers = {
    strengthFlat: 0,
    agilityFlat: 0,
    intelligenceFlat: 0,
    vitalityFlat: 0,
    attackRate: 0,
    defenseRate: 0,
  };

  for (const effect of combatant.activeEffects || []) {
    const magnitude = Number(effect.magnitude) || 0;

    switch (effect.effectType) {
      case "attack_up":
        modifiers.attackRate += magnitude;
        break;
      case "attack_down":
        modifiers.attackRate -= magnitude;
        break;
      case "defense_up":
        modifiers.defenseRate += magnitude;
        break;
      case "defense_down":
        modifiers.defenseRate -= magnitude;
        break;
      case "agility_up":
        modifiers.agilityFlat += magnitude;
        break;
      case "agility_down":
        modifiers.agilityFlat -= magnitude;
        break;
      case "intelligence_up":
        modifiers.intelligenceFlat += magnitude;
        break;
      case "intelligence_down":
        modifiers.intelligenceFlat -= magnitude;
        break;
      case "vitality_up":
        modifiers.vitalityFlat += magnitude;
        break;
      case "vitality_down":
        modifiers.vitalityFlat -= magnitude;
        break;
      default:
        break;
    }
  }

  return modifiers;
}

function getCombatantEffectiveStats(combatant) {
  const modifiers = getCombatantStatModifiers(combatant);
  const baseStats = {
    strength: Math.max(1, normalizeNumber(combatant.stats.strength) + normalizeSignedNumber(modifiers.strengthFlat)),
    agility: Math.max(1, normalizeNumber(combatant.stats.agility) + normalizeSignedNumber(modifiers.agilityFlat)),
    intelligence: Math.max(1, normalizeNumber(combatant.stats.intelligence) + normalizeSignedNumber(modifiers.intelligenceFlat)),
    vitality: Math.max(1, normalizeNumber(combatant.stats.vitality) + normalizeSignedNumber(modifiers.vitalityFlat)),
  };

  return {
    ...baseStats,
    attackRate: modifiers.attackRate,
    defenseRate: modifiers.defenseRate,
    secondaryStats: calculateSecondaryStats(baseStats),
  };
}

function applySkillEffects(battleState, actor, defender, skill, timestamp) {
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];

  effects.forEach((effectTemplate, index) => {
    if (effectTemplate?.effectType === "interrupt_cast") {
      return;
    }

    const target = effectTemplate.target === "self" || effectTemplate.target === "ally"
      ? actor
      : defender;
    const effect = {
      key: `${skill.key}-${effectTemplate.key}-${timestamp}-${index}`,
      sourceSkillKey: skill.key,
      sourceSkillName: skill.name,
      name: effectTemplate.name,
      description: effectTemplate.description || "",
      effectType: effectTemplate.effectType,
      target: effectTemplate.target,
      magnitude: Number(effectTemplate.magnitude) || 0,
      remainingTurns: Math.max(1, normalizeNumber(effectTemplate.durationTurns) || 1),
      durationTurns: Math.max(1, normalizeNumber(effectTemplate.durationTurns) || 1),
      summary: summarizeBattleEffect(effectTemplate),
    };

    target.activeEffects = [...(target.activeEffects || []), effect];
    addBattleLog(
      battleState,
      `${target.name} 获得状态【${effect.name}】(${effect.summary})，持续 ${effect.durationTurns} 回合。`,
      "effect",
      timestamp,
    );
  });
}

function applyInstantSkillEffects(battleState, actor, defender, skill, timestamp) {
  const effects = Array.isArray(skill?.effects) ? skill.effects : [];
  let didInterrupt = false;

  effects.forEach((effectTemplate) => {
    if (effectTemplate?.effectType !== "interrupt_cast") {
      return;
    }

    const target = effectTemplate.target === "self" || effectTemplate.target === "ally"
      ? actor
      : defender;
    const currentActionBar = normalizeNumber(target.actionBar);

    if (currentActionBar <= 0) {
      return;
    }

    target.actionBar = 0;
    didInterrupt = true;
    addBattleLog(
      battleState,
      `${actor.name} 的【${skill.name}】打断了 ${target.name} 的读条！`,
      "interrupt",
      timestamp,
    );
  });

  return {
    didInterrupt,
  };
}

function tickCombatantEffects(battleState, combatant, timestamp) {
  const effectiveStats = getCombatantEffectiveStats(combatant);
  const passiveRegen = Math.max(0, Number(effectiveStats.secondaryStats.healthRegenRate) || 0);

  if (passiveRegen > 0 && combatant.currentHealth < combatant.maxHealth) {
    const healAmount = Math.max(1, Math.round(combatant.maxHealth * passiveRegen));
    const previousHealth = combatant.currentHealth;
    combatant.currentHealth = Math.min(combatant.maxHealth, combatant.currentHealth + healAmount);
    const actualHeal = Math.max(0, combatant.currentHealth - previousHealth);

    if (actualHeal > 0) {
      addBattleLog(
        battleState,
        `${combatant.name} 触发生命回复，恢复 ${actualHeal} 点生命。`,
        "regen",
        timestamp,
      );
    }
  }

  if (!Array.isArray(combatant.activeEffects) || combatant.activeEffects.length === 0) {
    return;
  }

  combatant.activeEffects.forEach((effect) => {
    const magnitude = Number(effect.magnitude) || 0;

    if (effect.effectType === "damage_over_time") {
      const damage = Math.max(1, Math.round(effectiveStats.vitality * magnitude));
      combatant.currentHealth = Math.max(0, combatant.currentHealth - damage);
      addBattleLog(battleState, `${combatant.name} 受到【${effect.name}】影响，损失 ${damage} 点生命。`, "dot", timestamp);
    }

    if (effect.effectType === "heal_over_time") {
      const heal = Math.max(1, Math.round(effectiveStats.vitality * magnitude));
      combatant.currentHealth = Math.min(combatant.maxHealth, combatant.currentHealth + heal);
      addBattleLog(battleState, `${combatant.name} 受到【${effect.name}】影响，恢复 ${heal} 点生命。`, "hot", timestamp);
    }
  });

  const remainingEffects = [];

  combatant.activeEffects.forEach((effect) => {
    const nextTurns = Math.max(0, normalizeNumber(effect.remainingTurns) - 1);

    if (nextTurns > 0) {
      remainingEffects.push({
        ...effect,
        remainingTurns: nextTurns,
      });
      return;
    }

    addBattleLog(battleState, `${combatant.name} 的状态【${effect.name}】已消失。`, "effect-expire", timestamp);
  });

  combatant.activeEffects = remainingEffects;
}

function getSkillBaseUsesByCategory(category) {
  if (category === "spell") {
    return 2;
  }

  return 1;
}

function getSkillBaseUses(skill) {
  return getSkillBaseUsesByCategory(skill?.category);
}

function summarizeSkillUses(skills) {
  return skills.reduce((summary, skill) => {
    if (skill.category === "guard") {
      summary.guard += normalizeNumber(skill.usesRemaining);
    }

    if (skill.category === "spell") {
      summary.spell += normalizeNumber(skill.usesRemaining);
    }

    return summary;
  }, { guard: 0, spell: 0 });
}

function pickRandomEntries(entries, count) {
  const pool = Array.isArray(entries) ? [...entries] : [];
  const picks = [];
  const targetCount = Math.max(0, normalizeNumber(count));

  while (pool.length > 0 && picks.length < targetCount) {
    const index = Math.floor(Math.random() * pool.length);
    picks.push(pool[index]);
    pool.splice(index, 1);
  }

  return picks;
}

function buildEnemySkillState(skillDefinition, enemy, maxUsesOverride = null) {
  return {
    ...skillDefinition,
    level: Math.max(1, Math.ceil(normalizeNumber(enemy.level) / (skillDefinition.category === "guard" ? 4 : 3))),
    maxUses: maxUsesOverride !== null ? normalizeNumber(maxUsesOverride) : normalizeNumber(skillDefinition.maxUses || getSkillBaseUses(skillDefinition)),
    source: "enemy",
  };
}

function buildEnemySkillLoadout(enemy) {
  const enemySkillTemplates = skillTemplates.filter(
    (skill) => skill && (skill.category === "guard" || skill.category === "spell"),
  );
  const poolByCategory = {
    guard: enemySkillTemplates.filter((skill) => skill.category === "guard"),
    spell: enemySkillTemplates.filter((skill) => skill.category === "spell"),
  };
  const skillCaps = {
    guard: normalizeNumber(enemy.skillCaps?.guard),
    spell: normalizeNumber(enemy.skillCaps?.spell),
  };
  const skills = [];
  const selectedKeys = new Set();
  const fixedSkillKeys = Array.isArray(enemy.fixedSkillKeys)
    ? enemy.fixedSkillKeys.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const fallbackFixedSkillKeys = [];

  if (skillCaps.guard > 0) {
    fallbackFixedSkillKeys.push("enemy-brace");
  } else if (skillCaps.spell > 0) {
    fallbackFixedSkillKeys.push("enemy-chaos-spell");
  }

  const resolvedFixedSkillKeys = fixedSkillKeys.length > 0 ? fixedSkillKeys : fallbackFixedSkillKeys;
  const usedSlotsByCategory = { guard: 0, spell: 0 };

  resolvedFixedSkillKeys.forEach((skillKey) => {
    const skillDefinition = getSkillDefinition(skillKey);

    if (!skillDefinition || selectedKeys.has(skillDefinition.key)) {
      return;
    }

    if (skillDefinition.category !== "guard" && skillDefinition.category !== "spell") {
      return;
    }

    if (usedSlotsByCategory[skillDefinition.category] >= skillCaps[skillDefinition.category]) {
      return;
    }

    skills.push(buildEnemySkillState(skillDefinition, enemy));
    selectedKeys.add(skillDefinition.key);
    usedSlotsByCategory[skillDefinition.category] += 1;
  });

  (["guard", "spell"]).forEach((categoryKey) => {
    const category = categoryKey;
    const remainingSlots = Math.max(0, skillCaps[category] - usedSlotsByCategory[category]);

    if (remainingSlots <= 0) {
      return;
    }

    const randomPool = poolByCategory[category].filter((skill) => !selectedKeys.has(skill.key));
    const randomSkills = pickRandomEntries(randomPool, remainingSlots);

    randomSkills.forEach((skillDefinition) => {
      skills.push(buildEnemySkillState(skillDefinition, enemy));
      selectedKeys.add(skillDefinition.key);
      usedSlotsByCategory[category] += 1;
    });
  });

  return skills;
}

function buildBattleSkills(skills, stats, side) {
  return skills.map((skill) => {
    const levelBonus = getSkillLevelBonus(skill.level);
    const maxUses = normalizeNumber(skill.maxUses || getSkillBaseUses(skill));
    const damageMultiplier = Number(skill.damageMultiplier) || 0;
    const levelDamageGrowth = Number(skill.levelDamageGrowth) || 0;
    const healRatio = Number(skill.healRatio) || 0;
    const levelHealGrowth = Number(skill.levelHealGrowth) || 0;
    const guardRatio = Number(skill.guardRatio) || 0;
    const levelGuardGrowth = Number(skill.levelGuardGrowth) || 0;
    const damage = skill.category === "spell"
      ? Math.max(1, Math.round(stats.intelligence * (damageMultiplier + levelBonus * levelDamageGrowth) * 1.35))
      : skill.category === "attack"
        ? Math.max(1, Math.round(stats.strength * (damageMultiplier + levelBonus * levelDamageGrowth) * 1.35))
        : 0;
    const heal = skill.category === "guard"
      ? Math.max(
        side === "player" ? 10 : 8,
        Math.round(((healRatio || (side === "player" ? PLAYER_HEAL_RATIO : ENEMY_HEAL_RATIO)) + levelBonus * levelHealGrowth) * normalizeNumber(stats.vitality) * 3),
      )
      : 0;
    const reduction = skill.category === "guard"
      ? clamp((guardRatio || (side === "player" ? PLAYER_GUARD_RATIO : ENEMY_GUARD_RATIO)) + levelBonus * levelGuardGrowth, 0, 0.45)
      : 0;

    return {
      acquisitionHint: skill.acquisitionHint || "",
      category: skill.category,
      cooldownTurns: normalizeNumber(skill.cooldownTurns || (skill.category === "guard"
        ? (side === "player" ? PLAYER_GUARD_COOLDOWN_TURNS : ENEMY_GUARD_COOLDOWN_TURNS)
        : 0)),
      damage,
      description: skill.description || "",
      heal,
      iconText: skill.iconText || skill.name?.slice(0, 1) || "技",
      key: skill.key,
      level: normalizeSkillLevel(skill.level, skill.maxLevel),
      maxUses,
      name: skill.name,
      effects: Array.isArray(skill.effects) ? skill.effects : [],
      quality: skill.quality || "white",
      reduction,
      source: skill.source || (side === "player" ? "learned" : "enemy"),
      trigger: skill.trigger || "random",
      usesRemaining: maxUses,
    };
  });
}

function pickBattleSkill(actor, target) {
  const usableSkills = Array.isArray(actor.skills)
    ? actor.skills.filter((skill) => normalizeNumber(skill.usesRemaining) > 0)
    : [];
  const actorHealthRatio = actor.maxHealth > 0 ? actor.currentHealth / actor.maxHealth : 0;
  const targetHealthRatio = target.maxHealth > 0 ? target.currentHealth / target.maxHealth : 0;
  const guardSkills = usableSkills.filter((skill) => skill.category === "guard");
  const spellSkills = usableSkills.filter((skill) => skill.category === "spell");
  const attackSkills = usableSkills.filter((skill) => skill.category === "attack");
  const guardSkill = guardSkills.length > 0
    ? guardSkills[Math.floor(Math.random() * guardSkills.length)]
    : null;
  const spellSkill = spellSkills.length > 0
    ? spellSkills[Math.floor(Math.random() * spellSkills.length)]
    : null;
  const attackSkill = attackSkills.length > 0
    ? attackSkills[Math.floor(Math.random() * attackSkills.length)]
    : null;
  const guardThreshold = actor.side === "player" ? PLAYER_GUARD_HEALTH_THRESHOLD : ENEMY_GUARD_HEALTH_THRESHOLD;

  if (guardSkill && actorHealthRatio < guardThreshold && actor.guardCooldownTurns <= 0) {
    return guardSkill;
  }

  if (spellSkill && targetHealthRatio < 0.2) {
    return spellSkill;
  }

  if (spellSkill) {
    const spellChance = actor.stats.intelligence >= INTELLIGENCE_SPELL_BONUS_THRESHOLD ? SPELL_BASE_CHANCE : 0.35;

    if (Math.random() < spellChance) {
      return spellSkill;
    }
  }

  return attackSkill || null;
}

function buildBattleCombatant({
  currentHealth,
  intelligence,
  label,
  maxHealth,
  name,
  side,
  skills,
  totalSkillUseLimit,
  totalSkillUsesRemaining,
  skillUsesRemaining,
  stats,
}) {
  const normalizedSkills = Array.isArray(skills)
    ? skills.map((skill) => ({
      acquisitionHint: typeof skill.acquisitionHint === "string" ? skill.acquisitionHint : "",
      category: skill.category === "guard" || skill.category === "spell" || skill.category === "attack" ? skill.category : "attack",
      cooldownTurns: normalizeNumber(skill.cooldownTurns),
      damage: normalizeNumber(skill.damage),
      description: typeof skill.description === "string" ? skill.description : "",
      heal: normalizeNumber(skill.heal),
      iconText: typeof skill.iconText === "string" ? skill.iconText : "技",
      key: typeof skill.key === "string" ? skill.key : makeBattleId(),
      level: normalizeSkillLevel(skill.level),
      maxUses: normalizeNumber(skill.maxUses),
      name: typeof skill.name === "string" ? skill.name : "未知技能",
      effects: Array.isArray(skill.effects) ? skill.effects : [],
      quality: ["white", "green", "blue", "purple", "orange"].includes(skill.quality) ? skill.quality : "white",
      reduction: clamp(Number(skill.reduction) || 0, 0, 0.9),
      source: typeof skill.source === "string" ? skill.source : side === "player" ? "learned" : "enemy",
      trigger: typeof skill.trigger === "string" ? skill.trigger : "random",
      usesRemaining: normalizeNumber(skill.usesRemaining),
    }))
    : [];
  const summary = skillUsesRemaining || summarizeSkillUses(normalizedSkills);

  return {
    actionBar: 0,
    currentHealth: normalizeNumber(currentHealth),
    defenseTurns: 0,
    guardDamageReduction: 0,
    guardCooldownTurns: 0,
    intelligence,
    label,
    maxHealth: normalizeNumber(maxHealth),
    name,
    side,
    activeEffects: normalizeBattleEffects([]),
    skills: normalizedSkills,
    totalSkillUseLimit: normalizeNumber(totalSkillUseLimit),
    totalSkillUsesRemaining: normalizeNumber(totalSkillUsesRemaining),
    skillUsesRemaining: {
      guard: normalizeNumber(summary?.guard),
      spell: normalizeNumber(summary?.spell),
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

function getBattleEnemyPoolForMap(mapKey = null) {
  if (mapKey && battleEnemyTemplatesByMap[mapKey]?.length) {
    return battleEnemyTemplatesByMap[mapKey];
  }

  return battleEnemyTemplatesByMap[mapConfigs[0]?.key] || [];
}

function createEnemyProfile(role, backpack = [], mapKey = null) {
  const playerProfile = getPlayerBattleProfile(role, backpack);
  const templatePool = getBattleEnemyPoolForMap(mapKey);
  const template = templatePool[Math.floor(Math.random() * templatePool.length)] || templatePool[0];
  if (!template) {
    throw createServiceError("当前地图未配置可用怪物模板。", 409);
  }
  const level = Math.max(1, normalizeNumber(role.level) + (Math.random() < 0.35 ? 1 : 0));
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
    fixedSkillKeys: Array.isArray(template.fixedSkillKeys)
      ? template.fixedSkillKeys.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      : [],
    skillCaps: {
      guard: normalizeNumber(template.skillCaps?.guard),
      spell: normalizeNumber(template.skillCaps?.spell),
    },
    currentHealth: maxHealth,
    maxHealth,
    stats,
  };
}

function createPvpEnemyProfile(targetRole, targetBackpack = []) {
  const stats = getRoleEffectiveStats(targetRole, targetBackpack);
  const raceLabel = raceConfigs.find((item) => item.key === targetRole.race_key)?.label || targetRole.race_key;
  const classLabel = classConfigs.find((item) => item.key === targetRole.class_key)?.label || targetRole.class_key;
  const maxHealth = getRoleMaxHealth(targetRole, targetBackpack);

  return {
    key: "pvp-opponent",
    roleId: targetRole.role_id,
    level: normalizeNumber(targetRole.level),
    name: targetRole.name,
    summary: `${raceLabel} · ${classLabel}`,
    fixedSkillKeys: [],
    skillCaps: {
      guard: 0,
      spell: 0,
    },
    currentHealth: clamp(normalizeNumber(targetRole.current_health), 1, maxHealth),
    maxHealth,
    stats,
  };
}

function createBattleState(role, backpack = [], mapKey = null, startedAt = Date.now()) {
  const player = getPlayerBattleProfile(role, backpack);
  const playerSkillCollection = buildPlayerSkillCollection(role, backpack);
  const enemy = createEnemyProfile(role, backpack, mapKey);
  const battleId = makeBattleId();
  const playerBattleSkills = buildBattleSkills(playerSkillCollection.equippedSkills, player.stats, "player");
  const enemyBattleSkills = buildBattleSkills(buildEnemySkillLoadout(enemy), enemy.stats, "enemy");
  const playerTotalSkillUseLimit = playerSkillCollection.battleSkillUseLimit;
  const enemyTotalSkillUseLimit = enemyBattleSkills.reduce((total, skill) => total + normalizeNumber(skill.maxUses), 0);

  return {
    active: true,
    battleId,
    mode: "afk",
    enemy,
    lastResolvedAt: startedAt,
    logs: normalizeBattleLog([
      {
        id: makeBattleLogId(),
        text: `${enemy.name} 闯入行动路线，自动战斗开始。`,
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
      skills: playerBattleSkills,
      totalSkillUseLimit: playerTotalSkillUseLimit,
      totalSkillUsesRemaining: playerTotalSkillUseLimit,
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
      skills: enemyBattleSkills,
      totalSkillUseLimit: enemyTotalSkillUseLimit,
      totalSkillUsesRemaining: enemyTotalSkillUseLimit,
      stats: enemy.stats,
    }),
  };
}

function createPvpBattleState(challengerRole, challengerBackpack = [], targetRole, targetBackpack = [], startedAt = Date.now()) {
  const player = getPlayerBattleProfile(challengerRole, challengerBackpack);
  const challengerSkillCollection = buildPlayerSkillCollection(challengerRole, challengerBackpack);
  const enemy = createPvpEnemyProfile(targetRole, targetBackpack);
  const targetSkillCollection = buildPlayerSkillCollection(targetRole, targetBackpack);
  const battleId = makeBattleId();
  const playerBattleSkills = buildBattleSkills(challengerSkillCollection.equippedSkills, player.stats, "player");
  const enemyBattleSkills = buildBattleSkills(targetSkillCollection.equippedSkills, enemy.stats, "enemy");
  const playerTotalSkillUseLimit = challengerSkillCollection.battleSkillUseLimit;
  const enemyTotalSkillUseLimit = targetSkillCollection.battleSkillUseLimit;

  return {
    active: true,
    battleId,
    mode: "pvp",
    enemy,
    lastResolvedAt: startedAt,
    logs: normalizeBattleLog([
      {
        id: makeBattleLogId(),
        text: `${challengerRole.name} 向 ${targetRole.name} 发起了切磋，PVP 对战开始。`,
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
      skills: playerBattleSkills,
      totalSkillUseLimit: playerTotalSkillUseLimit,
      totalSkillUsesRemaining: playerTotalSkillUseLimit,
      stats: player.stats,
    }),
    status: "active",
    turnCount: 0,
    winner: null,
    enemyCombatant: buildBattleCombatant({
      currentHealth: enemy.currentHealth,
      intelligence: enemy.stats.intelligence,
      label: "对手",
      maxHealth: enemy.maxHealth,
      name: enemy.name,
      side: "enemy",
      skills: enemyBattleSkills,
      totalSkillUseLimit: enemyTotalSkillUseLimit,
      totalSkillUsesRemaining: enemyTotalSkillUseLimit,
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
    mode: value.mode === "pvp" ? "pvp" : "afk",
    enemy: {
      key: typeof enemy.key === "string" ? enemy.key : "unknown-enemy",
      roleId: typeof enemy.roleId === "string" ? enemy.roleId : null,
      level: normalizeNumber(enemy.level),
      name: typeof enemy.name === "string" ? enemy.name : "未知敌人",
      summary: typeof enemy.summary === "string" ? enemy.summary : "",
      fixedSkillKeys: Array.isArray(enemy.fixedSkillKeys)
        ? enemy.fixedSkillKeys.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [],
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
      activeEffects: normalizeBattleEffects(value.enemyCombatant?.activeEffects),
      currentHealth: normalizeNumber(value.enemyCombatant?.currentHealth),
      defenseTurns: normalizeNumber(value.enemyCombatant?.defenseTurns),
      guardDamageReduction: clamp(Number(value.enemyCombatant?.guardDamageReduction) || 0, 0, 0.45),
      guardCooldownTurns: normalizeNumber(value.enemyCombatant?.guardCooldownTurns),
      intelligence: normalizeNumber(value.enemyCombatant?.intelligence),
      label: typeof value.enemyCombatant?.label === "string" ? value.enemyCombatant.label : "敌方",
      maxHealth: normalizeNumber(value.enemyCombatant?.maxHealth),
      name: typeof value.enemyCombatant?.name === "string" ? value.enemyCombatant.name : "未知敌人",
      side: "enemy",
      skills: Array.isArray(value.enemyCombatant?.skills) ? value.enemyCombatant.skills : [],
      totalSkillUseLimit: normalizeNumber(value.enemyCombatant?.totalSkillUseLimit),
      totalSkillUsesRemaining: normalizeNumber(value.enemyCombatant?.totalSkillUsesRemaining),
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
      activeEffects: normalizeBattleEffects(value.player?.activeEffects),
      currentHealth: normalizeNumber(value.player?.currentHealth),
      defenseTurns: normalizeNumber(value.player?.defenseTurns),
      guardDamageReduction: clamp(Number(value.player?.guardDamageReduction) || 0, 0, 0.45),
      guardCooldownTurns: normalizeNumber(value.player?.guardCooldownTurns),
      intelligence: normalizeNumber(value.player?.intelligence),
      label: typeof value.player?.label === "string" ? value.player.label : "我方",
      maxHealth: normalizeNumber(value.player?.maxHealth),
      name: typeof value.player?.name === "string" ? value.player.name : "我方",
      side: "player",
      skills: Array.isArray(value.player?.skills) ? value.player.skills : [],
      totalSkillUseLimit: normalizeNumber(value.player?.totalSkillUseLimit),
      totalSkillUsesRemaining: normalizeNumber(value.player?.totalSkillUsesRemaining),
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
    if (combatant.defenseTurns === 0) {
      combatant.guardDamageReduction = 0;
    }
  }
}

function decideBattleAction(actor, target) {
  const skill = pickBattleSkill(actor, target);
  const effectiveStats = getCombatantEffectiveStats(actor);

  if (skill?.category === "guard") {
    return {
      action: "guard",
      amount: skill.heal,
      guardRatio: skill.reduction,
      skill,
    };
  }

  if (skill?.category === "spell") {
    return {
      action: "spell",
      damage: skill.damage,
      skill,
    };
  }

  if (skill?.category === "attack") {
    return {
      action: "attack",
      damage: skill.damage,
      skill,
    };
  }

  return {
    action: "attack",
    damage: calculatePhysicalDamage(effectiveStats.strength),
  };
}

function applyBattleDamage(attacker, defender, battleAction) {
  const attackerEffectiveStats = getCombatantEffectiveStats(attacker);
  const defenderEffectiveStats = getCombatantEffectiveStats(defender);
  const attackRate = clamp(1 + attackerEffectiveStats.attackRate, 0.5, 3.2);
  const defenseRateBonus = clamp(defenderEffectiveStats.defenseRate, -0.25, 0.18);
  const attackerSecondaryStats = attackerEffectiveStats.secondaryStats || calculateSecondaryStats(attackerEffectiveStats);
  const defenderSecondaryStats = defenderEffectiveStats.secondaryStats || calculateSecondaryStats(defenderEffectiveStats);

  if (Math.random() < defenderSecondaryStats.dodgeChance) {
    return {
      didDodge: true,
      didCrit: false,
      didBlock: false,
      damage: 0,
    };
  }

  const guardReduction = defender.defenseTurns > 0
    ? clamp(Number(defender.guardDamageReduction) || 0, 0, 0.45)
    : 0;
  const reductionRate = clamp(
    calculateDamageReduction(defenderEffectiveStats.vitality) + defenseRateBonus + guardReduction,
    0,
    0.62,
  );
  const didCrit = Math.random() < attackerSecondaryStats.critChance;
  const critDamageMultiplier = didCrit ? attackerSecondaryStats.critDamage : 1;
  const scaledDamage = battleAction.damage * attackRate * critDamageMultiplier;
  let damageAfterReduction = scaledDamage * (1 - reductionRate);
  const didBlock = Math.random() < defenderSecondaryStats.blockChance;

  if (didBlock) {
    damageAfterReduction *= 1 - clamp(defenderSecondaryStats.blockDamageReduction, 0, 0.9);
  }

  const damage = Math.max(1, Math.round(damageAfterReduction));

  defender.currentHealth = Math.max(0, defender.currentHealth - damage);
  return {
    didDodge: false,
    didCrit,
    didBlock,
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
  tickCombatantEffects(battleState, actor, timestamp);

  if (actor.currentHealth <= 0) {
    battleState.active = false;
    battleState.status = "finished";
    battleState.winner = getOpponentSide(actingSide);
    battleState.outcome = {
      loser: actor.side,
      summary: `${actor.name} 被持续状态击倒。`,
      winner: getOpponentSide(actingSide),
    };
    addBattleLog(battleState, battleState.outcome.summary, "result", timestamp);
    return;
  }

  const decision = decideBattleAction(actor, defender);
  const usedSkill = decision.skill || null;

  if (decision.action === "guard") {
    actor.currentHealth = Math.min(actor.maxHealth, actor.currentHealth + decision.amount);
    actor.defenseTurns = 1;
    actor.guardDamageReduction = clamp(
      Number(decision.guardRatio) || (actor.side === "player" ? PLAYER_GUARD_RATIO : ENEMY_GUARD_RATIO),
      0,
      0.45,
    );
    actor.guardCooldownTurns = normalizeNumber(usedSkill?.cooldownTurns || (actor.side === "player" ? PLAYER_GUARD_COOLDOWN_TURNS : ENEMY_GUARD_COOLDOWN_TURNS));
    if (usedSkill && normalizeNumber(usedSkill.usesRemaining) > 0) {
      usedSkill.usesRemaining = Math.max(0, usedSkill.usesRemaining - 1);
      actor.totalSkillUsesRemaining = Math.max(0, actor.totalSkillUsesRemaining - 1);
      actor.skillUsesRemaining = summarizeSkillUses(actor.skills);
    }
    if (usedSkill) {
      applySkillEffects(battleState, actor, defender, usedSkill, timestamp);
    }
    addBattleLog(
      battleState,
      `${actor.name} 施放 ${usedSkill?.name || "防御姿态"}，恢复了 ${decision.amount} 点生命并进入防御状态。`,
      "guard",
      timestamp,
    );
    maybeConsumeDefense(defender);
    return;
  }

  const damageResult = applyBattleDamage(actor, defender, {
    damage: decision.damage,
  });

  if (usedSkill && normalizeNumber(usedSkill.usesRemaining) > 0) {
    usedSkill.usesRemaining = Math.max(0, usedSkill.usesRemaining - 1);
    actor.totalSkillUsesRemaining = Math.max(0, actor.totalSkillUsesRemaining - 1);
    actor.skillUsesRemaining = summarizeSkillUses(actor.skills);
  }

  if (usedSkill) {
    applySkillEffects(battleState, actor, defender, usedSkill, timestamp);
  }

  if (damageResult.didDodge) {
    addBattleLog(
      battleState,
      `${actor.name}${usedSkill ? ` 施放 ${usedSkill.name}` : decision.action === "spell" ? " 施放法术" : " 发动普攻"}，但被 ${defender.name} 闪避了。`,
      "dodge",
      timestamp,
    );
  } else {
    if (usedSkill) {
      applyInstantSkillEffects(battleState, actor, defender, usedSkill, timestamp);
    }
    const battleTags = [];

    if (damageResult.didCrit) {
      battleTags.push("暴击");
    }

    if (damageResult.didBlock) {
      battleTags.push("格挡");
    }

    addBattleLog(
      battleState,
      `${actor.name}${usedSkill ? ` 施放 ${usedSkill.name}` : decision.action === "spell" ? " 施放法术" : " 发动普攻"}，对 ${defender.name} 造成 ${damageResult.damage} 点伤害${battleTags.length > 0 ? `（${battleTags.join(" / ")}）` : ""}。`,
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

function settlePvpBattleOutcome(role, battleState, backpack = []) {
  if (battleState?.mode !== "pvp" || isBattleActive(battleState)) {
    return false;
  }

  const maxHealth = getRoleMaxHealth(role, backpack);

  if (normalizeNumber(role.current_health) === maxHealth) {
    return false;
  }

  role.current_health = maxHealth;
  return true;
}

function resolveBattleProgress(role, afk, backpack = [], options = {}) {
  const now = options.now || Date.now();
  const battleState = normalizeBattleState(afk.battle_state);
  const isPvpBattle = battleState.mode === "pvp";

  if (!isBattleActive(battleState)) {
    afk.battle_state = battleState;
    return {
      battleStarted: false,
      battleState,
      didMutateAfk: false,
      didMutateRole: false,
      itemDrops: [],
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
      itemDrops: [],
      finished: false,
    };
  }

  let didMutateRole = false;
  let didMutateAfk = false;
  let itemDrops = [];
  let mergedReward = {
    aetherCrystal: 0,
    exp: 0,
    gold: 0,
    healthDelta: 0,
    itemDrops: [],
  };
  let rewardTriggeredLevelDrop = false;

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
  const battleFinishedAt = battleState.lastResolvedAt;
  const enemyName = battleState.enemy?.name || "未知敌人";

  if (!isBattleActive(battleState) && battleState.outcome?.winner === "enemy" && !isPvpBattle) {
    const previousLevel = normalizeNumber(role.level);
    didMutateRole = handleBattleOutcome(role, battleState, backpack) || didMutateRole;
    const nextLevel = normalizeNumber(role.level);
    const didLevelDrop = nextLevel < previousLevel;
    didMutateAfk = prependRecentEncounter(afk, {
      id: makeEncounterId(),
      key: `battle-result-${battleState.battleId || battleFinishedAt}`,
      tier: "legendary",
      title: "战斗失败",
      description: didLevelDrop
        ? `${enemyName} 击倒了你，生命归零后等级下降 1 级并重整状态。`
        : `${enemyName} 击倒了你，你在当前等级重整状态后继续前进。`,
      reward: {
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
        healthDelta: -Math.max(1, getRoleMaxHealth(role, backpack)),
        items: [],
      },
      triggeredAt: battleFinishedAt,
    }) || didMutateAfk;
  }

  if (!isBattleActive(battleState) && battleState.outcome?.winner === "player" && !isPvpBattle) {
    const battleEventResults = evaluateEventRules("enemy_kill", {
      enemyKey: battleState.enemy?.key || null,
      mapKey: afk.map_key || null,
    });

    battleEventResults.forEach((result) => {
      mergedReward.gold += normalizeNumber(result.reward.gold);
      mergedReward.aetherCrystal += normalizeNumber(result.reward.aetherCrystal);
      mergedReward.exp += normalizeNumber(result.reward.exp);
      mergedReward.healthDelta += normalizeSignedNumber(result.reward.healthDelta);
      mergedReward.itemDrops.push(...result.reward.itemDrops);
    });

    itemDrops = mergedReward.itemDrops;

    if (mergedReward.gold > 0 || mergedReward.aetherCrystal > 0 || mergedReward.exp > 0) {
      didMutateRole = applyRewardToRole(role, {
        gold: mergedReward.gold,
        aetherCrystal: mergedReward.aetherCrystal,
        exp: mergedReward.exp,
      }, backpack) || didMutateRole;
      addBattleLog(
        battleState,
        `战斗奖励：金币 +${mergedReward.gold} / 以太 +${mergedReward.aetherCrystal} / 经验 +${mergedReward.exp}`,
        "reward",
        Date.now(),
      );
    }

    if (mergedReward.healthDelta !== 0) {
      const nextHealth = clamp(
        normalizeSignedNumber(role.current_health) + mergedReward.healthDelta,
        0,
        getRoleMaxHealth(role, backpack),
      );
      if (nextHealth > 0) {
        role.current_health = nextHealth;
      } else {
        const previousLevel = normalizeNumber(role.level);
        const nextLevel = Math.max(1, normalizeNumber(role.level) - 1);
        role.level = nextLevel;
        role.exp = getLevelBaseExp(nextLevel);
        role.current_health = getRoleMaxHealth(role, backpack);
        rewardTriggeredLevelDrop = nextLevel < previousLevel;
      }
      battleState.player.currentHealth = role.current_health;
      didMutateRole = true;
      addBattleLog(
        battleState,
        mergedReward.healthDelta > 0
          ? `战斗奖励：生命 +${mergedReward.healthDelta}`
          : `战斗惩罚：生命 ${mergedReward.healthDelta}`,
        "reward",
        Date.now(),
      );
    }

    if (itemDrops.length > 0) {
      addBattleLog(
        battleState,
        `战斗掉落：${itemDrops.map((drop) => `${drop.name} x${drop.quantity}`).join("、")}`,
        "drop",
        Date.now(),
      );
    }

    didMutateAfk = prependRecentEncounter(afk, {
      id: makeEncounterId(),
      key: `battle-result-${battleState.battleId || battleFinishedAt}`,
      tier: rewardTriggeredLevelDrop ? "legendary" : "rare",
      title: rewardTriggeredLevelDrop ? "惨胜" : "战斗胜利",
      description: rewardTriggeredLevelDrop
        ? `${role.name} 击败了 ${enemyName}，但结算惩罚导致生命归零，等级下降 1 级后重整状态。`
        : `${role.name} 击败了 ${enemyName}，战斗顺利结束。`,
      reward: {
        gold: mergedReward.gold,
        aetherCrystal: mergedReward.aetherCrystal,
        exp: mergedReward.exp,
        healthDelta: mergedReward.healthDelta,
        items: buildEncounterRewardFromItemDrops(itemDrops),
      },
      triggeredAt: battleFinishedAt,
    }) || didMutateAfk;
  }

  if (!isBattleActive(battleState) && isPvpBattle) {
    didMutateRole = settlePvpBattleOutcome(role, battleState, backpack) || didMutateRole;
  }

  battleState.enemy.currentHealth = battleState.enemyCombatant.currentHealth;
  afk.battle_state = battleState;
  const didAdvanceBattle = battleState.lastResolvedAt !== lastResolvedAt;

  return {
    battleStarted: false,
    battleState,
    didMutateAfk: didMutateAfk || didAdvanceBattle,
    didMutateRole,
    itemDrops,
    finished: !isBattleActive(battleState),
  };
}

function buildEncounterDelta(executions, settledAt, mapKey = null, activityKey = null) {
  const delta = {
    aetherCrystal: 0,
    encounters: [],
    exp: 0,
    gold: 0,
    itemDrops: [],
  };

  for (let index = 0; index < executions; index += 1) {
    const matches = evaluateEventRules("afk_tick", {
      mapKey: mapKey || null,
      activityKey: activityKey || null,
    });

    matches.forEach((match) => {
      const reward = {
        gold: normalizeNumber(match.reward.gold),
        aetherCrystal: normalizeNumber(match.reward.aetherCrystal),
        exp: normalizeNumber(match.reward.exp),
        ...(normalizeSignedNumber(match.reward.healthDelta) !== 0
          ? { healthDelta: normalizeSignedNumber(match.reward.healthDelta) }
          : {}),
        items: match.reward.itemDrops.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          name: item.name,
          rarity: item.rarity,
        })),
      };

      delta.gold += reward.gold;
      delta.aetherCrystal += reward.aetherCrystal;
      delta.exp += reward.exp;
      delta.itemDrops.push(...match.reward.itemDrops);

      if (match.rule?.encounter?.title && match.rule?.encounter?.description) {
        delta.encounters.push({
          id: makeEncounterId(),
          key: typeof match.rule.key === "string" ? match.rule.key : `event-${Date.now()}`,
          tier: ["common", "rare", "legendary"].includes(match.rule?.encounter?.tier)
            ? match.rule.encounter.tier
            : "common",
          title: match.rule.encounter.title,
          description: match.rule.encounter.description,
          reward,
          triggeredAt: settledAt,
        });
      }
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

function getActivityConfig(activityKey) {
  return activityConfigs.find((item) => item.key === activityKey) || null;
}

function getTaskDurationForActivity(activityKey) {
  const activity = getActivityConfig(activityKey);
  return activity ? activity.taskDurationSeconds : AFK_TASK_SECONDS;
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
    battleItemDrops: [],
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

function buildCombatSecondaryStats(stats) {
  const secondary = calculateSecondaryStats(stats);

  return {
    critChance: secondary.critChance,
    critDamage: secondary.critDamage,
    dodgeChance: secondary.dodgeChance,
    blockChance: secondary.blockChance,
    blockDamageReduction: secondary.blockDamageReduction,
    healthRegenRate: secondary.healthRegenRate,
  };
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

    const previousLevel = normalizeNumber(role.level);
    const nextLevel = Math.max(1, role.level - 1);
    role.level = nextLevel;
    role.exp = getLevelBaseExp(nextLevel);
    role.current_health = getRoleMaxHealth(role, backpack);

    if (encounter.tier !== "legendary" && nextLevel < previousLevel) {
      encounter.tier = "legendary";
    }

    const existingDescription = typeof encounter.description === "string" ? encounter.description.trim() : "";
    encounter.description = existingDescription
      ? `${existingDescription}（生命归零，等级下降 1 级后重整。）`
      : "生命归零，等级下降 1 级后重整。";

    if (!encounter.reward || typeof encounter.reward !== "object") {
      encounter.reward = {
        gold: 0,
        aetherCrystal: 0,
        exp: 0,
        healthDelta: 0,
        items: [],
      };
    }

    if (normalizeSignedNumber(encounter.reward.healthDelta) >= 0) {
      encounter.reward.healthDelta = -Math.max(1, getRoleMaxHealth(role, backpack));
    }
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
  const activityKey = data.afk.activity_key;
  if (activityKey !== "combat") {
    return false;
  }

  if (isBattleActive(data.afk.battle_state) || Math.random() >= BATTLE_TRIGGER_CHANCE) {
    return false;
  }

  data.afk.battle_state = createBattleState(data.role, data.backpack, data.afk.map_key, timestamp);
  prependRecentEncounter(data.afk, {
    id: makeEncounterId(),
    key: `battle-start-${data.afk.battle_state?.battleId || timestamp}`,
    tier: "rare",
    title: "遭遇怪物",
    description: `${data.afk.battle_state?.enemy?.name || "未知敌人"} 闯入行动路线，自动战斗开始。`,
    reward: {
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
      healthDelta: 0,
      items: [],
    },
    triggeredAt: timestamp,
  });
  summary.battleStarted = true;
  summary.didMutateAfk = true;
  summary.didMutateRole = syncBattleStateToRole(data.role, data.afk.battle_state, data.backpack) || summary.didMutateRole;
  return true;
}

function resolveAfkExecution(data, timestamp, options, summary) {
  const activityKey = data.afk.activity_key || "combat";
  const taskDuration = getTaskDurationForActivity(activityKey);
  const baseReward = buildRewardForSeconds(data.afk.map_key, taskDuration);
  const encounterDelta = buildEncounterDelta(1, timestamp, data.afk.map_key, activityKey);
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
      if (battleProgress.itemDrops.length > 0) {
        summary.didMutateBackpack = applyEncounterItemsToBackpack(data.backpack, battleProgress.itemDrops) || summary.didMutateBackpack;
        summary.itemDrops.push(...battleProgress.itemDrops);
        summary.battleItemDrops.push(...battleProgress.itemDrops);
      }
      continue;
    }

    const activityKey = data.afk.activity_key || "combat";
    const taskDuration = getTaskDurationForActivity(activityKey);
    data.afk.accrued_seconds = normalizeNumber(data.afk.accrued_seconds) + EXECUTION_REWARD_TICK_SECONDS;
    summary.didMutateAfk = true;

    if (data.afk.accrued_seconds < taskDuration) {
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
        skill_state = $8::jsonb,
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
      JSON.stringify(normalizePlayerSkillState(role.skill_state, role)),
    ],
  );
}

async function persistAfk(client, afk) {
  await client.query(
    `
      UPDATE afk
      SET
        status = $2,
        activity_key = $3,
        map_key = $4,
        started_at = $5,
        last_settled_at = $6,
        pending_gold = $7,
        pending_aether_crystal = $8,
        pending_exp = $9,
        accrued_seconds = $10,
        recent_encounters = $11::jsonb,
        battle_state = $12::jsonb,
        updated_at = NOW()
      WHERE afk_id = $1
    `,
    [
      afk.afk_id,
      afk.status,
      afk.activity_key || null,
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

async function getActiveBuyOrdersRows() {
  const result = await queryPool(
    `
      SELECT
        bo.order_id,
        bo.buyer_role_id,
        bo.item_id,
        bo.category_key,
        bo.price,
        bo.quantity,
        bo.filled_quantity,
        bo.created_at,
        r.name AS buyer_name
      FROM market_buy_order bo
      JOIN "role" r ON r.role_id = bo.buyer_role_id
      WHERE bo.status = 'active'
      ORDER BY bo.price DESC, bo.created_at ASC
      LIMIT 200
    `,
  );

  return result.rows;
}

async function getMarketSnapshotForRole(roleId) {
  const [activeListings, ownListings, buyOrders] = await Promise.all([
    getMarketActiveSummaryRows(),
    roleId ? getMarketOwnListingRows(roleId) : Promise.resolve([]),
    getActiveBuyOrdersRows(),
  ]);

  return buildMarketSnapshot(roleId || null, activeListings, ownListings, buyOrders);
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
      skill_state,
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

async function findRoleByRoleId(roleId) {
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
        skill_state,
        avatar_seed
      FROM "role"
      WHERE role_id = $1
    `,
    [roleId],
  );

  return result.rows[0] || null;
}

async function getBackpackRowsForRole(roleId) {
  const backpackResult = await query(
    `
      SELECT
        backpack.backpack_id,
        backpack.item_id,
        backpack.quantity,
        backpack.equipped,
        backpack.equipped_slot_groups,
        item.name,
        item.rarity,
        item.item_type,
        item.skill_key,
        item.icon_key,
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
    [roleId],
  );

  backpackResult.rows.forEach((item) => {
    const itemSeed = itemSeedById.get(item.item_id);
    if (itemSeed) {
      item.item_type = normalizeItemType(itemSeed.itemType);
      item.skill_key = normalizeSkillKey(itemSeed.skillKey);
      item.icon_key = typeof itemSeed.iconKey === "string" && itemSeed.iconKey.trim().length > 0
        ? itemSeed.iconKey.trim()
        : null;
      item.slot = itemSeed.slot;
      item.slot_usage = itemSeed.slotUsage;
    } else {
      item.item_type = normalizeItemType(item.item_type);
      item.skill_key = normalizeSkillKey(item.skill_key);
      item.icon_key = typeof item.icon_key === "string" && item.icon_key.trim().length > 0
        ? item.icon_key.trim()
        : null;
    }
    item.equipped_slot_groups = normalizeEquippedSlotGroups(item.equipped_slot_groups);
    item.equipped = item.equipped_slot_groups.length > 0;
  });

  sortBackpackRows(backpackResult.rows);
  return backpackResult.rows;
}

async function requireDashboardData(guestToken) {
  await ensureRuntimeGameConfig();
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw createServiceError("游客会话不存在，请重新登录。", 401);
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw createServiceError("角色不存在，请先创建角色。", 404);
  }

  const [afkResult, backpackRows] = await Promise.all([
    query(
      `
        SELECT
          afk_id,
          role_id,
          status,
          activity_key,
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
    getBackpackRowsForRole(role.role_id),
  ]);

  const afk = afkResult.rows[0];

  if (!afk) {
    throw createServiceError("行动状态不存在，请重新创建角色。", 404);
  }

  afk.recent_encounters = normalizeEncounterLog(afk.recent_encounters);
  afk.battle_state = normalizeBattleState(afk.battle_state);
  const market = await getMarketSnapshotForRole(role.role_id);

  return {
    afk,
    backpack: backpackRows,
    market,
    role,
    user,
  };
}

function buildSnapshot(data, options = {}) {
  const progress = getCurrentLevelProgress(data.role.exp);
  const currentMap = data.afk.map_key ? getMapConfig(data.afk.map_key) : null;
  const currentActivity = data.afk.activity_key ? getActivityConfig(data.afk.activity_key) : null;
  const bodySlotCapacities = getBodySlotCapacities(data.role.race_key);
  const bodySlots = buildRoleBodySlots(data.role, data.backpack);
  const effectiveStats = getRoleEffectiveStats(data.role, data.backpack);
  const roleSecondaryStats = buildCombatSecondaryStats(effectiveStats);
  const skillCollection = buildPlayerSkillCollection(data.role, data.backpack);
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
      activities: activityConfigs,
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
      secondaryStats: roleSecondaryStats,
      bodySlotCapacities,
      bodySlots,
      skillSlots: {
        total: skillCollection.skillSlotCount,
        used: skillCollection.equippedSkills.length,
        remaining: skillCollection.skillSlotsRemaining,
      },
      battleSkillUseLimit: skillCollection.battleSkillUseLimit,
      equippedSkills: skillCollection.equippedSkills.map((skill) => ({
        acquisitionHint: skill.acquisitionHint,
        category: skill.category,
        description: skill.description,
        iconText: skill.iconText,
        key: skill.key,
        level: skill.level,
        name: skill.name,
        quality: skill.quality,
        trigger: skill.trigger,
      })),
      learnedSkills: skillCollection.learnedSkills.map((skill) => ({
        acquisitionHint: skill.acquisitionHint,
        category: skill.category,
        description: skill.description,
        equipped: Boolean(skill.equipped),
        iconText: skill.iconText,
        key: skill.key,
        level: skill.level,
        name: skill.name,
        quality: skill.quality,
        trigger: skill.trigger,
      })),
      skillBooks: skillCollection.skillBooks,
    },
    backpack: data.backpack.map((item) => ({
      backpackId: item.backpack_id,
      itemId: item.item_id,
      itemType: normalizeItemType(item.item_type),
      skillKey: normalizeSkillKey(item.skill_key),
      iconKey: typeof item.icon_key === "string" && item.icon_key.trim().length > 0
        ? item.icon_key.trim()
        : null,
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
      activityKey: data.afk.activity_key || null,
      mapKey: data.afk.map_key,
      startedAt: toMillis(data.afk.started_at),
      lastSettledAt: toMillis(data.afk.last_settled_at),
      shouldShowOfflineRewardModal: options.shouldShowOfflineRewardModal || false,
      accruedSeconds: data.afk.accrued_seconds,
      taskDurationSeconds: getTaskDurationForActivity(data.afk.activity_key || "combat"),
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      activityOptions: activityConfigs,
      currentActivity,
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
          activeEffects: battleState.player.activeEffects || [],
          totalSkillUseLimit: battleState.player.totalSkillUseLimit,
          totalSkillUsesRemaining: battleState.player.totalSkillUsesRemaining,
          skillUsesRemaining: battleState.player.skillUsesRemaining,
          skills: battleState.player.skills || [],
          stats: battleState.player.stats,
          secondaryStats: buildCombatSecondaryStats(battleState.player.stats),
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
          activeEffects: battleState.enemyCombatant.activeEffects || [],
          totalSkillUseLimit: battleState.enemyCombatant.totalSkillUseLimit,
          totalSkillUsesRemaining: battleState.enemyCombatant.totalSkillUsesRemaining,
          skillUsesRemaining: battleState.enemyCombatant.skillUsesRemaining,
          skills: battleState.enemyCombatant.skills || [],
          stats: battleState.enemyCombatant.stats,
          secondaryStats: buildCombatSecondaryStats(battleState.enemyCombatant.stats),
        },
        logs: battleState.logs,
      } : null,
      estimatedHourlyReward: buildHourlyReward(data.afk.map_key),
      encounterRates: getEncounterRatesFromEventRules({
        activityKey: data.afk.activity_key || null,
        mapKey: data.afk.map_key || null,
      }),
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
      activityKey: null,
      mapKey: null,
      startedAt: null,
      lastSettledAt: null,
      shouldShowOfflineRewardModal: false,
      accruedSeconds: 0,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      activityOptions: activityConfigs,
      currentActivity: null,
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
      encounterRates: getEncounterRatesFromEventRules(),
      recentEncounters: [],
    },
    market,
    backpack: [],
    config: {
      activities: activityConfigs,
      classes: classConfigs,
      levels: levelTable,
      maps: mapConfigs,
      races: raceConfigs,
    },
    role: null,
    serverTime: Date.now(),
  };
}

async function getSessionSnapshot(guestToken, options = {}) {
  await ensureRuntimeGameConfig();
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw createServiceError("游客会话不存在，请重新登录。", 401);
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    return buildBootstrapSnapshot(user, await getMarketSnapshotForRole(null));
  }

  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  let didMutateRoleFromPvp = false;
  let didMutateBackpackFromPvp = false;
  let pvpItemDrops = [];

  if (data.afk.status !== "active" && isBattleActive(data.afk.battle_state)) {
    const pvpProgress = resolveBattleProgress(data.role, data.afk, data.backpack, { now });
    didMutateRoleFromPvp = pvpProgress.didMutateRole;
    if (pvpProgress.itemDrops.length > 0) {
      didMutateBackpackFromPvp = applyEncounterItemsToBackpack(data.backpack, pvpProgress.itemDrops) || didMutateBackpackFromPvp;
      pvpItemDrops = pvpProgress.itemDrops;
    }
  }

  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline =
    options.forceOfflineSettlement === true
    || now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;
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
    if (didNormalizeRoleHealth || didMutateRoleFromPvp || simulation.didMutateRole) {
      await persistRole(client, data.role);
    }
    if (pvpItemDrops.length > 0) {
      await persistBackpackItemRewards(client, data.role.role_id, pvpItemDrops);
    }
    if (simulation.itemDrops.length > 0) {
      await persistBackpackItemRewards(client, data.role.role_id, simulation.itemDrops);
    }
    await persistAfk(client, data.afk);
    if (didMutateBackpackFromPvp || simulation.didMutateBackpack) {
      await persistBackpackEquipState(client, data.backpack);
    }
  });

  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal });
}

async function startAfkForGuest(guestToken, activityKey, mapKey) {
  await ensureRuntimeGameConfig();
  const map = getMapConfig(mapKey);

  if (!map) {
    throw createServiceError("地图不存在。", 404);
  }

  const activity = getActivityConfig(activityKey);
  if (!activity) {
    throw createServiceError("活动类型不存在。", 404);
  }

  if (map.activityKey !== activityKey) {
    throw createServiceError("该地图不属于当前选择的活动类型。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data, { now, autoApplyReward: true });

  if (data.afk.status === "active") {
    throw createServiceError("当前已经处于行动中，请先停止。", 409);
  }

  if (data.role.level < map.minLevel) {
    throw createServiceError(`需要达到 ${map.minLevel} 级才能进入该地图。`, 403);
  }

  data.afk.status = "active";
  data.afk.activity_key = activityKey;
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
    throw createServiceError("战斗进行中，暂时不能停止行动。", 409);
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

async function startPvpBattleForGuest(guestToken, targetRoleId) {
  await ensureRuntimeGameConfig();
  const normalizedTargetRoleId = typeof targetRoleId === "string" ? targetRoleId.trim() : "";

  if (!normalizedTargetRoleId) {
    throw createServiceError("缺少切磋目标。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);

  if (data.role.role_id === normalizedTargetRoleId) {
    throw createServiceError("不能对自己发起切磋。", 400);
  }

  if (isBattleActive(data.afk.battle_state)) {
    throw createServiceError("当前已经处于战斗中，暂时不能发起新的切磋。", 409);
  }

  const targetRole = await findRoleByRoleId(normalizedTargetRoleId);

  if (!targetRole) {
    throw createServiceError("目标角色不存在或已下线。", 404);
  }

  const targetBackpack = await getBackpackRowsForRole(targetRole.role_id);
  const now = Date.now();

  data.afk.battle_state = createPvpBattleState(data.role, data.backpack, targetRole, targetBackpack, now);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth) {
      await persistRole(client, data.role);
    }
    await persistAfk(client, data.afk);
  });

  return getSessionSnapshot(guestToken);
}

async function dropBackpackItemForGuest(guestToken, backpackId) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw createServiceError("缺少背包物品标识。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw createServiceError("要丢弃的物品不存在。", 404);
  }

  await withTransaction(async (client) => {
    const deleted = await deleteBackpackEntry(client, data.role.role_id, normalizedBackpackId);

    if (!deleted) {
      throw createServiceError("物品丢弃失败，请稍后重试。", 409);
    }
  });

  return getSessionSnapshot(guestToken);
}

async function equipBackpackItemForGuest(guestToken, backpackId) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw createServiceError("缺少背包物品标识。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw createServiceError("要装备的物品不存在。", 404);
  }

  if (!isEquipmentItem(matchedItem)) {
    throw createServiceError("该物品不是装备类型，无法穿戴。", 409);
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
    throw createServiceError("缺少背包物品标识。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw createServiceError("要脱下的物品不存在。", 404);
  }

  if (!isEquipmentItem(matchedItem)) {
    throw createServiceError("该物品不是装备类型，无法卸下。", 409);
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

async function learnSkillBookForGuest(guestToken, backpackId) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";

  if (!normalizedBackpackId) {
    throw createServiceError("缺少背包物品标识。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw createServiceError("要学习的技能书不存在。", 404);
  }

  if (normalizeItemType(matchedItem.item_type) !== "skill_book") {
    throw createServiceError("该物品不是技能书，无法学习。", 409);
  }

  const skillKey = normalizeSkillKey(matchedItem.skill_key);

  if (!skillKey) {
    throw createServiceError("该技能书缺少技能定义，无法学习。", 409);
  }

  await withTransaction(async (client) => {
    const lockedItemResult = await client.query(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          item.name,
          item.item_type,
          item.skill_key
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = $1 AND backpack.backpack_id = $2
        FOR UPDATE
      `,
      [data.role.role_id, matchedItem.backpack_id],
    );
    const lockedItem = lockedItemResult.rows[0];

    if (!lockedItem) {
      throw createServiceError("要学习的技能书不存在。", 404);
    }

    if (normalizeItemType(lockedItem.item_type) !== "skill_book") {
      throw createServiceError("该物品不是技能书，无法学习。", 409);
    }

    const lockedSkillKey = normalizeSkillKey(lockedItem.skill_key);
    if (!lockedSkillKey) {
      throw createServiceError("该技能书缺少技能定义，无法学习。", 409);
    }

    addLearnedSkillFromBook(data.role, lockedSkillKey, {
      acquisitionHint: `通过技能书 ${lockedItem.name} 学会。`,
      bookName: lockedItem.name,
    });

    if (normalizeNumber(lockedItem.quantity) <= 1) {
      const deleted = await deleteBackpackEntry(client, data.role.role_id, lockedItem.backpack_id);

      if (!deleted) {
        throw createServiceError("技能书消耗失败，请稍后重试。", 409);
      }
    } else {
      await client.query(
        `
          UPDATE backpack
          SET quantity = quantity - 1, updated_at = NOW()
          WHERE backpack_id = $1 AND role_id = $2 AND quantity > 0
        `,
        [lockedItem.backpack_id, data.role.role_id],
      );
    }

    await persistRole(client, data.role);
  });

  return getSessionSnapshot(guestToken);
}

async function configureSkillLoadoutForGuest(guestToken, skillKey, action) {
  await ensureRuntimeGameConfig();
  const normalizedSkillKey = normalizeSkillKey(skillKey);
  const normalizedAction = action === "unequip" ? "unequip" : "equip";

  if (!normalizedSkillKey) {
    throw createServiceError("缺少技能标识。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const definition = getSkillDefinition(normalizedSkillKey);

  if (!definition) {
    throw createServiceError("技能不存在，无法配置。", 404);
  }

  const normalizedState = normalizePlayerSkillState(data.role.skill_state, data.role);
  const learnedSkillKeys = new Set(normalizedState.learnedSkills.map((entry) => entry.skillKey));

  if (!learnedSkillKeys.has(normalizedSkillKey)) {
    throw createServiceError("该技能尚未学会，无法配置。", 409);
  }

  const skillSlotCount = calculatePlayerSkillSlotCount(data.role.intelligence);
  let nextEquippedSkillKeys = [...normalizedState.equippedSkillKeys];

  if (normalizedAction === "equip") {
    if (nextEquippedSkillKeys.includes(normalizedSkillKey)) {
      return getSessionSnapshot(guestToken);
    }

    if (nextEquippedSkillKeys.length >= skillSlotCount) {
      throw createServiceError("技能槽位已满，请先卸下其他技能。", 409);
    }

    nextEquippedSkillKeys.push(normalizedSkillKey);
  } else {
    if (!nextEquippedSkillKeys.includes(normalizedSkillKey)) {
      return getSessionSnapshot(guestToken);
    }

    nextEquippedSkillKeys = nextEquippedSkillKeys.filter((entry) => entry !== normalizedSkillKey);
  }

  data.role.skill_state = normalizePlayerSkillState({
    ...normalizedState,
    equippedSkillKeys: nextEquippedSkillKeys,
  }, data.role);

  await withTransaction(async (client) => {
    await persistRole(client, data.role);
  });

  return getSessionSnapshot(guestToken);
}

async function createMarketListingForGuest(guestToken, backpackId, price, quantity) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = typeof backpackId === "string" ? backpackId.trim() : "";
  const normalizedPrice = normalizeNumber(price);
  const normalizedQuantity = normalizeNumber(quantity);

  if (!normalizedBackpackId) {
    throw createServiceError("缺少背包物品标识。", 400);
  }

  if (normalizedPrice <= 0) {
    throw createServiceError("上架价格必须大于 0。", 400);
  }

  if (normalizedQuantity <= 0) {
    throw createServiceError("上架数量必须大于 0。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const matchedItem = data.backpack.find((item) => item.backpack_id === normalizedBackpackId);

  if (!matchedItem) {
    throw createServiceError("要上架的物品不存在。", 404);
  }

  if (matchedItem.quantity <= (matchedItem.equipped_slot_groups || []).length) {
    throw createServiceError("这件物品没有可上架的剩余数量。", 409);
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
          item.item_type,
          item.skill_key,
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
      throw createServiceError("要上架的物品不存在。", 404);
    }

    lockedBackpackItem.equipped_slot_groups = normalizeEquippedSlotGroups(lockedBackpackItem.equipped_slot_groups);
    const sellableQuantity = Math.max(0, lockedBackpackItem.quantity - getBackpackEquippedCount(lockedBackpackItem));

    if (sellableQuantity <= 0) {
      throw createServiceError("这件物品没有可上架的剩余数量。", 409);
    }

    if (normalizedQuantity > sellableQuantity) {
      throw createServiceError("上架数量超过了当前可出售数量。", 409);
    }

    if (lockedBackpackItem.quantity <= normalizedQuantity) {
      const deleted = await deleteBackpackEntry(client, data.role.role_id, lockedBackpackItem.backpack_id);

      if (!deleted) {
        throw createServiceError("上架失败，请稍后重试。", 409);
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
          VALUES ($1, $2, $3, $5, $4, 'active', 0, 0, NOW(), NOW())
        `,
        [
          `listing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index}`,
          data.role.role_id,
          lockedBackpackItem.item_id,
          normalizedPrice,
          normalizeItemType(lockedBackpackItem.item_type),
        ],
      );
    }
  });

  return getSessionSnapshot(guestToken);
}

async function cancelMarketListingForGuest(guestToken, listingId) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = typeof listingId === "string" ? listingId.trim() : "";

  if (!normalizedListingId) {
    throw createServiceError("缺少市场挂单标识。", 400);
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
      throw createServiceError("要下架的挂单不存在。", 404);
    }

    if (listing.status !== "active") {
      throw createServiceError("该挂单当前不能下架。", 409);
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
    throw createServiceError("缺少市场挂单标识。", 400);
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
      throw createServiceError("这件商品已经被买走或下架了。", 409);
    }

    if (listing.seller_role_id === data.role.role_id) {
      throw createServiceError("不能购买自己上架的物品。", 409);
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
      throw createServiceError("当前只能购买这件商品中最便宜的那一件。", 409);
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
      throw createServiceError("交易角色不存在，请稍后重试。", 409);
    }

    if (buyerRole.gold < listing.price) {
      throw createServiceError("金币不足，无法购买这件商品。", 409);
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
    throw createServiceError("缺少市场挂单标识。", 400);
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
      throw createServiceError("要处理的出售通知不存在。", 404);
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

async function createBuyOrderForGuest(guestToken, itemId, price, quantity) {
  await ensureRuntimeGameConfig();
  const normalizedItemId = typeof itemId === "string" ? itemId.trim() : "";
  const normalizedPrice = normalizeNumber(price);
  const normalizedQuantity = normalizeNumber(quantity);

  if (!normalizedItemId) {
    throw createServiceError("缺少物品标识。", 400);
  }

  if (normalizedPrice <= 0) {
    throw createServiceError("买入价格必须大于 0。", 400);
  }

  if (normalizedQuantity <= 0) {
    throw createServiceError("买入数量必须大于 0。", 400);
  }

  const data = await requireDashboardData(guestToken);
  const totalCost = normalizedPrice * normalizedQuantity;

  if (data.role.gold < totalCost) {
    throw createServiceError("金币不足。", 409);
  }

  // Look up item metadata
  const itemResult = await queryPool(
    `SELECT item_id, category_key FROM item WHERE item_id = $1`,
    [normalizedItemId],
  );
  const itemRow = itemResult.rows[0];

  if (!itemRow) {
    throw createServiceError("物品不存在。", 404);
  }

  await withTransaction(async (client) => {
    // Lock buyer role row and verify gold
    const roleResult = await client.query(
      `SELECT role_id, gold FROM "role" WHERE role_id = $1 FOR UPDATE`,
      [data.role.role_id],
    );
    const buyerRole = roleResult.rows[0];

    if (!buyerRole || buyerRole.gold < totalCost) {
      throw createServiceError("金币不足。", 409);
    }

    // Try to match against existing sell listings (cheapest first)
    let remainingQty = normalizedQuantity;
    const matchedListings = await client.query(
      `
        SELECT listing_id, seller_role_id, price, item_id
        FROM market_listing
        WHERE item_id = $1 AND status = 'active' AND price <= $2 AND seller_role_id != $3
        ORDER BY price ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $4
      `,
      [normalizedItemId, normalizedPrice, data.role.role_id, remainingQty],
    );

    for (const listing of matchedListings.rows) {
      if (remainingQty <= 0) break;

      const matchFee = calculateMarketFee(listing.price);
      const sellerReceives = listing.price - matchFee;

      // Deduct gold from buyer
      await client.query(
        `UPDATE "role" SET gold = gold - $1, updated_at = NOW() WHERE role_id = $2`,
        [listing.price, data.role.role_id],
      );

      // Credit seller pending gold
      await client.query(
        `UPDATE afk SET pending_gold = pending_gold + $1, updated_at = NOW() WHERE role_id = $2`,
        [sellerReceives, listing.seller_role_id],
      );

      // Add item to buyer backpack
      await upsertBackpackItemQuantity(client, data.role.role_id, listing.item_id, 1);

      // Mark listing sold
      await client.query(
        `
          UPDATE market_listing
          SET status = 'sold', buyer_role_id = $1, sold_price = $2,
              fee_amount = $3, seller_receive_amount = $4, sold_at = NOW(), updated_at = NOW()
          WHERE listing_id = $5
        `,
        [data.role.role_id, listing.price, matchFee, sellerReceives, listing.listing_id],
      );

      remainingQty -= 1;
    }

    // If unmatched quantity remains, create a buy order
    if (remainingQty > 0) {
      const reservedGold = normalizedPrice * remainingQty;

      // Reserve gold from buyer
      await client.query(
        `UPDATE "role" SET gold = gold - $1, updated_at = NOW() WHERE role_id = $2`,
        [reservedGold, data.role.role_id],
      );

      await client.query(
        `
          INSERT INTO market_buy_order (
            order_id, buyer_role_id, item_id, category_key, price, quantity,
            status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
        `,
        [
          `buyorder-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          data.role.role_id,
          normalizedItemId,
          itemRow.category_key,
          normalizedPrice,
          remainingQty,
        ],
      );
    }
  });

  return getSessionSnapshot(guestToken);
}

module.exports = {
  AFK_TASK_SECONDS,
  buyMarketListingForGuest,
  cancelMarketListingForGuest,
  createBuyOrderForGuest,
  dismissMarketSoldNotificationForGuest,
  getSessionSnapshot,
  createMarketListingForGuest,
  startPvpBattleForGuest,
  startAfkForGuest,
  getActivityConfig,
  stopAfkForGuest,
  claimAfkRewardForGuest,
  dropBackpackItemForGuest,
  equipBackpackItemForGuest,
  configureSkillLoadoutForGuest,
  learnSkillBookForGuest,
  unequipBackpackItemForGuest,
};
