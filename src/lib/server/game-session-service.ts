import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import {
  AFK_TASK_SECONDS,
  afkEncounterChances,
  afkEncounterPool,
  classConfigs,
  EXP_PER_LEVEL,
  getClassConfig,
  getCurrentLevelProgress,
  getLevelFromExp,
  getMapConfig,
  getRaceConfig,
  levelTable,
  mapConfigs,
  MAX_OFFLINE_SECONDS,
  raceConfigs,
  type AfkEncounterConfig,
  type AfkEncounterReward,
  type ClassKey,
  type EncounterTier,
  type ItemRarity,
  type MapKey,
  type RaceKey,
} from "@/lib/game-config";
import { query, withTransaction } from "@/lib/server/db";
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
  gold: number;
  aether_crystal: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
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
  name: string;
  rarity: string;
  slot: string;
  description: string;
  sell_price: number;
  stat_json: Record<string, number>;
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
  slot: string;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
};

type EncounterGrantedItem = {
  itemId: string;
  quantity: number;
  name: string;
  rarity: ItemRarity;
  slot: string;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
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
    gold: number;
    aetherCrystal: number;
    avatarSeed: string;
    stats: {
      strength: number;
      agility: number;
      intelligence: number;
      vitality: number;
    };
  };
  backpack: Array<{
    backpackId: string;
    itemId: string;
    quantity: number;
    equipped: boolean;
    name: string;
    rarity: string;
    slot: string;
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

const OFFLINE_MODAL_THRESHOLD_MS = 45 * 1000;
const MAX_RECENT_ENCOUNTERS = 8;
const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 20;
const itemSeeds: ItemSeed[] = [
  { itemId: "rusty-blade", name: "生锈短剑", rarity: "white", slot: "weapon", description: "开荒时勉强能用的短剑。", sellPrice: 12, stats: { strength: 2 } },
  { itemId: "oak-staff", name: "橡木法杖", rarity: "white", slot: "weapon", description: "粗糙的入门法杖，适合法师起步。", sellPrice: 12, stats: { intelligence: 2 } },
  { itemId: "field-hoe", name: "旧铁锄", rarity: "white", slot: "weapon", description: "农活与近身防卫两不误的旧工具。", sellPrice: 10, stats: { vitality: 1, agility: 1 } },
  { itemId: "forest-cloak", name: "林地披风", rarity: "green", slot: "armor", description: "轻便耐磨，适合野外挂机。", sellPrice: 30, stats: { agility: 2, vitality: 1 } },
  { itemId: "traveler-ring", name: "旅者戒指", rarity: "green", slot: "accessory", description: "会在冒险者启程时发放的基础指环。", sellPrice: 36, stats: { strength: 1, intelligence: 1, vitality: 1 } },
  { itemId: "training-bow", name: "练习短弓", rarity: "white", slot: "weapon", description: "拉力一般，但足够让新手学会瞄准与走位。", sellPrice: 18, stats: { agility: 2 } },
  { itemId: "leather-cap", name: "皮质便帽", rarity: "white", slot: "armor", description: "不起眼的小帽子，能挡一点风沙与碎石。", sellPrice: 14, stats: { vitality: 1, agility: 1 } },
  { itemId: "scout-bracers", name: "斥候护腕", rarity: "white", slot: "accessory", description: "轻量护腕，让抬手与闪避动作更利落。", sellPrice: 16, stats: { agility: 1, intelligence: 1 } },
  { itemId: "bronze-longsword", name: "青铜长剑", rarity: "green", slot: "weapon", description: "保养得当的军用品，劈砍手感远胜生锈短剑。", sellPrice: 48, stats: { strength: 3, vitality: 1 } },
  { itemId: "whisper-wand", name: "低语木杖", rarity: "green", slot: "weapon", description: "杖身会在夜里发出轻鸣，能稳定初阶法术。", sellPrice: 46, stats: { intelligence: 3, agility: 1 } },
  { itemId: "hunter-leathers", name: "猎人皮甲", rarity: "green", slot: "armor", description: "柔韧结实，适合长时间追踪与奔行。", sellPrice: 54, stats: { agility: 2, vitality: 2 } },
  { itemId: "amber-charm", name: "琥珀护符", rarity: "green", slot: "accessory", description: "封着温热树脂的护符，能让心神更稳定。", sellPrice: 52, stats: { intelligence: 2, vitality: 1 } },
  { itemId: "moonshadow-dagger", name: "月影短匕", rarity: "blue", slot: "weapon", description: "刀锋轻薄如月光，适合迅捷而精准的出手。", sellPrice: 96, stats: { agility: 4, intelligence: 1 } },
  { itemId: "runic-vest", name: "符纹战衣", rarity: "blue", slot: "armor", description: "内衬刻着细密符纹，兼顾防护与法感引导。", sellPrice: 104, stats: { intelligence: 3, vitality: 2 } },
  { itemId: "wolfbone-talisman", name: "狼骨符坠", rarity: "blue", slot: "accessory", description: "粗犷却实用的护符，佩戴后胆气更足。", sellPrice: 98, stats: { strength: 2, agility: 2 } },
  { itemId: "stormglass-staff", name: "风暴晶杖", rarity: "purple", slot: "weapon", description: "杖芯封着风暴碎晶，能显著放大施法者感知。", sellPrice: 188, stats: { intelligence: 5, agility: 2 } },
  { itemId: "knightwatch-mail", name: "守夜骑士甲", rarity: "purple", slot: "armor", description: "历经修补的厚重甲胄，仍保留着可靠的守护感。", sellPrice: 210, stats: { strength: 3, vitality: 5 } },
  { itemId: "dawnfire-pendant", name: "晨焰坠饰", rarity: "orange", slot: "accessory", description: "内部像封着一缕朝阳，能同时提振体魄与精神。", sellPrice: 320, stats: { strength: 2, intelligence: 3, vitality: 3 } },
];
const itemSeedById = new Map(itemSeeds.map((item) => [item.itemId, item]));
const afkEncounterPoolByTier = afkEncounterPool.reduce<Record<EncounterTier, AfkEncounterConfig[]>>(
  (accumulator, encounter) => {
    accumulator[encounter.tier].push(encounter);
    return accumulator;
  },
  {
    common: [],
    rare: [],
    legendary: [],
  },
);

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
    if (left.equipped !== right.equipped) {
      return left.equipped ? -1 : 1;
    }

    const rarityDelta = getRarityRank(right.rarity) - getRarityRank(left.rarity);

    if (rarityDelta !== 0) {
      return rarityDelta;
    }

    return left.name.localeCompare(right.name, "zh-CN");
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
        slot: itemSeed.slot,
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
      name: itemDrop.name,
      rarity: itemDrop.rarity,
      slot: itemDrop.slot,
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
          items: normalizeEncounterRewardItems(rewardCandidate.items),
        },
        triggeredAt,
      });
  }

  return entries.slice(0, MAX_RECENT_ENCOUNTERS);
}

function pickRandomEncounter(tier: EncounterTier) {
  const pool = afkEncounterPoolByTier[tier];

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

function buildEncounterDelta(executions: number, settledAt: number) {
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

    const encounter = pickRandomEncounter(tier);

    if (!encounter) {
      continue;
    }

    const rewardItems = resolveEncounterRewardItems(encounter.reward);
    const reward: AfkEncounterReward = {
      gold: normalizeNumber(encounter.reward.gold),
      aetherCrystal: normalizeNumber(encounter.reward.aetherCrystal),
      exp: normalizeNumber(encounter.reward.exp),
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

function applyRewardToRole(role: RoleRow, reward: RewardDelta) {
  if (reward.gold <= 0 && reward.aetherCrystal <= 0 && reward.exp <= 0) {
    return false;
  }

  role.gold += reward.gold;
  role.aether_crystal += reward.aetherCrystal;
  role.exp += reward.exp;
  role.level = getLevelFromExp(role.exp);
  return true;
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
  const encounterDelta = buildEncounterDelta(rewardDelta.executions, now);

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
        gold = $4,
        aether_crystal = $5,
        updated_at = NOW()
      WHERE role_id = $1
    `,
    [
      role.role_id,
      role.level,
      normalizeNumber(role.exp),
      normalizeNumber(role.gold),
      normalizeNumber(role.aether_crystal),
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
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, created_at, updated_at)
        VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
        ON CONFLICT (role_id, item_id)
        DO UPDATE SET
          quantity = backpack.quantity + EXCLUDED.quantity,
          updated_at = NOW()
      `,
      [makeId("bag"), roleId, itemId, quantity],
    );
  }
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
        gold,
        aether_crystal,
        strength,
        agility,
        intelligence,
        vitality,
        avatar_seed
      FROM "role"
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

async function requireDashboardData(guestToken: string) {
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
          item.name,
          item.rarity,
          item.slot,
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

  return {
    afk,
    backpack: backpackResult.rows,
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

function buildSnapshot(data: DashboardData, options?: { shouldShowOfflineRewardModal?: boolean }): GameSessionSnapshot {
  const progress = getCurrentLevelProgress(data.role.exp);
  const currentMap = data.afk.map_key ? getMapConfig(data.afk.map_key) : null;

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
      gold: data.role.gold,
      aetherCrystal: data.role.aether_crystal,
      avatarSeed: data.role.avatar_seed,
      stats: {
        strength: data.role.strength,
        agility: data.role.agility,
        intelligence: data.role.intelligence,
        vitality: data.role.vitality,
      },
    },
    backpack: data.backpack.map((item) => ({
      backpackId: item.backpack_id,
      itemId: item.item_id,
      quantity: item.quantity,
      equipped: item.equipped,
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
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
          gold,
          aether_crystal,
          strength,
          agility,
          intelligence,
          vitality,
          avatar_seed,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, 1, 0, 240, 12, $6, $7, $8, $9, $10, NOW(), NOW()
        )
      `,
      [
        roleId,
        user.user_id,
        trimmedName,
        race.key,
        roleClass.key,
        startingStats.strength,
        startingStats.agility,
        startingStats.intelligence,
        startingStats.vitality,
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
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, created_at, updated_at)
        VALUES
          ($1, $4, $2, 1, TRUE, NOW(), NOW()),
          ($3, $4, 'forest-cloak', 1, FALSE, NOW(), NOW()),
          ($5, $4, 'traveler-ring', 1, FALSE, NOW(), NOW())
      `,
      [
        makeId("bag"),
        roleClass.starterItemId,
        makeId("bag"),
        roleId,
        makeId("bag"),
      ],
    );

  });

  return getFullSessionSnapshot(input.guestToken);
}

export async function getGuestBootstrap(guestToken?: string | null) {
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

  return getFullSessionSnapshot(loginResult.guestToken);
}

export async function getFullSessionSnapshot(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: wasOffline ? MAX_OFFLINE_SECONDS : undefined,
    now,
  });
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);

  const didAutoSettleOnlineReward = !wasOffline && applyRewardToRole(data.role, rewardDelta);

  if (didAutoSettleOnlineReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  const shouldShowOfflineRewardModal =
    wasOffline &&
    (data.afk.pending_gold > 0 || data.afk.pending_aether_crystal > 0 || data.afk.pending_exp > 0);

  await withTransaction(async (client) => {
    await client.query(`UPDATE "user" SET last_seen_at = NOW() WHERE user_id = $1`, [data.user.user_id]);
    if (didAutoSettleOnlineReward) {
      await persistRole(client, data.role);
    }
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal });
}

export async function startAfk(guestToken: string, mapKey: MapKey) {
  const map = getMapConfig(mapKey);

  if (!map) {
    throw new Error("地图不存在。");
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, { now });

  if (data.afk.status === "active") {
    throw new Error("当前已经处于挂机中，请先停止。");
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
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, { now });

  if (data.afk.status === "idle") {
    return buildSnapshot(data);
  }

  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);

  if (applyRewardToRole(data.role, rewardDelta)) {
    consumePendingReward(data.afk, rewardDelta);
  }

  data.afk.status = "idle";
  data.afk.last_settled_at = new Date(now);
  discardCurrentTaskProgress(data.afk);

  await withTransaction(async (client) => {
    await persistRole(client, data.role);
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function claimAfkReward(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: MAX_OFFLINE_SECONDS,
    now,
  });
  const didApplyEncounterItems = applyEncounterItemsToBackpack(data.backpack, rewardDelta.itemDrops);

  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;

  if (!wasOffline && applyRewardToRole(data.role, rewardDelta)) {
    consumePendingReward(data.afk, rewardDelta);
  }

  if (
    data.afk.pending_gold <= 0 &&
    data.afk.pending_aether_crystal <= 0 &&
    data.afk.pending_exp <= 0
  ) {
    if (didApplyEncounterItems) {
      await withTransaction(async (client) => {
        await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
        await persistAfk(client, data.afk);
      });
      await syncAfkRedis(data.afk);
    }
    return buildSnapshot(data);
  }

  data.role.gold += data.afk.pending_gold;
  data.role.aether_crystal += data.afk.pending_aether_crystal;
  data.role.exp += data.afk.pending_exp;
  data.role.level = getLevelFromExp(data.role.exp);
  data.afk.pending_gold = 0;
  data.afk.pending_aether_crystal = 0;
  data.afk.pending_exp = 0;
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistRole(client, data.role);
    if (didApplyEncounterItems) {
      await persistBackpackItemRewards(client, data.role.role_id, rewardDelta.itemDrops);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function dropBackpackItem(guestToken: string, backpackId: string) {
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
    levelCap: levelTable.length,
    levels: levelTable,
  };
}
