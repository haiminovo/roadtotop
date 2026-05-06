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
  DEFAULT_BODY_SLOT_CAPACITIES,
  EXP_GROWTH_PER_LEVEL,
  EXP_PER_LEVEL,
  getLevelBaseExp,
  HEALTH_PER_LEVEL,
  HEALTH_PER_VITALITY,
  LEVEL_CAP,
  LEVEL_CURVE_VERSION,
  MAX_OFFLINE_SECONDS,
  type ItemRarity,
} from "@/lib/game-config";
import { getDynamicGameConfig, type BattleEnemyTemplate, type DynamicGameConfig, type SystemBalanceConfig } from "@/lib/server/admin-config";

export type RuntimeItemSeed = DynamicGameConfig["itemCatalog"][number];

type RuntimeGameConfig = DynamicGameConfig & {
  afkEncounterPoolByTier: Record<EncounterTier, AfkEncounterConfig[]>;
  itemSeedById: Map<string, RuntimeItemSeed>;
};

let cachedRuntimeConfig: RuntimeGameConfig | null = null;

function buildAfkEncounterPoolByTier(pool: AfkEncounterConfig[]) {
  return pool.reduce<Record<EncounterTier, AfkEncounterConfig[]>>(
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
}

function buildRuntimeConfig(source: DynamicGameConfig): RuntimeGameConfig {
  return {
    ...source,
    afkEncounterPoolByTier: buildAfkEncounterPoolByTier(source.afkEncounterPool),
    itemSeedById: new Map(source.itemCatalog.map((item) => [item.itemId, item])),
  };
}

export async function loadRuntimeGameConfig(forceRefresh = false) {
  if (!cachedRuntimeConfig || forceRefresh) {
    cachedRuntimeConfig = buildRuntimeConfig(await getDynamicGameConfig());
  }

  return cachedRuntimeConfig;
}

export async function refreshRuntimeGameConfig() {
  cachedRuntimeConfig = buildRuntimeConfig(await getDynamicGameConfig());
  return cachedRuntimeConfig;
}

export async function getRaceConfigs(): Promise<RaceConfig[]> {
  return (await loadRuntimeGameConfig()).raceConfigs;
}

export async function getClassConfigs(): Promise<ClassConfig[]> {
  return (await loadRuntimeGameConfig()).classConfigs;
}

export async function getMapConfigs(): Promise<MapConfig[]> {
  return (await loadRuntimeGameConfig()).mapConfigs;
}

export async function getAfkEncounterChances(): Promise<Record<EncounterTier, number>> {
  return (await loadRuntimeGameConfig()).afkEncounterChances;
}

export async function getAfkEncounterPool(): Promise<AfkEncounterConfig[]> {
  return (await loadRuntimeGameConfig()).afkEncounterPool;
}

export async function getAfkEncounterPoolByTier() {
  return (await loadRuntimeGameConfig()).afkEncounterPoolByTier;
}

export async function getBattleEnemyTemplates(): Promise<BattleEnemyTemplate[]> {
  return (await loadRuntimeGameConfig()).battleEnemyTemplates;
}

export async function getItemCatalog(): Promise<RuntimeItemSeed[]> {
  return (await loadRuntimeGameConfig()).itemCatalog;
}

export async function getItemSeedById() {
  return (await loadRuntimeGameConfig()).itemSeedById;
}

export async function getItemSeed(itemId: string) {
  return (await getItemSeedById()).get(itemId) ?? null;
}

export async function getSystemBalance(): Promise<SystemBalanceConfig> {
  return (await loadRuntimeGameConfig()).systemBalance;
}

export function getLevelTable() {
  return Array.from({ length: LEVEL_CAP }, (_, index) => ({
    level: index + 1,
    totalExpRequired: getLevelBaseExp(index + 1),
  }));
}

export function getBodySlotCapacitiesFromRace(raceKey: string, raceConfigs: RaceConfig[]): BodySlotCapacities {
  const race = raceConfigs.find((item) => item.key === raceKey) ?? null;
  const adjustments = race?.bodySlotAdjustments ?? {};

  return {
    head: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.head + (adjustments.head ?? 0)),
    hand: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.hand + (adjustments.hand ?? 0)),
    torso: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.torso + (adjustments.torso ?? 0)),
    legs: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.legs + (adjustments.legs ?? 0)),
    feet: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.feet + (adjustments.feet ?? 0)),
    neck: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.neck + (adjustments.neck ?? 0)),
    accessory: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.accessory + (adjustments.accessory ?? 0)),
  };
}

export function getBodySlotTypeLabelRuntime(slotType: BodySlotType) {
  return {
    head: "头部",
    hand: "手部",
    torso: "上身",
    legs: "下身",
    feet: "脚部",
    neck: "脖颈",
    accessory: "饰品",
  }[slotType] ?? slotType;
}

export async function getRaceConfigByKey(raceKey: string) {
  return (await getRaceConfigs()).find((item) => item.key === raceKey) ?? null;
}

export async function getClassConfigByKey(classKey: string) {
  return (await getClassConfigs()).find((item) => item.key === classKey) ?? null;
}

export async function getMapConfigByKey(mapKey: string) {
  return (await getMapConfigs()).find((item) => item.key === mapKey) ?? null;
}

export async function isValidRaceKeyRuntime(value: string) {
  return (await getRaceConfigs()).some((item) => item.key === value);
}

export async function isValidClassKeyRuntime(value: string) {
  return (await getClassConfigs()).some((item) => item.key === value);
}

export async function isValidMapKeyRuntime(value: string) {
  return (await getMapConfigs()).some((item) => item.key === value);
}

export async function getCreateRoleOptionsRuntime() {
  const [classes, races] = await Promise.all([getClassConfigs(), getRaceConfigs()]);
  return { classes, races };
}

export {
  AFK_TASK_SECONDS,
  BASE_HEALTH,
  EXP_GROWTH_PER_LEVEL,
  EXP_PER_LEVEL,
  HEALTH_PER_LEVEL,
  HEALTH_PER_VITALITY,
  LEVEL_CAP,
  LEVEL_CURVE_VERSION,
  MAX_OFFLINE_SECONDS,
};

export type {
  AfkEncounterConfig,
  BattleEnemyTemplate,
  ClassConfig,
  EncounterTier,
  ItemRarity,
  MapConfig,
  RaceConfig,
  SystemBalanceConfig,
};
