import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import {
  EXP_GROWTH_PER_LEVEL,
  EXP_PER_LEVEL,
  getExpRequiredForLevel,
  getLevelBaseExp,
  getLevelFromExp,
  getMaxHealth,
  LEVEL_CURVE_VERSION,
  classConfigs as defaultClassConfigs,
  mapConfigs as defaultMapConfigs,
  raceConfigs as defaultRaceConfigs,
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
  getLevelTable,
  refreshRuntimeGameConfig,
  type RuntimeItemSeed,
} from "@/lib/server/dynamic-game-config";
import { ApiError } from "@/lib/server/http";
import { deleteRedisKey } from "@/lib/server/redis";
import { normalizeNonNegativeInteger } from "../../../shared/domain/economy";

const require = createRequire(import.meta.url);

type SharedGameService = {
  buyMarketListingForGuest: (guestToken: string, listingId: string) => Promise<GameSessionSnapshot>;
  cancelMarketListingForGuest: (guestToken: string, listingId: string) => Promise<GameSessionSnapshot>;
  claimAfkRewardForGuest: (guestToken: string) => Promise<GameSessionSnapshot>;
  createMarketListingForGuest: (
    guestToken: string,
    backpackId: string,
    price: number,
    quantity: number,
  ) => Promise<GameSessionSnapshot>;
  dismissMarketSoldNotificationForGuest: (guestToken: string, listingId: string) => Promise<GameSessionSnapshot>;
  dropBackpackItemForGuest: (guestToken: string, backpackId: string) => Promise<GameSessionSnapshot>;
  equipBackpackItemForGuest: (guestToken: string, backpackId: string) => Promise<GameSessionSnapshot>;
  getSessionSnapshot: (
    guestToken: string,
    options?: { forceOfflineSettlement?: boolean },
  ) => Promise<GameSessionSnapshot>;
  startAfkForGuest: (guestToken: string, mapKey: string) => Promise<GameSessionSnapshot>;
  stopAfkForGuest: (guestToken: string) => Promise<GameSessionSnapshot>;
  unequipBackpackItemForGuest: (guestToken: string, backpackId: string) => Promise<GameSessionSnapshot>;
};

const sharedGameService = require("../../../server/game-service") as SharedGameService;

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
  item_type?: "equipment" | "skill_book" | "material";
  skill_key?: string | null;
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
type MarketCategoryKey = "equipment" | "skill_book" | "material";

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

type SecondaryStats = {
  critChance: number;
  critDamage: number;
  dodgeChance: number;
  blockChance: number;
  blockDamageReduction: number;
  healthRegenRate: number;
};

type SkillSlotsSummary = {
  total: number;
  used: number;
  remaining: number;
};

type EquippedSkillEntry = {
  key: string;
  name: string;
  iconText: string;
  description: string;
  category: "attack" | "spell" | "guard";
  level: number;
  quality: "white" | "green" | "blue" | "purple" | "orange";
  acquisitionHint: string;
  trigger: string;
};

type LearnedSkillEntry = EquippedSkillEntry & {
  equipped: boolean;
};

type SkillBookEntry = {
  skillKey: string;
  skillName: string;
  iconText: string;
  description: string;
  quality: "white" | "green" | "blue" | "purple" | "orange";
  acquisitionHint: string;
  acquiredAt: number;
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
    secondaryStats: SecondaryStats;
    skillSlots: SkillSlotsSummary;
    battleSkillUseLimit: number;
    equippedSkills: EquippedSkillEntry[];
    learnedSkills: LearnedSkillEntry[];
    skillBooks: SkillBookEntry[];
    bodySlotCapacities: BodySlotCapacities;
    bodySlots: RoleBodySlotView[];
  };
  backpack: Array<{
    backpackId: string;
    itemId: string;
    itemType: "equipment" | "skill_book" | "material";
    skillKey: string | null;
    iconKey: string | null;
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
    battle: null;
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
const MAX_RECENT_ENCOUNTERS = 8;
const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 20;
let MARKET_FEE_RATE_PERCENT = 10;
const MARKET_CATEGORY_OPTIONS = [
  { key: "equipment", label: "装备" },
  { key: "skill_book", label: "技能书" },
  { key: "material", label: "材料" },
] as const satisfies Array<{
  key: MarketCategoryKey;
  label: string;
}>;
let itemSeeds: ItemSeed[] = [];
let itemSeedById = new Map<string, ItemSeed>();
let classConfigs: ClassConfig[] = defaultClassConfigs;
let mapConfigs: MapConfig[] = defaultMapConfigs;
let raceConfigs: RaceConfig[] = defaultRaceConfigs;

applyRuntimeConfig({
  afkEncounterChances: { common: 0, legendary: 0, rare: 0 },
  afkEncounterPool: [],
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

function getBodySlotCapacities(raceKey: string) {
  return getBodySlotCapacitiesFromRace(raceKey, raceConfigs);
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
    throw new ApiError("账号需为 4 到 20 位，仅支持字母、数字和下划线。", 400);
  }

  return normalizedUsername;
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 64) {
    throw new ApiError("密码需为 6 到 64 个字符。", 400);
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
  return normalizeNonNegativeInteger(value);
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

function buildAvailableBodySlotKeys(capacities: BodySlotCapacities, slotType: BodySlotType) {
  const count = Math.max(0, capacities[slotType]);
  return Array.from({ length: count }, (_, index) => `${slotType}-${index + 1}`);
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
    throw new ApiError("游客会话不存在，请重新登录。", 401);
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw new ApiError("角色不存在，请先创建角色。", 404);
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
      [role.role_id],
    ),
  ]);

  const afk = afkResult.rows[0];

  if (!afk) {
    throw new ApiError("挂机状态不存在，请重新创建角色。", 404);
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

export async function equipBackpackItem(guestToken: string, backpackId: string) {
  return sharedGameService.equipBackpackItemForGuest(guestToken, backpackId);
}

export async function unequipBackpackItem(guestToken: string, backpackId: string) {
  return sharedGameService.unequipBackpackItemForGuest(guestToken, backpackId);
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
    throw new ApiError("账号或密码错误。", 401);
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
    throw new ApiError("当前角色已经绑定账号。", 409);
  }

  const existingUser = await findUserByUsername(normalizedUsername);

  if (existingUser) {
    throw new ApiError("该账号名已被占用。", 409);
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
    throw new ApiError("只有已注册账号可以删除角色。", 403);
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
    throw new ApiError("种族或职业配置不存在。", 404);
  }

  if (trimmedName.length < 2 || trimmedName.length > 12) {
    throw new ApiError("角色名需为 2 到 12 个字符。", 400);
  }

  const user = await findUserByGuestToken(input.guestToken);

  if (!user) {
    throw new ApiError("游客会话失效，请重新登录。", 401);
  }

  const existingRole = await findRoleByUserId(user.user_id);

  if (existingRole) {
    throw new ApiError("该游客账号已经创建过角色。", 409);
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
  const loginResult = await loginGuest(guestToken);
  return sharedGameService.getSessionSnapshot(loginResult.guestToken, options);
}

export async function getFullSessionSnapshot(
  guestToken: string,
  options?: { forceOfflineSettlement?: boolean },
) {
  return sharedGameService.getSessionSnapshot(guestToken, options);
}

export async function startAfk(guestToken: string, mapKey: MapKey) {
  return sharedGameService.startAfkForGuest(guestToken, mapKey);
}

export async function stopAfk(guestToken: string) {
  return sharedGameService.stopAfkForGuest(guestToken);
}

export async function claimAfkReward(guestToken: string) {
  return sharedGameService.claimAfkRewardForGuest(guestToken);
}

export async function dropBackpackItem(guestToken: string, backpackId: string) {
  return sharedGameService.dropBackpackItemForGuest(guestToken, backpackId);
}

export async function createMarketListing(guestToken: string, backpackId: string, price: number, quantity: number) {
  return sharedGameService.createMarketListingForGuest(guestToken, backpackId, price, quantity);
}

export async function cancelMarketListing(guestToken: string, listingId: string) {
  return sharedGameService.cancelMarketListingForGuest(guestToken, listingId);
}

export async function dismissMarketSoldNotification(guestToken: string, listingId: string) {
  return sharedGameService.dismissMarketSoldNotificationForGuest(guestToken, listingId);
}

export async function buyMarketListing(guestToken: string, listingId: string) {
  return sharedGameService.buyMarketListingForGuest(guestToken, listingId);
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
