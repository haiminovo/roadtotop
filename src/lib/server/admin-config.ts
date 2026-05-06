import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type {
  AfkEncounterConfig,
  BodySlotCapacities,
  BodySlotType,
  ClassConfig,
  EncounterTier,
  MapConfig,
  RaceConfig,
} from "@/lib/game-config";
import {
  AFK_TASK_SECONDS,
  BASE_HEALTH,
  classConfigs as defaultClassConfigs,
  DEFAULT_BODY_SLOT_CAPACITIES,
  EXP_GROWTH_PER_LEVEL,
  EXP_PER_LEVEL,
  getBodySlotTypeLabel,
  getLevelBaseExp,
  HEALTH_PER_LEVEL,
  HEALTH_PER_VITALITY,
  LEVEL_CAP,
  LEVEL_CURVE_VERSION,
  mapConfigs as defaultMapConfigs,
  MAX_OFFLINE_SECONDS,
  raceConfigs as defaultRaceConfigs,
} from "@/lib/game-config";
import type { Stats } from "@/lib/game-config";
import { query, withTransaction } from "@/lib/server/db";

type ConfigRow = {
  config_key: string;
  config_type: string;
  value: unknown;
  updated_at: Date;
};

export type BattleEnemyTemplate = {
  key: string;
  mapKeys?: string[];
  name: string;
  summary: string;
  skillCaps: {
    guard: number;
    spell: number;
  };
  statWeights: {
    strength: number;
    agility: number;
    intelligence: number;
    vitality: number;
  };
};

export type SystemBalanceConfig = {
  marketFeeRatePercent: number;
  battleTriggerChance: number;
  actionBarTarget: number;
  playerHealRatio: number;
  playerGuardRatio: number;
  enemyHealRatio: number;
  enemyGuardRatio: number;
  spellBaseChance: number;
  intelligenceSpellBonusThreshold: number;
  executionRewardTickSeconds: number;
  playerGuardHealthThreshold: number;
  enemyGuardHealthThreshold: number;
  playerGuardCooldownTurns: number;
  enemyGuardCooldownTurns: number;
};

export type DynamicGameConfig = {
  afkEncounterChances: Record<EncounterTier, number>;
  afkEncounterPool: AfkEncounterConfig[];
  battleEnemyTemplates: BattleEnemyTemplate[];
  classConfigs: ClassConfig[];
  itemCatalog: Array<{
    itemId: string;
    name: string;
    rarity: string;
    slot: BodySlotType;
    slotUsage: number;
    description: string;
    sellPrice: number;
    stats: Record<string, number>;
  }>;
  levelTable: Array<{ level: number; totalExpRequired: number }>;
  mapConfigs: MapConfig[];
  raceConfigs: RaceConfig[];
  systemBalance: SystemBalanceConfig;
};

export type AdminRoleRecord = {
  roleId: string;
  userId: string;
  name: string;
  raceKey: string;
  classKey: string;
  level: number;
  exp: number;
  gold: number;
  aetherCrystal: number;
  currentHealth: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  avatarSeed: string;
  username: string | null;
  accountType: string;
  updatedAt: number | null;
};

export type AdminAccountRecord = {
  userId: string;
  guestToken: string;
  accountType: "guest" | "account";
  username: string | null;
  hasPassword: boolean;
  roleId: string | null;
  roleName: string | null;
  createdAt: number | null;
  lastLoginAt: number | null;
  lastSeenAt: number | null;
};

export type AdminAccountUpsertInput = {
  userId?: string;
  guestToken?: string;
  accountType: "guest" | "account";
  username?: string | null;
  password?: string;
};

export type AdminConfigFieldErrors = Partial<Record<keyof Omit<DynamicGameConfig, "levelTable">, string[]>>;

const DEFAULT_AFK_ENCOUNTER_CHANCES: Record<EncounterTier, number> = {
  common: 0.1,
  rare: 0.01,
  legendary: 0.001,
};

const DEFAULT_AFK_ENCOUNTER_POOL: AfkEncounterConfig[] = [
  {
    key: "wanderer-cache",
    mapKeys: ["palmia-wilds"],
    tier: "common",
    title: "拾荒者的暗袋",
    description: "你在枯树根下翻出一只旧布袋，却被藏着的铁夹划伤了手，好在还能顺走一点物资。",
    reward: { gold: 28, aetherCrystal: 0, exp: 8, healthDelta: -10, items: [{ itemId: "scout-bracers", quantity: 1 }] },
  },
  {
    key: "mossy-altar",
    mapKeys: ["palmia-wilds"],
    tier: "common",
    title: "长苔石坛",
    description: "路边石坛上还留着未散的微光，你靠近后精神为之一振。",
    reward: { gold: 12, aetherCrystal: 1, exp: 10, healthDelta: 12, items: [{ itemId: "leather-cap", quantity: 1 }] },
  },
  {
    key: "merchant-clue",
    mapKeys: ["palmia-wilds"],
    tier: "common",
    title: "流商的线索",
    description: "你追上了匆匆离开的行商，从他手里换到了一点便宜补给。",
    reward: { gold: 36, aetherCrystal: 0, exp: 6, items: [{ itemId: "training-bow", quantity: 1 }] },
  },
  {
    key: "windfall-fruit",
    mapKeys: ["palmia-wilds"],
    tier: "common",
    title: "风落浆果",
    description: "你尝到一串罕见野果，体力恢复不少，连动作都轻快了些。",
    reward: { gold: 0, aetherCrystal: 1, exp: 14, healthDelta: 18 },
  },
  {
    key: "crystal-burrow",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    tier: "rare",
    title: "隐晶兽巢",
    description: "灌木后藏着一处被废弃的兽巢，残留的晶刺划破了你的护具，但你也捡到了完整结晶。",
    reward: { gold: 120, aetherCrystal: 4, exp: 36, healthDelta: -22, items: [{ itemId: "amber-charm", quantity: 1 }] },
  },
  {
    key: "forgotten-caravan",
    mapKeys: ["palmia-wilds"],
    tier: "rare",
    title: "失落商队",
    description: "你在旧车辙旁找到半埋的补给箱，却也顺手赶跑了几只扑上来的鬣犬。",
    reward: { gold: 168, aetherCrystal: 2, exp: 28, healthDelta: -14, items: [{ itemId: "hunter-leathers", quantity: 1 }] },
  },
  {
    key: "moonlit-guidance",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    tier: "rare",
    title: "月影指引",
    description: "短暂闪过的银白轨迹为你指明了近路，也让你看清了更多细节。",
    reward: { gold: 88, aetherCrystal: 3, exp: 56, healthDelta: 20, items: [{ itemId: "moonshadow-dagger", quantity: 1 }] },
  },
  {
    key: "dragonbone-relic",
    mapKeys: ["moonfall-ruins"],
    tier: "legendary",
    title: "龙骨遗辉",
    description: "你在荒野深处碰见一截仍在低鸣的龙骨，其残响将力量灌入你的血脉。",
    reward: { gold: 888, aetherCrystal: 18, exp: 220, healthDelta: 40, items: [{ itemId: "knightwatch-mail", quantity: 1 }] },
  },
  {
    key: "starlight-vault",
    mapKeys: ["moonfall-ruins"],
    tier: "legendary",
    title: "星辉秘匣",
    description: "古老封印在你面前自行开启，匣中溢出的星光化作了惊人的收获。",
    reward: { gold: 1280, aetherCrystal: 12, exp: 188, healthDelta: 32, items: [{ itemId: "dawnfire-pendant", quantity: 1 }] },
  },
];

const DEFAULT_BATTLE_ENEMIES: BattleEnemyTemplate[] = [
  {
    key: "stray-wolf",
    mapKeys: ["palmia-wilds"],
    name: "荒原孤狼",
    summary: "敏捷高、出手快，喜欢趁空档撕咬。",
    skillCaps: { guard: 1, spell: 0 },
    statWeights: { agility: 1.15, intelligence: 0.45, strength: 0.9, vitality: 0.85 },
  },
  {
    key: "bandit-scout",
    mapKeys: ["palmia-wilds"],
    name: "流匪斥候",
    summary: "动作灵活，偶尔会抓时机用投刃压血线。",
    skillCaps: { guard: 1, spell: 2 },
    statWeights: { agility: 1.05, intelligence: 0.65, strength: 0.95, vitality: 0.9 },
  },
  {
    key: "ruin-mage",
    mapKeys: ["moonfall-ruins"],
    name: "遗迹术士",
    summary: "智力偏高，擅长在残血时用法术收尾。",
    skillCaps: { guard: 1, spell: 3 },
    statWeights: { agility: 0.75, intelligence: 1.25, strength: 0.55, vitality: 0.95 },
  },
  {
    key: "stonehide-boar",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    name: "石皮野猪",
    summary: "血厚皮硬，撞击前摇慢但很难被秒掉。",
    skillCaps: { guard: 1, spell: 0 },
    statWeights: { agility: 0.65, intelligence: 0.25, strength: 1, vitality: 1.15 },
  },
  {
    key: "moonshard-sentinel",
    mapKeys: ["moonfall-ruins"],
    name: "月碎守卫",
    summary: "驻守在遗迹深处的残损傀儡，会用晶片爆发压制血线。",
    skillCaps: { guard: 2, spell: 2 },
    statWeights: { agility: 0.9, intelligence: 1.1, strength: 1.05, vitality: 1.2 },
  },
];

const DEFAULT_SYSTEM_BALANCE: SystemBalanceConfig = {
  marketFeeRatePercent: 10,
  battleTriggerChance: 0.2,
  actionBarTarget: 100,
  playerHealRatio: 0.18,
  playerGuardRatio: 0.45,
  enemyHealRatio: 0.08,
  enemyGuardRatio: 0.35,
  spellBaseChance: 0.7,
  intelligenceSpellBonusThreshold: 12,
  executionRewardTickSeconds: 1,
  playerGuardHealthThreshold: 0.3,
  enemyGuardHealthThreshold: 0.18,
  playerGuardCooldownTurns: 2,
  enemyGuardCooldownTurns: 3,
};

const DEFAULT_LEVEL_TABLE = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: getLevelBaseExp(index + 1),
}));

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asInt(value: unknown, fallback = 0) {
  return Math.trunc(asNumber(value, fallback));
}

function asRarity(value: unknown) {
  return value === "white"
    || value === "green"
    || value === "blue"
    || value === "purple"
    || value === "orange"
    ? value
    : "white";
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
    normalizedUsername.length < 4
    || normalizedUsername.length > 20
    || !isValidUsername(normalizedUsername)
  ) {
    throw new Error("账号需为 4 到 20 位，仅支持字母、数字和下划线。");
  }

  return normalizedUsername;
}

function validatePassword(password: string) {
  if (password.length < 6 || password.length > 64) {
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

function asEncounterTier(value: unknown): EncounterTier {
  return value === "common" || value === "rare" || value === "legendary" ? value : "common";
}

function normalizeBodySlotAdjustments(value: unknown) {
  const source = asObject(value);
  const result: Partial<BodySlotCapacities> = {};

  if (!source) {
    return result;
  }

  for (const slotType of Object.keys(DEFAULT_BODY_SLOT_CAPACITIES) as BodySlotType[]) {
    if (slotType in source) {
      result[slotType] = asInt(source[slotType]);
    }
  }

  return result;
}

function normalizeMapKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => asString(entry).trim())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function normalizeStats(value: unknown) {
  const source = asObject(value);

  return {
    strength: asInt(source?.strength, 0),
    agility: asInt(source?.agility, 0),
    intelligence: asInt(source?.intelligence, 0),
    vitality: asInt(source?.vitality, 0),
  };
}

function createConfigErrorBucket(): AdminConfigFieldErrors {
  return {
    afkEncounterChances: [],
    afkEncounterPool: [],
    battleEnemyTemplates: [],
    classConfigs: [],
    itemCatalog: [],
    mapConfigs: [],
    raceConfigs: [],
    systemBalance: [],
  };
}

function pushConfigError(
  errors: AdminConfigFieldErrors,
  key: keyof AdminConfigFieldErrors,
  message: string,
) {
  const bucket = errors[key];

  if (bucket) {
    bucket.push(message);
  } else {
    errors[key] = [message];
  }
}

function isEmptyConfigErrors(errors: AdminConfigFieldErrors) {
  return Object.values(errors).every((messages) => !messages || messages.length === 0);
}

function isKnownBodySlotType(value: unknown): value is BodySlotType {
  return typeof value === "string" && value in DEFAULT_BODY_SLOT_CAPACITIES;
}

function isKnownEncounterTier(value: unknown): value is EncounterTier {
  return value === "common" || value === "rare" || value === "legendary";
}

function isKnownRarity(value: unknown) {
  return value === "white"
    || value === "green"
    || value === "blue"
    || value === "purple"
    || value === "orange";
}

function validateRequiredString(
  value: unknown,
  label: string,
  push: (message: string) => void,
) {
  if (typeof value !== "string" || !value.trim()) {
    push(`${label}不能为空。`);
    return null;
  }

  return value.trim();
}

function validateFiniteNumber(
  value: unknown,
  label: string,
  push: (message: string) => void,
  options?: {
    integer?: boolean;
    min?: number;
    max?: number;
    exclusiveMin?: number;
    exclusiveMax?: number;
  },
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    push(`${label}必须是合法数字。`);
    return null;
  }

  if (options?.integer && !Number.isInteger(value)) {
    push(`${label}必须是整数。`);
    return null;
  }

  if (options?.min !== undefined && value < options.min) {
    push(`${label}不能小于 ${options.min}。`);
    return null;
  }

  if (options?.max !== undefined && value > options.max) {
    push(`${label}不能大于 ${options.max}。`);
    return null;
  }

  if (options?.exclusiveMin !== undefined && value <= options.exclusiveMin) {
    push(`${label}必须大于 ${options.exclusiveMin}。`);
    return null;
  }

  if (options?.exclusiveMax !== undefined && value >= options.exclusiveMax) {
    push(`${label}必须小于 ${options.exclusiveMax}。`);
    return null;
  }

  return value;
}

function validateStatsObject(
  value: unknown,
  label: string,
  push: (message: string) => void,
) {
  const stats = asObject(value);

  if (!stats) {
    push(`${label}必须是对象。`);
    return;
  }

  const statKeys: Array<keyof Stats> = ["strength", "agility", "intelligence", "vitality"];

  for (const statKey of statKeys) {
    validateFiniteNumber(stats[statKey], `${label}.${statKey}`, push, { integer: true });
  }
}

function validateItemStatsObject(
  value: unknown,
  label: string,
  push: (message: string) => void,
) {
  const stats = asObject(value);

  if (!stats) {
    push(`${label}必须是对象。`);
    return;
  }

  for (const [statKey, statValue] of Object.entries(stats)) {
    validateFiniteNumber(statValue, `${label}.${statKey}`, push, { integer: true });
  }
}

export function validateAdminGameConfig(input: {
  afkEncounterChances: Record<EncounterTier, number>;
  afkEncounterPool: AfkEncounterConfig[];
  battleEnemyTemplates: BattleEnemyTemplate[];
  classConfigs: ClassConfig[];
  itemCatalog: DynamicGameConfig["itemCatalog"];
  mapConfigs: MapConfig[];
  raceConfigs: RaceConfig[];
  systemBalance: SystemBalanceConfig;
}) {
  const errors = createConfigErrorBucket();
  const itemIds = new Set<string>();
  const raceKeys = new Set<string>();
  const classKeys = new Set<string>();
  const mapKeys = new Set<string>();
  const enemyKeys = new Set<string>();
  const encounterKeys = new Set<string>();

  if (!Array.isArray(input.raceConfigs) || input.raceConfigs.length === 0) {
    pushConfigError(errors, "raceConfigs", "种族配置必须是非空数组。");
  } else {
    input.raceConfigs.forEach((race, index) => {
      const push = (message: string) => pushConfigError(errors, "raceConfigs", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(race?.key, "key", push);
      validateRequiredString(race?.label, "label", push);
      validateStatsObject(race?.stats, "stats", push);

      if (key) {
        if (raceKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        raceKeys.add(key);
      }

      if (race?.bodySlotAdjustments !== undefined) {
        const adjustments = asObject(race.bodySlotAdjustments);

        if (!adjustments) {
          push("bodySlotAdjustments 必须是对象。");
        } else {
          for (const [slotType, slotValue] of Object.entries(adjustments)) {
            if (!isKnownBodySlotType(slotType)) {
              push(`bodySlotAdjustments.${slotType} 不是合法槽位。`);
              continue;
            }

            validateFiniteNumber(slotValue, `bodySlotAdjustments.${slotType}`, push, { integer: true });
          }
        }
      }
    });
  }

  if (!Array.isArray(input.itemCatalog) || input.itemCatalog.length === 0) {
    pushConfigError(errors, "itemCatalog", "物品目录必须是非空数组。");
  } else {
    input.itemCatalog.forEach((item, index) => {
      const push = (message: string) => pushConfigError(errors, "itemCatalog", `第 ${index + 1} 项：${message}`);
      const itemId = validateRequiredString(item?.itemId, "itemId", push);
      validateRequiredString(item?.name, "name", push);
      validateFiniteNumber(item?.slotUsage, "slotUsage", push, { integer: true, min: 1 });
      validateFiniteNumber(item?.sellPrice, "sellPrice", push, { integer: true, min: 0 });
      validateItemStatsObject(item?.stats, "stats", push);

      if (!isKnownRarity(item?.rarity)) {
        push("rarity 必须是 white / green / blue / purple / orange 之一。");
      }

      if (!isKnownBodySlotType(item?.slot)) {
        push("slot 不是合法装备槽位。");
      }

      if (itemId) {
        if (itemIds.has(itemId)) {
          push(`itemId "${itemId}" 重复。`);
        }

        itemIds.add(itemId);
      }
    });
  }

  if (!Array.isArray(input.classConfigs) || input.classConfigs.length === 0) {
    pushConfigError(errors, "classConfigs", "职业配置必须是非空数组。");
  } else {
    input.classConfigs.forEach((classConfig, index) => {
      const push = (message: string) => pushConfigError(errors, "classConfigs", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(classConfig?.key, "key", push);
      validateRequiredString(classConfig?.label, "label", push);
      validateRequiredString(classConfig?.starterItemId, "starterItemId", push);
      validateStatsObject(classConfig?.stats, "stats", push);

      if (key) {
        if (classKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        classKeys.add(key);
      }

      if (classConfig?.starterItemId && !itemIds.has(classConfig.starterItemId)) {
        push(`starterItemId "${classConfig.starterItemId}" 不存在于物品目录。`);
      }
    });
  }

  if (!Array.isArray(input.mapConfigs) || input.mapConfigs.length === 0) {
    pushConfigError(errors, "mapConfigs", "地图配置必须是非空数组。");
  } else {
    input.mapConfigs.forEach((mapConfig, index) => {
      const push = (message: string) => pushConfigError(errors, "mapConfigs", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(mapConfig?.key, "key", push);
      validateRequiredString(mapConfig?.label, "label", push);
      validateFiniteNumber(mapConfig?.goldPerMinute, "goldPerMinute", push, { min: 0 });
      validateFiniteNumber(mapConfig?.aetherPerMinute, "aetherPerMinute", push, { min: 0 });
      validateFiniteNumber(mapConfig?.expPerMinute, "expPerMinute", push, { min: 0 });

      if (key) {
        if (mapKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        mapKeys.add(key);
      }
    });
  }

  if (!Array.isArray(input.battleEnemyTemplates) || input.battleEnemyTemplates.length === 0) {
    pushConfigError(errors, "battleEnemyTemplates", "怪物模板必须是非空数组。");
  } else {
    input.battleEnemyTemplates.forEach((enemy, index) => {
      const push = (message: string) => pushConfigError(errors, "battleEnemyTemplates", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(enemy?.key, "key", push);
      validateRequiredString(enemy?.name, "name", push);

      if (key) {
        if (enemyKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        enemyKeys.add(key);
      }

      if (enemy?.mapKeys !== undefined) {
        if (!Array.isArray(enemy.mapKeys) || enemy.mapKeys.length === 0) {
          push("mapKeys 必须是非空数组。");
        } else {
          enemy.mapKeys.forEach((mapKey, mapIndex) => {
            const validatedMapKey = validateRequiredString(mapKey, `mapKeys[${mapIndex + 1}]`, push);

            if (validatedMapKey && !mapKeys.has(validatedMapKey)) {
              push(`mapKeys[${mapIndex + 1}] "${validatedMapKey}" 不存在于地图配置。`);
            }
          });
        }
      }

      const skillCaps = asObject(enemy?.skillCaps);

      if (!skillCaps) {
        push("skillCaps 必须是对象。");
      } else {
        validateFiniteNumber(skillCaps.guard, "skillCaps.guard", push, { integer: true, min: 0 });
        validateFiniteNumber(skillCaps.spell, "skillCaps.spell", push, { integer: true, min: 0 });
      }

      const statWeights = asObject(enemy?.statWeights);

      if (!statWeights) {
        push("statWeights 必须是对象。");
      } else {
        validateFiniteNumber(statWeights.strength, "statWeights.strength", push, { exclusiveMin: 0 });
        validateFiniteNumber(statWeights.agility, "statWeights.agility", push, { exclusiveMin: 0 });
        validateFiniteNumber(statWeights.intelligence, "statWeights.intelligence", push, { exclusiveMin: 0 });
        validateFiniteNumber(statWeights.vitality, "statWeights.vitality", push, { exclusiveMin: 0 });
      }
    });
  }

  if (!Array.isArray(input.afkEncounterPool) || input.afkEncounterPool.length === 0) {
    pushConfigError(errors, "afkEncounterPool", "挂机遭遇池必须是非空数组。");
  } else {
    input.afkEncounterPool.forEach((encounter, index) => {
      const push = (message: string) => pushConfigError(errors, "afkEncounterPool", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(encounter?.key, "key", push);
      validateRequiredString(encounter?.title, "title", push);

      if (key) {
        if (encounterKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        encounterKeys.add(key);
      }

      if (encounter?.mapKeys !== undefined) {
        if (!Array.isArray(encounter.mapKeys) || encounter.mapKeys.length === 0) {
          push("mapKeys 必须是非空数组。");
        } else {
          encounter.mapKeys.forEach((mapKey, mapIndex) => {
            const validatedMapKey = validateRequiredString(mapKey, `mapKeys[${mapIndex + 1}]`, push);

            if (validatedMapKey && !mapKeys.has(validatedMapKey)) {
              push(`mapKeys[${mapIndex + 1}] "${validatedMapKey}" 不存在于地图配置。`);
            }
          });
        }
      }

      if (!isKnownEncounterTier(encounter?.tier)) {
        push("tier 必须是 common / rare / legendary 之一。");
      }

      const reward = asObject(encounter?.reward);

      if (!reward) {
        push("reward 必须是对象。");
      } else {
        validateFiniteNumber(reward.gold, "reward.gold", push, { integer: true });
        validateFiniteNumber(reward.aetherCrystal, "reward.aetherCrystal", push, { integer: true });
        validateFiniteNumber(reward.exp, "reward.exp", push, { integer: true });

        if ("healthDelta" in reward && reward.healthDelta !== undefined) {
          validateFiniteNumber(reward.healthDelta, "reward.healthDelta", push, { integer: true });
        }

        if ("items" in reward && reward.items !== undefined) {
          if (!Array.isArray(reward.items)) {
            push("reward.items 必须是数组。");
          } else {
            reward.items.forEach((item, itemIndex) => {
              const itemSource = asObject(item);

              if (!itemSource) {
                push(`reward.items[${itemIndex + 1}] 必须是对象。`);
                return;
              }

              const rewardItemId = validateRequiredString(itemSource.itemId, `reward.items[${itemIndex + 1}].itemId`, push);
              validateFiniteNumber(itemSource.quantity, `reward.items[${itemIndex + 1}].quantity`, push, { integer: true, min: 1 });

              if (rewardItemId && !itemIds.has(rewardItemId)) {
                push(`reward.items[${itemIndex + 1}].itemId "${rewardItemId}" 不存在于物品目录。`);
              }
            });
          }
        }
      }
    });
  }

  const chances = asObject(input.afkEncounterChances);

  if (!chances) {
    pushConfigError(errors, "afkEncounterChances", "遭遇概率必须是对象。");
  } else {
    const common = validateFiniteNumber(chances.common, "common", (message) => pushConfigError(errors, "afkEncounterChances", message), { min: 0, max: 1 });
    const rare = validateFiniteNumber(chances.rare, "rare", (message) => pushConfigError(errors, "afkEncounterChances", message), { min: 0, max: 1 });
    const legendary = validateFiniteNumber(chances.legendary, "legendary", (message) => pushConfigError(errors, "afkEncounterChances", message), { min: 0, max: 1 });

    if (common !== null && rare !== null && legendary !== null && common + rare + legendary > 1) {
      pushConfigError(errors, "afkEncounterChances", "common + rare + legendary 的总和不能大于 1。");
    }
  }

  const systemBalance = asObject(input.systemBalance);

  if (!systemBalance) {
    pushConfigError(errors, "systemBalance", "系统平衡参数必须是对象。");
  } else {
    const push = (message: string) => pushConfigError(errors, "systemBalance", message);

    validateFiniteNumber(systemBalance.marketFeeRatePercent, "marketFeeRatePercent", push, { min: 0, max: 100 });
    validateFiniteNumber(systemBalance.battleTriggerChance, "battleTriggerChance", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.actionBarTarget, "actionBarTarget", push, { integer: true, exclusiveMin: 0 });
    validateFiniteNumber(systemBalance.playerHealRatio, "playerHealRatio", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.playerGuardRatio, "playerGuardRatio", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.enemyHealRatio, "enemyHealRatio", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.enemyGuardRatio, "enemyGuardRatio", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.spellBaseChance, "spellBaseChance", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.intelligenceSpellBonusThreshold, "intelligenceSpellBonusThreshold", push, { integer: true, min: 0 });
    validateFiniteNumber(systemBalance.executionRewardTickSeconds, "executionRewardTickSeconds", push, { integer: true, exclusiveMin: 0 });
    validateFiniteNumber(systemBalance.playerGuardHealthThreshold, "playerGuardHealthThreshold", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.enemyGuardHealthThreshold, "enemyGuardHealthThreshold", push, { min: 0, max: 1 });
    validateFiniteNumber(systemBalance.playerGuardCooldownTurns, "playerGuardCooldownTurns", push, { integer: true, min: 0 });
    validateFiniteNumber(systemBalance.enemyGuardCooldownTurns, "enemyGuardCooldownTurns", push, { integer: true, min: 0 });
  }

  return {
    fieldErrors: errors,
    isValid: isEmptyConfigErrors(errors),
  };
}

function normalizeRaces(value: unknown): RaceConfig[] {
  if (!Array.isArray(value)) {
    return defaultRaceConfigs;
  }

  const normalized = value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        label: asString(source.label),
        summary: asString(source.summary),
        stats: normalizeStats(source.stats),
        bodySlotAdjustments: normalizeBodySlotAdjustments(source.bodySlotAdjustments),
      } as RaceConfig;
    })
    .filter((entry): entry is RaceConfig => Boolean(entry));

  return normalized.length > 0 ? normalized : defaultRaceConfigs;
}

function normalizeClasses(value: unknown): ClassConfig[] {
  if (!Array.isArray(value)) {
    return defaultClassConfigs;
  }

  const normalized = value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        label: asString(source.label),
        summary: asString(source.summary),
        starterItemId: asString(source.starterItemId),
        stats: normalizeStats(source.stats),
      } as ClassConfig;
    })
    .filter((entry): entry is ClassConfig => Boolean(entry));

  return normalized.length > 0 ? normalized : defaultClassConfigs;
}

function normalizeMaps(value: unknown): MapConfig[] {
  if (!Array.isArray(value)) {
    return defaultMapConfigs;
  }

  const normalized = value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        label: asString(source.label),
        summary: asString(source.summary),
        goldPerMinute: asNumber(source.goldPerMinute, 0),
        aetherPerMinute: asNumber(source.aetherPerMinute, 0),
        expPerMinute: asNumber(source.expPerMinute, 0),
      } as MapConfig;
    })
    .filter((entry): entry is MapConfig => Boolean(entry));

  return normalized.length > 0 ? normalized : defaultMapConfigs;
}

function normalizeEncounterChances(value: unknown): Record<EncounterTier, number> {
  const source = asObject(value);

  if (!source) {
    return DEFAULT_AFK_ENCOUNTER_CHANCES;
  }

  return {
    common: asNumber(source.common, DEFAULT_AFK_ENCOUNTER_CHANCES.common),
    rare: asNumber(source.rare, DEFAULT_AFK_ENCOUNTER_CHANCES.rare),
    legendary: asNumber(source.legendary, DEFAULT_AFK_ENCOUNTER_CHANCES.legendary),
  };
}

function normalizeEncounterReward(value: unknown): AfkEncounterConfig["reward"] {
  const source = asObject(value);
  const items: NonNullable<AfkEncounterConfig["reward"]["items"]> = [];

  if (Array.isArray(source?.items)) {
    for (const entry of source.items) {
      const item = asObject(entry);

      if (!item || !asString(item.itemId).trim()) {
        continue;
      }

      items.push({
        itemId: asString(item.itemId).trim(),
        quantity: Math.max(1, asInt(item.quantity, 1)),
        name: asString(item.name) || undefined,
        rarity: asRarity(item.rarity),
      });
    }
  }

  return {
    gold: asInt(source?.gold, 0),
    aetherCrystal: asInt(source?.aetherCrystal, 0),
    exp: asInt(source?.exp, 0),
    ...(source && "healthDelta" in source ? { healthDelta: asInt(source.healthDelta, 0) } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}

function normalizeEncounters(value: unknown): AfkEncounterConfig[] {
  if (!Array.isArray(value)) {
    return DEFAULT_AFK_ENCOUNTER_POOL;
  }

  const normalized = value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        tier: asEncounterTier(source.tier),
        ...(normalizeMapKeys(source.mapKeys) ? { mapKeys: normalizeMapKeys(source.mapKeys) } : {}),
        title: asString(source.title),
        description: asString(source.description),
        reward: normalizeEncounterReward(source.reward),
      } as AfkEncounterConfig;
    })
    .filter((entry): entry is AfkEncounterConfig => Boolean(entry));

  return normalized.length > 0 ? normalized : DEFAULT_AFK_ENCOUNTER_POOL;
}

function normalizeBattleEnemies(value: unknown): BattleEnemyTemplate[] {
  if (!Array.isArray(value)) {
    return DEFAULT_BATTLE_ENEMIES;
  }

  const normalized = value
    .map((entry) => {
      const source = asObject(entry);
      const skillCaps = asObject(source?.skillCaps);
      const statWeights = asObject(source?.statWeights);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        ...(normalizeMapKeys(source.mapKeys) ? { mapKeys: normalizeMapKeys(source.mapKeys) } : {}),
        name: asString(source.name),
        summary: asString(source.summary),
        skillCaps: {
          guard: asInt(skillCaps?.guard, 0),
          spell: asInt(skillCaps?.spell, 0),
        },
        statWeights: {
          strength: asNumber(statWeights?.strength, 1),
          agility: asNumber(statWeights?.agility, 1),
          intelligence: asNumber(statWeights?.intelligence, 1),
          vitality: asNumber(statWeights?.vitality, 1),
        },
      } satisfies BattleEnemyTemplate;
    })
    .filter((entry): entry is BattleEnemyTemplate => Boolean(entry));

  return normalized.length > 0 ? normalized : DEFAULT_BATTLE_ENEMIES;
}

function normalizeSystemBalance(value: unknown): SystemBalanceConfig {
  const source = asObject(value);

  if (!source) {
    return DEFAULT_SYSTEM_BALANCE;
  }

  return {
    marketFeeRatePercent: asNumber(source.marketFeeRatePercent, DEFAULT_SYSTEM_BALANCE.marketFeeRatePercent),
    battleTriggerChance: asNumber(source.battleTriggerChance, DEFAULT_SYSTEM_BALANCE.battleTriggerChance),
    actionBarTarget: asInt(source.actionBarTarget, DEFAULT_SYSTEM_BALANCE.actionBarTarget),
    playerHealRatio: asNumber(source.playerHealRatio, DEFAULT_SYSTEM_BALANCE.playerHealRatio),
    playerGuardRatio: asNumber(source.playerGuardRatio, DEFAULT_SYSTEM_BALANCE.playerGuardRatio),
    enemyHealRatio: asNumber(source.enemyHealRatio, DEFAULT_SYSTEM_BALANCE.enemyHealRatio),
    enemyGuardRatio: asNumber(source.enemyGuardRatio, DEFAULT_SYSTEM_BALANCE.enemyGuardRatio),
    spellBaseChance: asNumber(source.spellBaseChance, DEFAULT_SYSTEM_BALANCE.spellBaseChance),
    intelligenceSpellBonusThreshold: asInt(
      source.intelligenceSpellBonusThreshold,
      DEFAULT_SYSTEM_BALANCE.intelligenceSpellBonusThreshold,
    ),
    executionRewardTickSeconds: asInt(
      source.executionRewardTickSeconds,
      DEFAULT_SYSTEM_BALANCE.executionRewardTickSeconds,
    ),
    playerGuardHealthThreshold: asNumber(
      source.playerGuardHealthThreshold,
      DEFAULT_SYSTEM_BALANCE.playerGuardHealthThreshold,
    ),
    enemyGuardHealthThreshold: asNumber(
      source.enemyGuardHealthThreshold,
      DEFAULT_SYSTEM_BALANCE.enemyGuardHealthThreshold,
    ),
    playerGuardCooldownTurns: asInt(source.playerGuardCooldownTurns, DEFAULT_SYSTEM_BALANCE.playerGuardCooldownTurns),
    enemyGuardCooldownTurns: asInt(source.enemyGuardCooldownTurns, DEFAULT_SYSTEM_BALANCE.enemyGuardCooldownTurns),
  };
}

type ItemCatalogRow = {
  item_id: string;
  name: string;
  rarity: string;
  slot: BodySlotType;
  slot_usage: number;
  description: string;
  sell_price: number;
  stat_json: Record<string, number> | null;
};

export async function getDynamicGameConfig(): Promise<DynamicGameConfig> {
  const [configResult, itemResult] = await Promise.all([
    query<ConfigRow>(
      `
        SELECT config_key, config_type, value, updated_at
        FROM game_config
      `,
    ),
    query<ItemCatalogRow>(
      `
        SELECT
          item_id,
          name,
          rarity,
          slot,
          slot_usage,
          description,
          sell_price,
          stat_json
        FROM item
        ORDER BY item_id ASC
      `,
    ),
  ]);

  const configByKey = new Map(configResult.rows.map((row) => [row.config_key, row.value]));

  return {
    afkEncounterChances: normalizeEncounterChances(configByKey.get("afk-encounter-rates")),
    afkEncounterPool: normalizeEncounters(configByKey.get("afk-encounters")),
    battleEnemyTemplates: normalizeBattleEnemies(configByKey.get("battle-enemies")),
    classConfigs: normalizeClasses(configByKey.get("classes")),
    itemCatalog: itemResult.rows.map((item) => ({
      itemId: item.item_id,
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
      slotUsage: item.slot_usage,
      description: item.description,
      sellPrice: item.sell_price,
      stats: item.stat_json ?? {},
    })),
    levelTable: DEFAULT_LEVEL_TABLE,
    mapConfigs: normalizeMaps(configByKey.get("maps")),
    raceConfigs: normalizeRaces(configByKey.get("races")),
    systemBalance: normalizeSystemBalance(configByKey.get("system-balance")),
  };
}

export async function listAdminRoles(): Promise<AdminRoleRecord[]> {
  const result = await query<{
    role_id: string;
    user_id: string;
    name: string;
    race_key: string;
    class_key: string;
    level: number;
    exp: number;
    gold: number;
    aether_crystal: number;
    current_health: number;
    strength: number;
    agility: number;
    intelligence: number;
    vitality: number;
    avatar_seed: string;
    username: string | null;
    account_type: string;
    updated_at: Date | null;
  }>(
    `
      SELECT
        role.role_id,
        role.user_id,
        role.name,
        role.race_key,
        role.class_key,
        role.level,
        role.exp,
        role.gold,
        role.aether_crystal,
        role.current_health,
        role.strength,
        role.agility,
        role.intelligence,
        role.vitality,
        role.avatar_seed,
        "user".username,
        "user".account_type,
        role.updated_at
      FROM role
      JOIN "user" ON "user".user_id = role.user_id
      ORDER BY role.updated_at DESC NULLS LAST, role.created_at DESC
    `,
  );

  return result.rows.map((row) => ({
    roleId: row.role_id,
    userId: row.user_id,
    name: row.name,
    raceKey: row.race_key,
    classKey: row.class_key,
    level: row.level,
    exp: row.exp,
    gold: row.gold,
    aetherCrystal: row.aether_crystal,
    currentHealth: row.current_health,
    strength: row.strength,
    agility: row.agility,
    intelligence: row.intelligence,
    vitality: row.vitality,
    avatarSeed: row.avatar_seed,
    username: row.username,
    accountType: row.account_type,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
  }));
}

export async function listAdminAccounts(): Promise<AdminAccountRecord[]> {
  const result = await query<{
    user_id: string;
    guest_token: string;
    account_type: "guest" | "account";
    username: string | null;
    password_hash: string | null;
    role_id: string | null;
    role_name: string | null;
    created_at: Date | null;
    last_login_at: Date | null;
    last_seen_at: Date | null;
  }>(
    `
      SELECT
        "user".user_id,
        "user".guest_token,
        "user".account_type,
        "user".username,
        "user".password_hash,
        role.role_id,
        role.name AS role_name,
        "user".created_at,
        "user".last_login_at,
        "user".last_seen_at
      FROM "user"
      LEFT JOIN role ON role.user_id = "user".user_id
      ORDER BY "user".created_at DESC, "user".user_id DESC
    `,
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    guestToken: row.guest_token,
    accountType: row.account_type,
    username: row.username,
    hasPassword: Boolean(row.password_hash),
    roleId: row.role_id,
    roleName: row.role_name,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : null,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : null,
  }));
}

export async function createAdminAccount(input: AdminAccountUpsertInput) {
  const accountType = input.accountType === "account" ? "account" : "guest";
  const guestToken = input.guestToken?.trim() || makeId("guest");
  const username = accountType === "account" ? validateUsername(input.username ?? "") : null;
  const password = accountType === "account" ? (input.password ?? "") : "";

  if (accountType === "account") {
    validatePassword(password);
  }

  await withTransaction(async (client) => {
    if (accountType === "account" && username) {
      const existingUser = await client.query<{ user_id: string }>(
        `SELECT user_id FROM "user" WHERE username = $1`,
        [username],
      );

      if ((existingUser.rowCount ?? 0) > 0) {
        throw new Error("该账号名已被占用。");
      }
    }

    const existingGuestToken = await client.query<{ user_id: string }>(
      `SELECT user_id FROM "user" WHERE guest_token = $1`,
      [guestToken],
    );

    if ((existingGuestToken.rowCount ?? 0) > 0) {
      throw new Error("游客 token 已存在，请更换后重试。");
    }

    const passwordData = accountType === "account" ? hashPassword(password) : null;

    await client.query(
      `
        INSERT INTO "user" (
          user_id,
          guest_token,
          account_type,
          username,
          password_hash,
          password_salt,
          created_at,
          last_login_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      `,
      [
        makeId("user"),
        guestToken,
        accountType,
        username,
        passwordData?.passwordHash ?? null,
        passwordData?.passwordSalt ?? null,
      ],
    );
  });
}

export async function updateAdminAccount(input: AdminAccountUpsertInput & { userId: string }) {
  const accountType = input.accountType === "account" ? "account" : "guest";
  const guestToken = input.guestToken?.trim();

  if (!input.userId.trim()) {
    throw new Error("缺少账号标识。");
  }

  await withTransaction(async (client) => {
    const existingResult = await client.query<{
      user_id: string;
      guest_token: string;
      account_type: "guest" | "account";
      username: string | null;
      password_hash: string | null;
      password_salt: string | null;
    }>(
      `
        SELECT
          user_id,
          guest_token,
          account_type,
          username,
          password_hash,
          password_salt
        FROM "user"
        WHERE user_id = $1
        FOR UPDATE
      `,
      [input.userId.trim()],
    );

    const current = existingResult.rows[0];

    if (!current) {
      throw new Error("账号不存在。");
    }

    const nextGuestToken = guestToken || current.guest_token;

    if (nextGuestToken !== current.guest_token) {
      const duplicateGuestToken = await client.query<{ user_id: string }>(
        `SELECT user_id FROM "user" WHERE guest_token = $1 AND user_id <> $2`,
        [nextGuestToken, current.user_id],
      );

      if ((duplicateGuestToken.rowCount ?? 0) > 0) {
        throw new Error("游客 token 已存在，请更换后重试。");
      }
    }

    const nextUsername = accountType === "account"
      ? validateUsername(input.username ?? current.username ?? "")
      : null;

    if (accountType === "account" && nextUsername) {
      const duplicateUsername = await client.query<{ user_id: string }>(
        `SELECT user_id FROM "user" WHERE username = $1 AND user_id <> $2`,
        [nextUsername, current.user_id],
      );

      if ((duplicateUsername.rowCount ?? 0) > 0) {
        throw new Error("该账号名已被占用。");
      }
    }

    let passwordHash = current.password_hash;
    let passwordSalt = current.password_salt;

    if (accountType === "account" && input.password && input.password.trim()) {
      validatePassword(input.password);
      const passwordData = hashPassword(input.password);
      passwordHash = passwordData.passwordHash;
      passwordSalt = passwordData.passwordSalt;
    }

    if (accountType === "guest") {
      passwordHash = null;
      passwordSalt = null;
    }

    await client.query(
      `
        UPDATE "user"
        SET
          guest_token = $2,
          account_type = $3,
          username = $4,
          password_hash = $5,
          password_salt = $6
        WHERE user_id = $1
      `,
      [
        current.user_id,
        nextGuestToken,
        accountType,
        nextUsername,
        passwordHash,
        passwordSalt,
      ],
    );
  });
}

export async function deleteAdminAccount(userId: string) {
  if (!userId.trim()) {
    throw new Error("缺少账号标识。");
  }

  await query(
    `
      DELETE FROM "user"
      WHERE user_id = $1
    `,
    [userId.trim()],
  );
}

export async function updateAdminRole(input: AdminRoleRecord) {
  await query(
    `
      UPDATE role
      SET
        name = $2,
        race_key = $3,
        class_key = $4,
        level = $5,
        exp = $6,
        gold = $7,
        aether_crystal = $8,
        current_health = $9,
        strength = $10,
        agility = $11,
        intelligence = $12,
        vitality = $13,
        avatar_seed = $14,
        updated_at = NOW()
      WHERE role_id = $1
    `,
    [
      input.roleId,
      input.name,
      input.raceKey,
      input.classKey,
      input.level,
      input.exp,
      input.gold,
      input.aetherCrystal,
      input.currentHealth,
      input.strength,
      input.agility,
      input.intelligence,
      input.vitality,
      input.avatarSeed,
    ],
  );
}

export async function saveAdminGameConfig(input: {
  afkEncounterChances: Record<EncounterTier, number>;
  afkEncounterPool: AfkEncounterConfig[];
  battleEnemyTemplates: BattleEnemyTemplate[];
  classConfigs: ClassConfig[];
  itemCatalog: DynamicGameConfig["itemCatalog"];
  mapConfigs: MapConfig[];
  raceConfigs: RaceConfig[];
  systemBalance: SystemBalanceConfig;
}) {
  await withTransaction(async (client) => {
    const upsertConfig = async (configKey: string, configType: string, value: unknown) => {
      await client.query(
        `
          INSERT INTO game_config (config_key, config_type, value, updated_at)
          VALUES ($1, $2, $3::jsonb, NOW())
          ON CONFLICT (config_key)
          DO UPDATE SET
            config_type = EXCLUDED.config_type,
            value = EXCLUDED.value,
            updated_at = NOW()
        `,
        [configKey, configType, JSON.stringify(value)],
      );
    };

    await upsertConfig("races", "list", input.raceConfigs);
    await upsertConfig("classes", "list", input.classConfigs);
    await upsertConfig("maps", "list", input.mapConfigs);
    await upsertConfig("afk-encounter-rates", "object", input.afkEncounterChances);
    await upsertConfig("afk-encounters", "list", input.afkEncounterPool);
    await upsertConfig("battle-enemies", "list", input.battleEnemyTemplates);
    await upsertConfig("system-balance", "object", input.systemBalance);

    await client.query("DELETE FROM item");

    for (const item of input.itemCatalog) {
      await client.query(
        `
          INSERT INTO item (
            item_id,
            name,
            rarity,
            slot,
            slot_usage,
            description,
            sell_price,
            stat_json,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
        `,
        [
          item.itemId,
          item.name,
          item.rarity,
          item.slot,
          item.slotUsage,
          item.description,
          item.sellPrice,
          JSON.stringify(item.stats ?? {}),
        ],
      );
    }
  });
}

export function getAdminStaticMeta() {
  return {
    constants: {
      AFK_TASK_SECONDS,
      BASE_HEALTH,
      DEFAULT_BODY_SLOT_CAPACITIES,
      EXP_GROWTH_PER_LEVEL,
      EXP_PER_LEVEL,
      HEALTH_PER_LEVEL,
      HEALTH_PER_VITALITY,
      LEVEL_CAP,
      LEVEL_CURVE_VERSION,
      MAX_OFFLINE_SECONDS,
    },
    helpers: {
      bodySlotTypeLabels: (Object.keys(DEFAULT_BODY_SLOT_CAPACITIES) as BodySlotType[]).map((slotType) => ({
        key: slotType,
        label: getBodySlotTypeLabel(slotType),
      })),
    },
  };
}
