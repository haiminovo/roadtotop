import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import {
  AFK_TASK_SECONDS,
  EXP_GROWTH_PER_LEVEL,
  EXP_PER_LEVEL,
  getCurrentLevelProgress,
  getExpRequiredForLevel,
  getLevelBaseExp,
  getLevelFromExp,
  getMaxHealth,
  LEVEL_CURVE_VERSION,
  MAX_OFFLINE_SECONDS,
  afkEncounterChances as defaultAfkEncounterChances,
  afkEncounterPool as defaultAfkEncounterPool,
  classConfigs as defaultClassConfigs,
  mapConfigs as defaultMapConfigs,
  raceConfigs as defaultRaceConfigs,
  type AfkEncounterConfig,
  type AfkEncounterReward,
  type BodySlotCapacities,
  type BodySlotType,
  type ClassConfig,
  type ClassKey,
  type EncounterTier,
  type ItemRarity,
  type MapConfig,
  type MapKey,
  type RaceConfig,
  type RaceKey,
} from "@/lib/game-config";
import { query, withTransaction } from "@/lib/server/db";
import {
  getBodySlotCapacitiesFromRace,
  getBodySlotTypeLabelRuntime,
  getLevelTable,
  refreshRuntimeGameConfig,
  type RuntimeItemSeed,
} from "@/lib/server/dynamic-game-config";
import { ApiError } from "@/lib/server/http";
import { deleteRedisKey, setRedisJson } from "@/lib/server/redis";

type UserRow = {
  user_id: string;
  guest_token: string;
  account_type: "guest" | "account";
  username: string | null;
  password_hash: string | null;
  password_salt: string | null;
  last_login_at: Date;
  last_seen_at: Date;
};

type RoleRow = {
  role_id: string;
  user_id: string;
  name: string;
  race_key: RaceKey;
  class_key: ClassKey;
  level: number;
  exp: number;
  exp_curve_version: number;
  gold: number;
  aether_crystal: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  current_health: number;
  skill_state?: unknown;
  avatar_seed: string;
};

type AfkRow = {
  afk_id: string;
  role_id: string;
  status: "idle" | "active";
  map_key: MapKey | null;
  started_at: Date | null;
  last_settled_at: Date | null;
  pending_gold: number;
  pending_aether_crystal: number;
  pending_exp: number;
  accrued_seconds: number;
  recent_encounters: AfkEncounterLogEntry[];
};

type BackpackRow = {
  backpack_id: string;
  item_id: string;
  quantity: number;
  equipped: boolean;
  equipped_slot_groups: string[][];
  name: string;
  rarity: string;
  icon_key: string | null;
  slot: BodySlotType;
  slot_usage: number;
  description: string;
  sell_price: number;
  stat_json: Record<string, number>;
};

type MarketListingStatus = "active" | "sold" | "cancelled";
type MarketCategoryKey = "equipment";

type MarketListingRow = {
  listing_id: string;
  seller_role_id: string;
  seller_name: string;
  item_id: string;
  category_key: MarketCategoryKey;
  price: number;
  status: MarketListingStatus;
  buyer_role_id: string | null;
  sold_price: number | null;
  fee_amount: number;
  seller_receive_amount: number;
  seller_notice_seen: boolean;
  created_at: Date;
  updated_at: Date;
  sold_at: Date | null;
  cancelled_at: Date | null;
  name: string;
  rarity: ItemRarity;
  slot: BodySlotType;
  slot_usage: number;
  description: string;
  sell_price: number;
  stat_json: Record<string, number>;
};

type MarketSummaryRow = MarketListingRow & {
  available_count: number;
};

type MarketOwnListingGroupRow = Omit<MarketListingRow, "buyer_role_id" | "fee_amount" | "seller_receive_amount"> & {
  buyer_role_id: string | null;
  fee_amount: number;
  seller_receive_amount: number;
  seller_notice_seen: boolean;
  listing_count: number;
};

type MarketSnapshot = {
  feeRatePercent: number;
  categoryOptions: Array<{ key: MarketCategoryKey; label: string }>;
  rarityOptions: ItemRarity[];
  slotOptions: BodySlotType[];
  listings: Array<{
    listingId: string;
    itemId: string;
    categoryKey: MarketCategoryKey;
    name: string;
    rarity: ItemRarity;
    slot: BodySlotType;
    slotUsage: number;
    description: string;
    sellPrice: number;
    stats: Record<string, number>;
    price: number;
    sellerName: string;
    availableCount: number;
    createdAt: number;
    isOwnListing: boolean;
  }>;
  myListings: Array<{
    listingId: string;
    itemId: string;
    categoryKey: MarketCategoryKey;
    name: string;
    rarity: ItemRarity;
    slot: BodySlotType;
    slotUsage: number;
    description: string;
    sellPrice: number;
    stats: Record<string, number>;
    price: number;
    status: MarketListingStatus;
    createdAt: number;
    soldAt: number | null;
    cancelledAt: number | null;
    buyerRoleId: string | null;
    sellerReceiveAmount: number;
    feeAmount: number;
    quantity: number;
    sellerNoticeSeen: boolean;
  }>;
};

type RewardPreview = {
  seconds: number;
  gold: number;
  aetherCrystal: number;
  exp: number;
};

type RewardDelta = {
  aetherCrystal: number;
  encounters: AfkEncounterLogEntry[];
  exp: number;
  itemDrops: EncounterGrantedItem[];
  executions: number;
  gold: number;
  seconds: number;
};

type ItemSeed = {
  itemId: string;
  name: string;
  rarity: ItemRarity;
  iconKey: string | null;
  slot: BodySlotType;
  slotUsage: number;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
};

type EncounterGrantedItem = {
  itemId: string;
  quantity: number;
  name: string;
  rarity: ItemRarity;
  iconKey: string | null;
  slot: BodySlotType;
  slotUsage: number;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
};

type RoleBodySlotView = {
  key: string;
  label: string;
  slotType: BodySlotType;
  item: null | {
    backpackId: string;
    itemId: string;
    name: string;
    rarity: string;
  };
};

type AfkEncounterLogEntry = {
  id: string;
  key: string;
  tier: EncounterTier;
  title: string;
  description: string;
  reward: AfkEncounterReward;
  triggeredAt: number;
};

type DashboardData = {
  user: UserRow;
  role: RoleRow;
  afk: AfkRow;
  backpack: BackpackRow[];
  market: MarketSnapshot;
};

export type GameSessionSnapshot = {
  serverTime: number;
  account: {
    guestToken: string;
    hasRole: boolean;
    mode: "guest" | "account";
    username: string | null;
    userId: string;
  };
  config: {
    classes: typeof classConfigs;
    levels: typeof levelTable;
    maps: typeof mapConfigs;
    races: typeof raceConfigs;
  };
  role: null | {
    roleId: string;
    name: string;
    raceKey: RaceKey;
    classKey: ClassKey;
    level: number;
    exp: number;
    currentLevelExp: number;
    nextLevelExp: number;
    currentHealth: number;
    maxHealth: number;
    gold: number;
    aetherCrystal: number;
    avatarSeed: string;
    stats: {
      strength: number;
      agility: number;
      intelligence: number;
      vitality: number;
    };
    bodySlotCapacities: BodySlotCapacities;
    bodySlots: RoleBodySlotView[];
  };
  backpack: Array<{
    backpackId: string;
    itemId: string;
    quantity: number;
    equipped: boolean;
    equippedCount: number;
    equippedSlotGroups: string[][];
    name: string;
    rarity: string;
    slot: BodySlotType;
    slotUsage: number;
    description: string;
    sellPrice: number;
    stats: Record<string, number>;
  }>;
  afk: {
    status: "idle" | "active";
    mapKey: MapKey | null;
    startedAt: number | null;
    lastSettledAt: number | null;
    shouldShowOfflineRewardModal: boolean;
    accruedSeconds: number;
    taskDurationSeconds: number;
    maxOfflineSeconds: number;
    mapOptions: typeof mapConfigs;
    currentMap: null | {
      key: MapKey;
      label: string;
      summary: string;
      goldPerMinute: number;
      aetherPerMinute: number;
      expPerMinute: number;
    };
    pendingReward: RewardPreview;
    estimatedHourlyReward: RewardPreview;
    encounterRates: Record<EncounterTier, number>;
    recentEncounters: AfkEncounterLogEntry[];
  };
  market: MarketSnapshot;
};

export type GuestLoginResult = {
  guestToken: string;
  hasRole: boolean;
  mode: "guest" | "account";
  username: string | null;
  serverTime: number;
  userId: string;
};

export type AccountLoginInput = {
  password: string;
  username: string;
};

export type AccountRegistrationInput = {
  guestToken: string;
  password: string;
  username: string;
};

const levelTable = getLevelTable();
const OFFLINE_MODAL_THRESHOLD_MS = 45 * 1000;
const MAX_RECENT_ENCOUNTERS = 8;
const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 20;
let MARKET_FEE_RATE_PERCENT = 10;
const MARKET_CATEGORY_OPTIONS = [{ key: "equipment", label: "装备" }] as const satisfies Array<{
  key: MarketCategoryKey;
  label: string;
}>;
let itemSeeds: ItemSeed[] = [];
let itemSeedById = new Map<string, ItemSeed>();
let afkEncounterChances = defaultAfkEncounterChances;
let afkEncounterPoolByMapAndTier: Record<string, Record<EncounterTier, AfkEncounterConfig[]>> = {};
let classConfigs: ClassConfig[] = defaultClassConfigs;
let mapConfigs: MapConfig[] = defaultMapConfigs;
let raceConfigs: RaceConfig[] = defaultRaceConfigs;

applyRuntimeConfig({
  afkEncounterChances: defaultAfkEncounterChances,
  afkEncounterPool: defaultAfkEncounterPool,
  afkEncounterPoolByMapAndTier: {},
  battleEnemyTemplates: [],
  battleEnemyTemplatesByMap: {},
  classConfigs: defaultClassConfigs,
  eventRules: [],
  itemCatalog: [] as RuntimeItemSeed[],
  itemSeedById: new Map<string, RuntimeItemSeed>(),
  levelTable,
  mapConfigs: defaultMapConfigs,
  raceConfigs: defaultRaceConfigs,
  skillTemplates: [],
  skillTemplateByKey: new Map(),
  systemBalance: {
    actionBarTarget: 100,
    battleTriggerChance: 0.2,
    enemyGuardCooldownTurns: 3,
    enemyGuardHealthThreshold: 0.18,
    enemyGuardRatio: 0.35,
    enemyHealRatio: 0.08,
    executionRewardTickSeconds: 1,
    intelligenceSpellBonusThreshold: 12,
    marketFeeRatePercent: 10,
    playerGuardCooldownTurns: 2,
    playerGuardHealthThreshold: 0.3,
    playerGuardRatio: 0.45,
    playerHealRatio: 0.18,
    spellBaseChance: 0.7,
  },
});

function applyRuntimeConfig(config: Awaited<ReturnType<typeof refreshRuntimeGameConfig>>) {
  MARKET_FEE_RATE_PERCENT = config.systemBalance.marketFeeRatePercent;
  itemSeeds = config.itemCatalog as ItemSeed[];
  itemSeedById = new Map(itemSeeds.map((item) => [item.itemId, item]));
  afkEncounterChances = config.afkEncounterChances;
  afkEncounterPoolByMapAndTier = config.afkEncounterPoolByMapAndTier;
  classConfigs = config.classConfigs;
  mapConfigs = config.mapConfigs;
  raceConfigs = config.raceConfigs;
}

async function ensureRuntimeGameConfig() {
  applyRuntimeConfig(await refreshRuntimeGameConfig());
}

function getRaceConfig(raceKey: string) {
  return raceConfigs.find((item) => item.key === raceKey) ?? null;
}

function getClassConfig(classKey: string) {
  return classConfigs.find((item) => item.key === classKey) ?? null;
}

function getMapConfig(mapKey: string) {
  return mapConfigs.find((item) => item.key === mapKey) ?? null;
}

function getBodySlotCapacities(raceKey: string) {
  return getBodySlotCapacitiesFromRace(raceKey, raceConfigs);
}

function getBodySlotTypeLabel(slotType: BodySlotType) {
  return getBodySlotTypeLabelRuntime(slotType);
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]+$/.test(value);
}

function validateUsername(username: string) {
  const normalizedUsername = normalizeUsername(username);

  if (
    normalizedUsername.length < MIN_USERNAME_LENGTH
    || normalizedUsername.length > MAX_USERNAME_LENGTH
    || !isValidUsername(normalizedUsername)
  ) {
    throw new Error("账号需为 4 到 20 位，仅支持字母、数字和下划线。");
  }

  return normalizedUsername;
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 64) {
    throw new Error("密码需为 6 到 64 个字符。");
  }
}

function hashPassword(password: string, salt?: string) {
  const resolvedSalt = salt ?? randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, resolvedSalt, 64).toString("hex");

  return {
    passwordHash,
    passwordSalt: resolvedSalt,
  };
}

function verifyPassword(password: string, passwordHash: string, passwordSalt: string) {
  const nextHash = scryptSync(password, passwordSalt, 64);
  const currentHash = Buffer.from(passwordHash, "hex");

  if (nextHash.length !== currentHash.length) {
    return false;
  }

  return timingSafeEqual(nextHash, currentHash);
}

function toMillis(value: Date | null) {
  return value ? new Date(value).getTime() : null;
}

function normalizeNumber(value: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function normalizeSignedNumber(value: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.trunc(numericValue) : 0;
}

function migrateLegacyRoleExp(role: RoleRow) {
  if ((role.exp_curve_version ?? 1) >= LEVEL_CURVE_VERSION) {
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

function calculateMarketFee(price: number) {
  const normalizedPrice = normalizeNumber(price);
  const feeAmount = Math.floor((normalizedPrice * MARKET_FEE_RATE_PERCENT) / 100);
  return {
    feeAmount,
    sellerReceiveAmount: Math.max(0, normalizedPrice - feeAmount),
  };
}

function getRarityRank(rarity: string) {
  return {
    white: 1,
    green: 2,
    blue: 3,
    purple: 4,
    orange: 5,
  }[rarity] ?? 0;
}

function sortBackpackRows(backpack: BackpackRow[]) {
  backpack.sort((left, right) => {
    const leftEquippedCount = left.equipped_slot_groups.length;
    const rightEquippedCount = right.equipped_slot_groups.length;

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

function buildMarketSnapshot(
  roleId: string | null,
  activeListings: MarketSummaryRow[],
  ownListings: MarketOwnListingGroupRow[],
): MarketSnapshot {
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
      stats: listing.stat_json,
      price: listing.price,
      sellerName: listing.seller_name,
      availableCount: normalizeNumber(listing.available_count),
      createdAt: toMillis(listing.created_at) ?? Date.now(),
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
      stats: listing.stat_json,
      price: listing.price,
      status: listing.status,
      createdAt: toMillis(listing.created_at) ?? Date.now(),
      soldAt: toMillis(listing.sold_at),
      cancelledAt: toMillis(listing.cancelled_at),
      buyerRoleId: listing.buyer_role_id,
      sellerReceiveAmount: listing.seller_receive_amount,
      feeAmount: listing.fee_amount,
      quantity: normalizeNumber(listing.listing_count),
      sellerNoticeSeen: Boolean(listing.seller_notice_seen),
    })),
  };
}

function getBackpackEquippedCount(backpackRow: Pick<BackpackRow, "equipped_slot_groups">) {
  return backpackRow.equipped_slot_groups.length;
}

function getRoleEffectiveStats(
  role: Pick<RoleRow, "strength" | "agility" | "intelligence" | "vitality">,
  backpack: Array<Pick<BackpackRow, "equipped_slot_groups" | "stat_json">> = [],
) {
  const nextStats = {
    strength: normalizeNumber(role.strength),
    agility: normalizeNumber(role.agility),
    intelligence: normalizeNumber(role.intelligence),
    vitality: normalizeNumber(role.vitality),
  };

  backpack.forEach((item) => {
    const equippedCount = getBackpackEquippedCount(item);

    if (equippedCount <= 0) {
      return;
    }

    nextStats.strength += normalizeNumber(item.stat_json?.strength) * equippedCount;
    nextStats.agility += normalizeNumber(item.stat_json?.agility) * equippedCount;
    nextStats.intelligence += normalizeNumber(item.stat_json?.intelligence) * equippedCount;
    nextStats.vitality += normalizeNumber(item.stat_json?.vitality) * equippedCount;
  });

  return nextStats;
}

function normalizeEquippedSlotGroups(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => {
      if (!Array.isArray(group)) {
        return null;
      }

      const normalizedGroup = group
        .filter((slotKey): slotKey is string => typeof slotKey === "string" && slotKey.trim().length > 0)
        .map((slotKey) => slotKey.trim());

      return normalizedGroup.length > 0 ? normalizedGroup : null;
    })
    .filter((group): group is string[] => Boolean(group));
}

function buildBodySlotKeys(capacities: BodySlotCapacities) {
  const entries: Array<[BodySlotType, number]> = [
    ["head", capacities.head],
    ["hand", capacities.hand],
    ["torso", capacities.torso],
    ["legs", capacities.legs],
    ["feet", capacities.feet],
    ["neck", capacities.neck],
    ["accessory", capacities.accessory],
  ];

  return entries.flatMap(([slotType, count]) =>
    Array.from({ length: Math.max(0, count) }, (_, index) => `${slotType}-${index + 1}`),
  );
}

function buildAvailableBodySlotKeys(capacities: BodySlotCapacities, slotType: BodySlotType) {
  const count = Math.max(0, capacities[slotType]);
  return Array.from({ length: count }, (_, index) => `${slotType}-${index + 1}`);
}

function getBodySlotIndex(slotKey: string) {
  return Number(slotKey.split("-")[1]) || 0;
}

function allocateEquipmentSlots(
  role: Pick<RoleRow, "race_key">,
  backpack: BackpackRow[],
  item: Pick<BackpackRow, "backpack_id" | "slot" | "slot_usage" | "quantity" | "equipped_slot_groups" | "equipped">,
) {
  if (item.quantity <= getBackpackEquippedCount(item)) {
    throw new Error("这件物品已经没有可装备的数量了。");
  }

  const capacities = getBodySlotCapacities(role.race_key);
  const candidateSlotKeys = buildAvailableBodySlotKeys(capacities, item.slot);

  if (candidateSlotKeys.length < item.slot_usage) {
    throw new Error("当前种族没有足够的对应肢体槽位。");
  }

  const occupiedSlots = new Set(
    backpack.flatMap((entry) => entry.equipped_slot_groups.flatMap((group) => group)),
  );
  const freeSlots = candidateSlotKeys.filter((slotKey) => !occupiedSlots.has(slotKey));

  if (freeSlots.length >= item.slot_usage) {
    const allocatedSlots = freeSlots.slice(0, item.slot_usage);
    item.equipped_slot_groups.push(allocatedSlots);
    item.equipped = item.equipped_slot_groups.length > 0;
    return allocatedSlots;
  }

  const releasedSlots = [...freeSlots];
  const groupsToRelease: Array<{ entry: BackpackRow; group: string[] }> = [];
  const slotOwners = new Map<string, { entry: BackpackRow; group: string[] }>();

  backpack.forEach((entry) => {
    entry.equipped_slot_groups.forEach((group) => {
      if (!group.every((slotKey) => candidateSlotKeys.includes(slotKey))) {
        return;
      }

      group.forEach((slotKey) => {
        slotOwners.set(slotKey, { entry, group });
      });
    });
  });

  const candidateSlotsByPriority = [...candidateSlotKeys].sort((left, right) => getBodySlotIndex(right) - getBodySlotIndex(left));
  const markedGroups = new Set<string[]>();

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
    entry.equipped_slot_groups = entry.equipped_slot_groups.filter((group) => !groupsMarkedForRelease.has(group));
    entry.equipped = entry.equipped_slot_groups.length > 0;
  });

  const availableAfterRelease = candidateSlotKeys.filter((slotKey) => releasedSlots.includes(slotKey));
  const allocatedSlots = availableAfterRelease.slice(0, item.slot_usage);
  item.equipped_slot_groups.push(allocatedSlots);
  item.equipped = item.equipped_slot_groups.length > 0;

  return allocatedSlots;
}

function removeOneEquippedGroup(backpackItem: BackpackRow) {
  if (backpackItem.equipped_slot_groups.length === 0) {
    throw new Error("这件物品当前没有处于装备状态。");
  }

  backpackItem.equipped_slot_groups.shift();
  backpackItem.equipped = backpackItem.equipped_slot_groups.length > 0;
}

function buildRoleBodySlots(role: Pick<RoleRow, "race_key">, backpack: BackpackRow[]): RoleBodySlotView[] {
  const capacities = getBodySlotCapacities(role.race_key);
  const bodySlotKeys = buildBodySlotKeys(capacities);
  const equippedBySlotKey = new Map<string, BackpackRow>();

  for (const item of backpack) {
    for (const group of item.equipped_slot_groups) {
      for (const slotKey of group) {
        equippedBySlotKey.set(slotKey, item);
      }
    }
  }

  return bodySlotKeys.map((slotKey) => {
    const [slotType, indexText] = slotKey.split("-");
    const equippedItem = equippedBySlotKey.get(slotKey) ?? null;
    const capacity = capacities[slotType as BodySlotType];
    const baseLabel = getBodySlotTypeLabel(slotType as BodySlotType);
    const index = Number(indexText);
    const label = capacity > 1 && Number.isFinite(index)
      ? `${baseLabel} ${index}`
      : baseLabel;

    return {
      key: slotKey,
      label,
      slotType: slotType as BodySlotType,
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

function resolveEncounterRewardItems(reward: AfkEncounterReward): EncounterGrantedItem[] {
  return (reward.items ?? [])
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
        iconKey: itemSeed.iconKey,
        slot: itemSeed.slot,
        slotUsage: itemSeed.slotUsage,
        description: itemSeed.description,
        sellPrice: itemSeed.sellPrice,
        stats: itemSeed.stats,
      } satisfies EncounterGrantedItem;
    })
    .filter((item): item is EncounterGrantedItem => Boolean(item));
}

function applyEncounterItemsToBackpack(backpack: BackpackRow[], itemDrops: EncounterGrantedItem[]) {
  if (itemDrops.length === 0) {
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
      backpack_id: makeId("bag"),
      item_id: itemDrop.itemId,
      quantity: itemDrop.quantity,
      equipped: false,
      equipped_slot_groups: [],
      name: itemDrop.name,
      rarity: itemDrop.rarity,
      icon_key: itemDrop.iconKey,
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

function normalizeEncounterRewardItems(
  value: unknown,
): NonNullable<AfkEncounterReward["items"]> {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: NonNullable<AfkEncounterReward["items"]> = [];

  for (const itemReward of value) {
    if (!itemReward || typeof itemReward !== "object") {
      continue;
    }

    const quantity = normalizeNumber(itemReward.quantity);

    if (typeof itemReward.itemId !== "string" || quantity <= 0) {
      continue;
    }

    items.push({
      itemId: itemReward.itemId,
      quantity,
      name: typeof itemReward.name === "string" ? itemReward.name : undefined,
      rarity: itemReward.rarity === "white"
        || itemReward.rarity === "green"
        || itemReward.rarity === "blue"
        || itemReward.rarity === "purple"
        || itemReward.rarity === "orange"
        ? itemReward.rarity
        : undefined,
    });
  }

  return items;
}

function normalizeEncounterLog(value: unknown): AfkEncounterLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: AfkEncounterLogEntry[] = [];

  for (const entry of value) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const rewardCandidate = "reward" in entry && entry.reward && typeof entry.reward === "object"
        ? entry.reward as Partial<AfkEncounterReward>
        : null;
      const tier = "tier" in entry ? entry.tier : null;
      const triggeredAt = "triggeredAt" in entry ? Number(entry.triggeredAt) : NaN;

      if (
        typeof entry.id !== "string"
        || typeof entry.key !== "string"
        || typeof entry.title !== "string"
        || typeof entry.description !== "string"
        || (tier !== "common" && tier !== "rare" && tier !== "legendary")
        || !rewardCandidate
        || !Number.isFinite(triggeredAt)
      ) {
        continue;
      }

      entries.push({
        id: entry.id,
        key: entry.key,
        tier,
        title: entry.title,
        description: entry.description,
        reward: {
          gold: normalizeNumber(rewardCandidate.gold ?? 0),
          aetherCrystal: normalizeNumber(rewardCandidate.aetherCrystal ?? 0),
          exp: normalizeNumber(rewardCandidate.exp ?? 0),
          healthDelta: normalizeSignedNumber(rewardCandidate.healthDelta ?? 0),
          items: normalizeEncounterRewardItems(rewardCandidate.items),
        },
        triggeredAt,
      });
  }

  return entries.slice(0, MAX_RECENT_ENCOUNTERS);
}

function pickRandomEncounter(tier: EncounterTier, mapKey: string | null) {
  const pool = mapKey
    ? afkEncounterPoolByMapAndTier[mapKey]?.[tier] ?? []
    : afkEncounterPoolByMapAndTier[mapConfigs[0]?.key ?? ""]?.[tier] ?? [];

  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function resolveEncounterTierByRoll(roll: number): EncounterTier | null {
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

function buildEncounterDelta(executions: number, settledAt: number, mapKey: string | null) {
  const delta: Pick<RewardDelta, "aetherCrystal" | "encounters" | "exp" | "gold" | "itemDrops"> = {
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

    const encounter = pickRandomEncounter(tier, mapKey);

    if (!encounter) {
      continue;
    }

    const rewardItems = resolveEncounterRewardItems(encounter.reward);
    const healthDelta = normalizeSignedNumber(encounter.reward.healthDelta ?? 0);
    const reward: AfkEncounterReward = {
      gold: normalizeNumber(encounter.reward.gold),
      aetherCrystal: normalizeNumber(encounter.reward.aetherCrystal),
      exp: normalizeNumber(encounter.reward.exp),
      ...(healthDelta !== 0 ? { healthDelta } : {}),
      items: rewardItems.map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        name: item.name,
        rarity: item.rarity,
      })),
    };

    delta.gold += reward.gold;
    delta.aetherCrystal += reward.aetherCrystal;
    delta.exp += reward.exp;
    delta.itemDrops.push(...rewardItems);
    delta.encounters.push({
      id: makeId("encounter"),
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

function buildHourlyReward(mapKey: MapKey | null): RewardPreview {
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

function buildRewardForSeconds(mapKey: MapKey | null, seconds: number): RewardPreview {
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

function buildRewardDeltaForExecutions(mapKey: MapKey | null, previousExecutions: number, nextExecutions: number): RewardDelta {
  const previousSeconds = previousExecutions * AFK_TASK_SECONDS;
  const nextSeconds = nextExecutions * AFK_TASK_SECONDS;
  const previousReward = buildRewardForSeconds(mapKey, previousSeconds);
  const nextReward = buildRewardForSeconds(mapKey, nextSeconds);

  return {
    aetherCrystal: Math.max(0, nextReward.aetherCrystal - previousReward.aetherCrystal),
    encounters: [],
    exp: Math.max(0, nextReward.exp - previousReward.exp),
    itemDrops: [],
    executions: Math.max(0, nextExecutions - previousExecutions),
    gold: Math.max(0, nextReward.gold - previousReward.gold),
    seconds: Math.max(0, nextSeconds - previousSeconds),
  };
}

function getRoleMaxHealth(
  role: Pick<RoleRow, "level" | "strength" | "agility" | "intelligence" | "vitality">,
  backpack: Array<Pick<BackpackRow, "equipped_slot_groups" | "stat_json">> = [],
) {
  return getMaxHealth(getRoleEffectiveStats(role, backpack).vitality, role.level);
}

function normalizeRoleHealth(role: RoleRow, backpack: BackpackRow[] = []) {
  const maxHealth = getRoleMaxHealth(role, backpack);
  const rawHealth = Number(role.current_health);
  const nextHealth =
    Number.isFinite(rawHealth) && rawHealth > 0
      ? Math.min(maxHealth, Math.floor(rawHealth))
      : maxHealth;

  if (nextHealth === role.current_health) {
    return false;
  }

  role.current_health = nextHealth;
  return true;
}

function applyEncounterEffectsToRole(role: RoleRow, encounters: AfkEncounterLogEntry[], backpack: BackpackRow[] = []) {
  let didMutate = false;

  for (const encounter of encounters) {
    const healthDelta = normalizeSignedNumber(encounter.reward.healthDelta ?? 0);

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

function applyRewardToRole(role: RoleRow, reward: RewardDelta, backpack: BackpackRow[] = []) {
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

function applyPendingRewardToRole(role: RoleRow, afk: AfkRow, backpack: BackpackRow[] = []) {
  const pendingReward: RewardDelta = {
    aetherCrystal: afk.pending_aether_crystal,
    encounters: [],
    exp: afk.pending_exp,
    itemDrops: [],
    executions: 0,
    gold: afk.pending_gold,
    seconds: afk.accrued_seconds,
  };

  return applyRewardToRole(role, pendingReward, backpack);
}

function settleAfkState(afk: AfkRow, options?: { capSeconds?: number; now?: number }): RewardDelta {
  const now = options?.now ?? Date.now();

  const emptyReward: RewardDelta = {
    aetherCrystal: 0,
    encounters: [],
    exp: 0,
    itemDrops: [],
    executions: 0,
    gold: 0,
    seconds: 0,
  };

  if (afk.status !== "active" || !afk.map_key || !afk.last_settled_at) {
    return emptyReward;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(afk.last_settled_at).getTime()) / 1000),
  );

  if (elapsedSeconds <= 0) {
    return emptyReward;
  }

  const grantedSeconds =
    options?.capSeconds === undefined ? elapsedSeconds : Math.min(elapsedSeconds, Math.max(0, options.capSeconds));
  const previousTotalSeconds = Math.max(0, afk.accrued_seconds);
  const nextTotalSeconds = previousTotalSeconds + grantedSeconds;
  const previousExecutions = Math.floor(previousTotalSeconds / AFK_TASK_SECONDS);
  const nextExecutions = Math.floor(nextTotalSeconds / AFK_TASK_SECONDS);
  const rewardDelta = buildRewardDeltaForExecutions(afk.map_key, previousExecutions, nextExecutions);
  const encounterDelta = buildEncounterDelta(rewardDelta.executions, now, afk.map_key);

  rewardDelta.gold += encounterDelta.gold;
  rewardDelta.aetherCrystal += encounterDelta.aetherCrystal;
  rewardDelta.exp += encounterDelta.exp;
  rewardDelta.encounters = encounterDelta.encounters;
  rewardDelta.itemDrops = encounterDelta.itemDrops;
  afk.pending_gold += rewardDelta.gold;
  afk.pending_aether_crystal += rewardDelta.aetherCrystal;
  afk.pending_exp += rewardDelta.exp;
  afk.recent_encounters = [
    ...encounterDelta.encounters.slice().reverse(),
    ...normalizeEncounterLog(afk.recent_encounters),
  ].slice(0, MAX_RECENT_ENCOUNTERS);
  afk.accrued_seconds = nextTotalSeconds % AFK_TASK_SECONDS;
  afk.last_settled_at = new Date(now);

  return rewardDelta;
}

function consumePendingReward(afk: AfkRow, reward: RewardDelta) {
  afk.pending_gold = Math.max(0, afk.pending_gold - reward.gold);
  afk.pending_aether_crystal = Math.max(0, afk.pending_aether_crystal - reward.aetherCrystal);
  afk.pending_exp = Math.max(0, afk.pending_exp - reward.exp);
}

function discardCurrentTaskProgress(afk: AfkRow) {
  afk.accrued_seconds = 0;
}

async function persistRole(client: PoolClient, role: RoleRow) {
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
      role.exp_curve_version ?? LEVEL_CURVE_VERSION,
      normalizeNumber(role.gold),
      normalizeNumber(role.aether_crystal),
      normalizeNumber(role.current_health),
    ],
  );
}

async function persistAfk(client: PoolClient, afk: AfkRow) {
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
    ],
  );
}

async function persistBackpackItemRewards(client: PoolClient, roleId: string, itemDrops: EncounterGrantedItem[]) {
  if (itemDrops.length === 0) {
    return;
  }

  const itemDropsById = itemDrops.reduce<Map<string, number>>((accumulator, itemDrop) => {
    accumulator.set(itemDrop.itemId, (accumulator.get(itemDrop.itemId) ?? 0) + itemDrop.quantity);
    return accumulator;
  }, new Map());

  for (const [itemId, quantity] of itemDropsById.entries()) {
    await client.query(
      `
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, equipped_slot_groups, created_at, updated_at)
        VALUES ($1, $2, $3, $4, FALSE, '[]'::jsonb, NOW(), NOW())
        ON CONFLICT (role_id, item_id)
        DO UPDATE SET
          quantity = backpack.quantity + EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [makeId("bag"), roleId, itemId, quantity],
    );
  }
}

async function persistBackpackEquipState(client: PoolClient, backpack: BackpackRow[]) {
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
        item.equipped_slot_groups.length > 0,
        JSON.stringify(item.equipped_slot_groups),
      ],
    );
  }
}

async function upsertBackpackItemQuantity(client: PoolClient, roleId: string, itemId: string, quantity: number) {
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
    [makeId("bag"), roleId, itemId, normalizedQuantity],
  );
}

async function getMarketActiveSummaryRows() {
  const result = await query<MarketSummaryRow>(
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
          item.icon_key,
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

  return result.rows.map((row) => ({
    ...row,
    rarity: row.rarity as ItemRarity,
    slot: row.slot as BodySlotType,
    category_key: row.category_key as MarketCategoryKey,
    status: row.status as MarketListingStatus,
  }));
}

async function getMarketOwnListingRows(roleId: string) {
  const result = await query<MarketOwnListingGroupRow>(
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

  return result.rows.map((row) => ({
    ...row,
    rarity: row.rarity as ItemRarity,
    slot: row.slot as BodySlotType,
    category_key: row.category_key as MarketCategoryKey,
    status: row.status as MarketListingStatus,
  }));
}

async function getMarketSnapshotForRole(roleId: string | null) {
  const [activeListings, ownListings] = await Promise.all([
    getMarketActiveSummaryRows(),
    roleId ? getMarketOwnListingRows(roleId) : Promise.resolve([] as MarketOwnListingGroupRow[]),
  ]);

  return buildMarketSnapshot(roleId, activeListings, ownListings);
}

async function syncAfkRedis(afk: AfkRow) {
  const key = `afk:${afk.role_id}`;

  if (afk.status === "idle") {
    await deleteRedisKey(key);
    return;
  }

  await setRedisJson(key, {
    accruedSeconds: afk.accrued_seconds,
    lastSettledAt: toMillis(afk.last_settled_at),
    mapKey: afk.map_key,
    pendingAetherCrystal: afk.pending_aether_crystal,
    pendingExp: afk.pending_exp,
    pendingGold: afk.pending_gold,
    recentEncounters: normalizeEncounterLog(afk.recent_encounters),
    startedAt: toMillis(afk.started_at),
    status: afk.status,
  });
}

async function findUserByGuestToken(guestToken: string) {
  const result = await query<UserRow>(
    `
      SELECT
        user_id,
        guest_token,
        account_type,
        username,
        password_hash,
        password_salt,
        last_login_at,
        last_seen_at
      FROM "user"
      WHERE guest_token = $1
    `,
    [guestToken],
  );

  return result.rows[0] ?? null;
}

async function findUserByUsername(username: string) {
  const result = await query<UserRow>(
    `
      SELECT
        user_id,
        guest_token,
        account_type,
        username,
        password_hash,
        password_salt,
        last_login_at,
        last_seen_at
      FROM "user"
      WHERE username = $1
    `,
    [normalizeUsername(username)],
  );

  return result.rows[0] ?? null;
}

async function findRoleByUserId(userId: string) {
  const result = await query<RoleRow>(
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

  const role = result.rows[0] ?? null;

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

async function requireDashboardData(guestToken: string) {
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
    query<AfkRow>(
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
      `,
      [role.role_id],
    ),
    query<BackpackRow>(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
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
      [role.role_id],
    ),
  ]);

  const afk = afkResult.rows[0];

  if (!afk) {
    throw new Error("挂机状态不存在，请重新创建角色。");
  }

  afk.recent_encounters = normalizeEncounterLog(afk.recent_encounters);
  backpackResult.rows.forEach((item) => {
    const itemSeed = itemSeedById.get(item.item_id);
    if (itemSeed) {
      item.icon_key = itemSeed.iconKey;
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

async function deleteBackpackEntry(client: PoolClient, roleId: string, backpackId: string) {
  const result = await client.query(
    `
      DELETE FROM backpack
      WHERE role_id = $1 AND backpack_id = $2
    `,
    [roleId, backpackId],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function equipBackpackItem(guestToken: string, backpackId: string) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = backpackId.trim();

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

  return getFullSessionSnapshot(guestToken);
}

export async function unequipBackpackItem(guestToken: string, backpackId: string) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = backpackId.trim();

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

  return getFullSessionSnapshot(guestToken);
}

function buildSnapshot(data: DashboardData, options?: { shouldShowOfflineRewardModal?: boolean }): GameSessionSnapshot {
  const progress = getCurrentLevelProgress(data.role.exp);
  const currentMap = data.afk.map_key ? getMapConfig(data.afk.map_key) : null;
  const bodySlotCapacities = getBodySlotCapacities(data.role.race_key);
  const bodySlots = buildRoleBodySlots(data.role, data.backpack);
  const effectiveStats = getRoleEffectiveStats(data.role, data.backpack);
  const maxHealth = getRoleMaxHealth(data.role, data.backpack);
  const currentHealth = Math.min(maxHealth, normalizeNumber(data.role.current_health));

  return {
    serverTime: Date.now(),
    account: {
      guestToken: data.user.guest_token,
      hasRole: true,
      mode: data.user.account_type,
      username: data.user.username,
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
      equippedSlotGroups: item.equipped_slot_groups,
      name: item.name,
      rarity: item.rarity,
      iconKey: item.icon_key,
      slot: item.slot,
      slotUsage: item.slot_usage,
      description: item.description,
      sellPrice: item.sell_price,
      stats: item.stat_json ?? {},
    })),
    afk: {
      status: data.afk.status,
      mapKey: data.afk.map_key,
      startedAt: toMillis(data.afk.started_at),
      lastSettledAt: toMillis(data.afk.last_settled_at),
      shouldShowOfflineRewardModal: options?.shouldShowOfflineRewardModal ?? false,
      accruedSeconds: data.afk.accrued_seconds,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap: currentMap
        ? {
            key: currentMap.key,
            label: currentMap.label,
            summary: currentMap.summary,
            goldPerMinute: currentMap.goldPerMinute,
            aetherPerMinute: currentMap.aetherPerMinute,
            expPerMinute: currentMap.expPerMinute,
          }
        : null,
      pendingReward: {
        seconds: data.afk.accrued_seconds,
        gold: data.afk.pending_gold,
        aetherCrystal: data.afk.pending_aether_crystal,
        exp: data.afk.pending_exp,
      },
      estimatedHourlyReward: buildHourlyReward(data.afk.map_key),
      encounterRates: afkEncounterChances,
      recentEncounters: normalizeEncounterLog(data.afk.recent_encounters),
    },
    market: data.market,
  };
}

export async function loginGuest(existingGuestToken?: string | null): Promise<GuestLoginResult> {
  const guestToken = existingGuestToken?.trim() || makeId("guest");
  const existing = existingGuestToken ? await findUserByGuestToken(existingGuestToken) : null;

  if (existing) {
    await query(
      `UPDATE "user" SET last_login_at = NOW() WHERE user_id = $1`,
      [existing.user_id],
    );

    return {
      guestToken: existing.guest_token,
      hasRole: Boolean(await findRoleByUserId(existing.user_id)),
      mode: existing.account_type,
      username: existing.username,
      serverTime: Date.now(),
      userId: existing.user_id,
    };
  }

  const userId = makeId("user");

  await query(
    `
      INSERT INTO "user" (user_id, guest_token, account_type, last_login_at, last_seen_at)
      VALUES ($1, $2, 'guest', NOW(), NOW())
    `,
    [userId, guestToken],
  );

  return {
    guestToken,
    hasRole: false,
    mode: "guest",
    username: null,
    serverTime: Date.now(),
    userId,
  };
}

export async function loginAccount(input: AccountLoginInput): Promise<GuestLoginResult> {
  const normalizedUsername = validateUsername(input.username);
  validatePassword(input.password);
  const user = await findUserByUsername(normalizedUsername);

  if (
    !user
    || user.account_type !== "account"
    || !user.password_hash
    || !user.password_salt
    || !verifyPassword(input.password, user.password_hash, user.password_salt)
  ) {
    throw new Error("账号或密码错误。");
  }

  await query(
    `UPDATE "user" SET last_login_at = NOW(), last_seen_at = NOW() WHERE user_id = $1`,
    [user.user_id],
  );

  return {
    guestToken: user.guest_token,
    hasRole: Boolean(await findRoleByUserId(user.user_id)),
    mode: user.account_type,
    username: user.username,
    serverTime: Date.now(),
    userId: user.user_id,
  };
}

export async function registerGuestAccount(input: AccountRegistrationInput) {
  const normalizedUsername = validateUsername(input.username);
  validatePassword(input.password);
  const data = await requireDashboardData(input.guestToken);

  if (data.user.account_type === "account") {
    throw new Error("当前角色已经绑定账号。");
  }

  const existingUser = await findUserByUsername(normalizedUsername);

  if (existingUser) {
    throw new Error("该账号名已被占用。");
  }

  const { passwordHash, passwordSalt } = hashPassword(input.password);

  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE "user"
        SET
          account_type = 'account',
          username = $2,
          password_hash = $3,
          password_salt = $4
        WHERE user_id = $1
      `,
      [data.user.user_id, normalizedUsername, passwordHash, passwordSalt],
    );
  });

  return getFullSessionSnapshot(input.guestToken);
}

export async function deleteAccountRole(guestToken: string) {
  const data = await requireDashboardData(guestToken);

  if (data.user.account_type !== "account") {
    throw new Error("只有已注册账号可以删除角色。");
  }

  await withTransaction(async (client) => {
    await client.query(`DELETE FROM "role" WHERE user_id = $1`, [data.user.user_id]);
  });

  await deleteRedisKey(`afk:${data.role.role_id}`);
  return getGuestBootstrap(guestToken);
}

export async function createRoleForGuest(input: {
  guestToken: string;
  name: string;
  raceKey: RaceKey;
  classKey: ClassKey;
}) {
  await ensureRuntimeGameConfig();
  const race = getRaceConfig(input.raceKey);
  const roleClass = getClassConfig(input.classKey);
  const trimmedName = input.name.trim();

  if (!race || !roleClass) {
    throw new Error("种族或职业配置不存在。");
  }

  if (trimmedName.length < 2 || trimmedName.length > 12) {
    throw new Error("角色名需为 2 到 12 个字符。");
  }

  const user = await findUserByGuestToken(input.guestToken);

  if (!user) {
    throw new Error("游客会话失效，请重新登录。");
  }

  const existingRole = await findRoleByUserId(user.user_id);

  if (existingRole) {
    throw new Error("该游客账号已经创建过角色。");
  }

  const roleId = makeId("role");
  const afkId = makeId("afk");
  const now = new Date();
  const startingStats = {
    agility: race.stats.agility + roleClass.stats.agility,
    intelligence: race.stats.intelligence + roleClass.stats.intelligence,
    strength: race.stats.strength + roleClass.stats.strength,
    vitality: race.stats.vitality + roleClass.stats.vitality,
  };
  const starterItemSeed = itemSeedById.get(roleClass.starterItemId);
  const starterEquippedSlotGroup = starterItemSeed
    ? buildAvailableBodySlotKeys(getBodySlotCapacities(race.key), starterItemSeed.slot).slice(0, starterItemSeed.slotUsage)
    : [];

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO "role" (
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
          avatar_seed,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, 1, 0, $6, 240, 12, $7, $8, $9, $10, $11, $12, NOW(), NOW()
        )
      `,
      [
        roleId,
        user.user_id,
        trimmedName,
        race.key,
        roleClass.key,
        LEVEL_CURVE_VERSION,
        startingStats.strength,
        startingStats.agility,
        startingStats.intelligence,
        startingStats.vitality,
        getMaxHealth(startingStats.vitality, 1),
        trimmedName.slice(0, 1),
      ],
    );

    await client.query(
      `
        INSERT INTO afk (
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
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'idle', NULL, NULL, $3, 0, 0, 0, 0, NOW(), NOW())
      `,
      [afkId, roleId, now],
    );

    await client.query(
      `
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, equipped_slot_groups, created_at, updated_at)
        VALUES
          ($1, $4, $2, 1, $6, $7::jsonb, NOW(), NOW()),
          ($3, $4, 'forest-cloak', 1, FALSE, '[]'::jsonb, NOW(), NOW()),
          ($5, $4, 'traveler-ring', 1, FALSE, '[]'::jsonb, NOW(), NOW())
      `,
      [
        makeId("bag"),
        roleClass.starterItemId,
        makeId("bag"),
        roleId,
        makeId("bag"),
        starterEquippedSlotGroup.length > 0,
        JSON.stringify(starterEquippedSlotGroup.length > 0 ? [starterEquippedSlotGroup] : []),
      ],
    );

  });

  return getFullSessionSnapshot(input.guestToken);
}

export async function getGuestBootstrap(
  guestToken?: string | null,
  options?: { forceOfflineSettlement?: boolean },
) {
  await ensureRuntimeGameConfig();
  const loginResult = await loginGuest(guestToken);

  if (!loginResult.hasRole) {
    return {
      account: {
        guestToken: loginResult.guestToken,
        hasRole: false,
        mode: loginResult.mode,
        username: loginResult.username,
        userId: loginResult.userId,
      },
      afk: {
        status: "idle" as const,
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
        estimatedHourlyReward: {
          seconds: 3600,
          gold: 0,
          aetherCrystal: 0,
          exp: 0,
        },
        encounterRates: afkEncounterChances,
        recentEncounters: [],
      },
      market: await getMarketSnapshotForRole(null),
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

  return getFullSessionSnapshot(loginResult.guestToken, options);
}

export async function getFullSessionSnapshot(
  guestToken: string,
  options?: { forceOfflineSettlement?: boolean },
) {
  await ensureRuntimeGameConfig();
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline =
    options?.forceOfflineSettlement === true
    || now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: wasOffline ? MAX_OFFLINE_SECONDS : undefined,
    now,
  });
  const didApplyEncounterEffects = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack);
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);
  const didAutoSettleReward = applyRewardToRole(data.role, rewardDelta, data.backpack);

  if (didAutoSettleReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  await withTransaction(async (client) => {
    await client.query(`UPDATE "user" SET last_seen_at = NOW() WHERE user_id = $1`, [data.user.user_id]);
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didAutoSettleReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal: false });
}

export async function startAfk(guestToken: string, mapKey: MapKey) {
  await ensureRuntimeGameConfig();
  const map = getMapConfig(mapKey);

  if (!map) {
    throw new ApiError("地图不存在。", 404);
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, { now });

  if (data.afk.status === "active") {
    throw new ApiError("当前已经处于挂机中，请先停止。", 409);
  }

  data.afk.status = "active";
  data.afk.map_key = mapKey;
  data.afk.started_at = new Date(now);
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function stopAfk(guestToken: string) {
  await ensureRuntimeGameConfig();
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, { now });

  if (data.afk.status === "idle") {
    return buildSnapshot(data);
  }

  const didApplyEncounterEffects = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack);
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);
  const didApplyReward = applyRewardToRole(data.role, rewardDelta, data.backpack);

  if (didApplyReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  data.afk.status = "idle";
  data.afk.last_settled_at = new Date(now);
  discardCurrentTaskProgress(data.afk);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function claimAfkReward(guestToken: string) {
  await ensureRuntimeGameConfig();
  const data = await requireDashboardData(guestToken);
  const didNormalizeRoleHealth = normalizeRoleHealth(data.role, data.backpack);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: MAX_OFFLINE_SECONDS,
    now,
  });
  const didApplyEncounterEffects = applyEncounterEffectsToRole(data.role, rewardDelta.encounters, data.backpack);
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);

  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;

  const didApplyOnlineReward = !wasOffline && applyRewardToRole(data.role, rewardDelta, data.backpack);

  if (didApplyOnlineReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  if (
    data.afk.pending_gold <= 0 &&
    data.afk.pending_aether_crystal <= 0 &&
    data.afk.pending_exp <= 0
  ) {
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyOnlineReward || didApplyEncounterItems) {
      await withTransaction(async (client) => {
        if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyOnlineReward) {
          await persistRole(client, data.role);
        }
        if (didApplyEncounterItems) {
          await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
        }
        await persistAfk(client, data.afk);
      });
      await syncAfkRedis(data.afk);
    }
    return buildSnapshot(data);
  }

  const didClaimPendingReward = applyPendingRewardToRole(data.role, data.afk, data.backpack);
  data.afk.pending_gold = 0;
  data.afk.pending_aether_crystal = 0;
  data.afk.pending_exp = 0;
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    if (didNormalizeRoleHealth || didApplyEncounterEffects || didApplyOnlineReward || didClaimPendingReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function dropBackpackItem(guestToken: string, backpackId: string) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = backpackId.trim();

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

  return getFullSessionSnapshot(guestToken);
}

export async function createMarketListing(guestToken: string, backpackId: string, price: number, quantity: number) {
  await ensureRuntimeGameConfig();
  const normalizedBackpackId = backpackId.trim();
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

  if (matchedItem.quantity <= (matchedItem.equipped_slot_groups?.length ?? 0)) {
    throw new Error("这件物品没有可上架的剩余数量。");
  }

  await withTransaction(async (client) => {
    const roleResult = await client.query<RoleRow>(
      `
        SELECT
          role_id,
          user_id,
          name,
          race_key,
          class_key,
          level,
          exp,
          gold,
          aether_crystal,
          strength,
          agility,
          intelligence,
          vitality,
          current_health,
          avatar_seed
        FROM "role"
        WHERE role_id = $1
        FOR UPDATE
      `,
      [data.role.role_id],
    );
    const lockedRole = roleResult.rows[0];

    if (!lockedRole) {
      throw new Error("角色不存在，请先创建角色。");
    }

    const backpackResult = await client.query<BackpackRow>(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          backpack.equipped_slot_groups,
          item.name,
          item.rarity,
          item.icon_key,
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
      [lockedRole.role_id, normalizedBackpackId],
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
      const deleted = await deleteBackpackEntry(client, lockedRole.role_id, lockedBackpackItem.backpack_id);

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
        [lockedBackpackItem.backpack_id, lockedRole.role_id, normalizedQuantity],
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
        [makeId("listing"), lockedRole.role_id, lockedBackpackItem.item_id, normalizedPrice],
      );
    }
  });

  return getFullSessionSnapshot(guestToken);
}

export async function cancelMarketListing(guestToken: string, listingId: string) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = listingId.trim();

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query<MarketListingRow>(
      `
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
          item.stat_json
        FROM market_listing
        JOIN item ON item.item_id = market_listing.item_id
        JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
        WHERE market_listing.listing_id = $1
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

    const siblingResult = await client.query<{ listing_count: number }>(
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
    const listingCount = normalizeNumber(siblingResult.rows[0]?.listing_count ?? 0);

    await client.query(
      `
        UPDATE market_listing
        SET
          status = 'cancelled',
          cancelled_at = NOW(),
          updated_at = NOW()
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

  return getFullSessionSnapshot(guestToken);
}

export async function dismissMarketSoldNotification(guestToken: string, listingId: string) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = listingId.trim();

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query<MarketListingRow>(
      `
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
          market_listing.seller_notice_seen,
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
          item.stat_json
        FROM market_listing
        JOIN item ON item.item_id = market_listing.item_id
        JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
        WHERE market_listing.listing_id = $1
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

  return getFullSessionSnapshot(guestToken);
}

export async function buyMarketListing(guestToken: string, listingId: string) {
  await ensureRuntimeGameConfig();
  const normalizedListingId = listingId.trim();

  if (!normalizedListingId) {
    throw new Error("缺少市场挂单标识。");
  }

  const data = await requireDashboardData(guestToken);

  await withTransaction(async (client) => {
    const listingResult = await client.query<MarketListingRow>(
      `
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
          item.stat_json
        FROM market_listing
        JOIN item ON item.item_id = market_listing.item_id
        JOIN "role" AS seller_role ON seller_role.role_id = market_listing.seller_role_id
        WHERE market_listing.listing_id = $1
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

    const cheapestResult = await client.query<{ listing_id: string }>(
      `
        SELECT listing_id
        FROM market_listing
        WHERE item_id = $1 AND status = 'active'
        ORDER BY price ASC, created_at ASC, listing_id ASC
        LIMIT 1
      `,
      [listing.item_id],
    );
    const cheapestListingId = cheapestResult.rows[0]?.listing_id ?? null;

    if (cheapestListingId !== listing.listing_id) {
      throw new Error("当前只能购买这件商品中最便宜的那一件。");
    }

    const [buyerRoleResult, sellerAfkResult] = await Promise.all([
      client.query<RoleRow>(
        `
          SELECT
            role_id,
            user_id,
            name,
            race_key,
            class_key,
            level,
            exp,
            gold,
            aether_crystal,
            strength,
            agility,
            intelligence,
            vitality,
            current_health,
            avatar_seed
          FROM "role"
          WHERE role_id = $1
          FOR UPDATE
        `,
        [data.role.role_id],
      ),
      client.query<AfkRow>(
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
    const sellerAfk = sellerAfkResult.rows[0];

    if (!buyerRole || !sellerAfk) {
      throw new Error("交易角色不存在，请稍后重试。");
    }

    if (buyerRole.gold < listing.price) {
      throw new Error("金币不足，无法购买这件商品。");
    }

    const { feeAmount, sellerReceiveAmount } = calculateMarketFee(listing.price);
    buyerRole.gold -= listing.price;
    sellerAfk.pending_gold += sellerReceiveAmount;

    await persistRole(client, buyerRole);
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

  return getFullSessionSnapshot(guestToken);
}

export function getCreateRoleOptions() {
  return {
    classes: classConfigs,
    races: raceConfigs,
  };
}

export function isValidRaceKey(value: string): value is RaceKey {
  return raceConfigs.some((item) => item.key === value);
}

export function isValidClassKey(value: string): value is ClassKey {
  return classConfigs.some((item) => item.key === value);
}

export function isValidMapKey(value: string): value is MapKey {
  return mapConfigs.some((item) => item.key === value);
}

export function getLevelOverview() {
  return {
    expPerLevel: EXP_PER_LEVEL,
    expGrowthPerLevel: EXP_GROWTH_PER_LEVEL,
    curveVersion: LEVEL_CURVE_VERSION,
    levelCap: levelTable.length,
    levels: levelTable,
  };
}
