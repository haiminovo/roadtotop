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
import { query, withTransaction } from "@/lib/server/db";

type ConfigRow = {
  config_key: string;
  config_type: string;
  value: unknown;
  updated_at: Date;
};

export type BattleEnemyTemplate = {
  key: string;
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

const DEFAULT_AFK_ENCOUNTER_CHANCES: Record<EncounterTier, number> = {
  common: 0.1,
  rare: 0.01,
  legendary: 0.001,
};

const DEFAULT_AFK_ENCOUNTER_POOL: AfkEncounterConfig[] = [
  {
    key: "wanderer-cache",
    tier: "common",
    title: "拾荒者的暗袋",
    description: "你在枯树根下翻出一只旧布袋，却被藏着的铁夹划伤了手，好在还能顺走一点物资。",
    reward: { gold: 28, aetherCrystal: 0, exp: 8, healthDelta: -10, items: [{ itemId: "scout-bracers", quantity: 1 }] },
  },
  {
    key: "mossy-altar",
    tier: "common",
    title: "长苔石坛",
    description: "路边石坛上还留着未散的微光，你靠近后精神为之一振。",
    reward: { gold: 12, aetherCrystal: 1, exp: 10, healthDelta: 12, items: [{ itemId: "leather-cap", quantity: 1 }] },
  },
  {
    key: "merchant-clue",
    tier: "common",
    title: "流商的线索",
    description: "你追上了匆匆离开的行商，从他手里换到了一点便宜补给。",
    reward: { gold: 36, aetherCrystal: 0, exp: 6, items: [{ itemId: "training-bow", quantity: 1 }] },
  },
  {
    key: "windfall-fruit",
    tier: "common",
    title: "风落浆果",
    description: "你尝到一串罕见野果，体力恢复不少，连动作都轻快了些。",
    reward: { gold: 0, aetherCrystal: 1, exp: 14, healthDelta: 18 },
  },
  {
    key: "crystal-burrow",
    tier: "rare",
    title: "隐晶兽巢",
    description: "灌木后藏着一处被废弃的兽巢，残留的晶刺划破了你的护具，但你也捡到了完整结晶。",
    reward: { gold: 120, aetherCrystal: 4, exp: 36, healthDelta: -22, items: [{ itemId: "amber-charm", quantity: 1 }] },
  },
  {
    key: "forgotten-caravan",
    tier: "rare",
    title: "失落商队",
    description: "你在旧车辙旁找到半埋的补给箱，却也顺手赶跑了几只扑上来的鬣犬。",
    reward: { gold: 168, aetherCrystal: 2, exp: 28, healthDelta: -14, items: [{ itemId: "hunter-leathers", quantity: 1 }] },
  },
  {
    key: "moonlit-guidance",
    tier: "rare",
    title: "月影指引",
    description: "短暂闪过的银白轨迹为你指明了近路，也让你看清了更多细节。",
    reward: { gold: 88, aetherCrystal: 3, exp: 56, healthDelta: 20, items: [{ itemId: "moonshadow-dagger", quantity: 1 }] },
  },
  {
    key: "dragonbone-relic",
    tier: "legendary",
    title: "龙骨遗辉",
    description: "你在荒野深处碰见一截仍在低鸣的龙骨，其残响将力量灌入你的血脉。",
    reward: { gold: 888, aetherCrystal: 18, exp: 220, healthDelta: 40, items: [{ itemId: "knightwatch-mail", quantity: 1 }] },
  },
  {
    key: "starlight-vault",
    tier: "legendary",
    title: "星辉秘匣",
    description: "古老封印在你面前自行开启，匣中溢出的星光化作了惊人的收获。",
    reward: { gold: 1280, aetherCrystal: 12, exp: 188, healthDelta: 32, items: [{ itemId: "dawnfire-pendant", quantity: 1 }] },
  },
];

const DEFAULT_BATTLE_ENEMIES: BattleEnemyTemplate[] = [
  {
    key: "stray-wolf",
    name: "荒原孤狼",
    summary: "敏捷高、出手快，喜欢趁空档撕咬。",
    skillCaps: { guard: 1, spell: 0 },
    statWeights: { agility: 1.15, intelligence: 0.45, strength: 0.9, vitality: 0.85 },
  },
  {
    key: "bandit-scout",
    name: "流匪斥候",
    summary: "动作灵活，偶尔会抓时机用投刃压血线。",
    skillCaps: { guard: 1, spell: 2 },
    statWeights: { agility: 1.05, intelligence: 0.65, strength: 0.95, vitality: 0.9 },
  },
  {
    key: "ruin-mage",
    name: "遗迹术士",
    summary: "智力偏高，擅长在残血时用法术收尾。",
    skillCaps: { guard: 1, spell: 3 },
    statWeights: { agility: 0.75, intelligence: 1.25, strength: 0.55, vitality: 0.95 },
  },
  {
    key: "stonehide-boar",
    name: "石皮野猪",
    summary: "血厚皮硬，撞击前摇慢但很难被秒掉。",
    skillCaps: { guard: 1, spell: 0 },
    statWeights: { agility: 0.65, intelligence: 0.25, strength: 1, vitality: 1.15 },
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

function normalizeStats(value: unknown) {
  const source = asObject(value);

  return {
    strength: asInt(source?.strength, 0),
    agility: asInt(source?.agility, 0),
    intelligence: asInt(source?.intelligence, 0),
    vitality: asInt(source?.vitality, 0),
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
