export type RaceKey = "human" | "elf" | "dwarf";
export type ClassKey = "warrior" | "mage" | "farmer";
export type MapKey = "palmia-wilds";
export type PanelKey = "role" | "backpack" | "afk" | "market";
export type EncounterTier = "common" | "rare" | "legendary";
export type ItemRarity = "white" | "green" | "blue" | "purple" | "orange";
export type BodySlotType = "head" | "hand" | "torso" | "legs" | "feet" | "neck" | "accessory";
export type BodySlotCapacities = Record<BodySlotType, number>;

export type Stats = {
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
};

export type RaceConfig = {
  key: RaceKey;
  label: string;
  summary: string;
  stats: Stats;
  bodySlotAdjustments?: Partial<BodySlotCapacities>;
};

export type ClassConfig = {
  key: ClassKey;
  label: string;
  summary: string;
  stats: Stats;
  starterItemId: string;
};

export type MapConfig = {
  key: MapKey;
  label: string;
  summary: string;
  goldPerMinute: number;
  aetherPerMinute: number;
  expPerMinute: number;
};

export type AfkEncounterReward = {
  gold: number;
  aetherCrystal: number;
  exp: number;
  healthDelta?: number;
  items?: Array<{
    itemId: string;
    quantity: number;
    name?: string;
    rarity?: ItemRarity;
  }>;
};

export type AfkEncounterConfig = {
  key: string;
  tier: EncounterTier;
  title: string;
  description: string;
  reward: AfkEncounterReward;
};

export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
export const AFK_TASK_SECONDS = 10;
export const LEVEL_CAP = 30;
export const EXP_PER_LEVEL = 100;
export const EXP_GROWTH_PER_LEVEL = 10;
export const LEVEL_CURVE_VERSION = 2;
export const BASE_HEALTH = 50;
export const HEALTH_PER_VITALITY = 12;
export const HEALTH_PER_LEVEL = 2;
export const DEFAULT_BODY_SLOT_CAPACITIES: BodySlotCapacities = {
  head: 1,
  hand: 2,
  torso: 1,
  legs: 1,
  feet: 1,
  neck: 1,
  accessory: 2,
};

export const raceConfigs: RaceConfig[] = [
  {
    key: "human",
    label: "人类",
    summary: "四维均衡，最适合当前版本的万能开荒模版。",
    stats: { strength: 5, agility: 5, intelligence: 5, vitality: 5 },
  },
  {
    key: "elf",
    label: "精灵",
    summary: "速度和法感更高，挂机效率偏灵巧与法术。",
    stats: { strength: 3, agility: 7, intelligence: 7, vitality: 3 },
    bodySlotAdjustments: { accessory: 1 },
  },
  {
    key: "dwarf",
    label: "矮人",
    summary: "更硬更稳，适合站桩和长期刷图。",
    stats: { strength: 7, agility: 3, intelligence: 3, vitality: 7 },
    bodySlotAdjustments: { accessory: -1 },
  },
];

export const classConfigs: ClassConfig[] = [
  {
    key: "warrior",
    label: "战士",
    summary: "近战起步快，初始金币与白装最实用。",
    starterItemId: "rusty-blade",
    stats: { strength: 4, agility: 2, intelligence: 0, vitality: 3 },
  },
  {
    key: "mage",
    label: "法师",
    summary: "智力成长高，预计收益里的经验占比更高。",
    starterItemId: "oak-staff",
    stats: { strength: 0, agility: 2, intelligence: 5, vitality: 2 },
  },
  {
    key: "farmer",
    label: "农民",
    summary: "务实稳定，适合当前版本的挂机与资源周转。",
    starterItemId: "field-hoe",
    stats: { strength: 2, agility: 2, intelligence: 1, vitality: 4 },
  },
];

export const mapConfigs: MapConfig[] = [
  {
    key: "palmia-wilds",
    label: "野外",
    summary: "收益平衡，适合刚创角时开第一张图。",
    goldPerMinute: 20,
    aetherPerMinute: 0.25,
    expPerMinute: 10,
  },
];

export const afkEncounterChances: Record<EncounterTier, number> = {
  common: 0.1,
  rare: 0.01,
  legendary: 0.001,
};

export const afkEncounterPool: AfkEncounterConfig[] = [
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

export function getExpRequiredForLevel(level: number) {
  const safeLevel = Math.min(LEVEL_CAP - 1, Math.max(1, Math.floor(level)));
  return EXP_PER_LEVEL + (safeLevel - 1) * EXP_GROWTH_PER_LEVEL;
}

export function getLevelBaseExp(level: number) {
  const safeLevel = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  const completedLevels = safeLevel - 1;

  return (
    completedLevels * EXP_PER_LEVEL
    + ((completedLevels * Math.max(0, completedLevels - 1)) / 2) * EXP_GROWTH_PER_LEVEL
  );
}

export const levelTable = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: getLevelBaseExp(index + 1),
}));

export function getRaceConfig(raceKey: RaceKey) {
  return raceConfigs.find((item) => item.key === raceKey) ?? null;
}

export function getClassConfig(classKey: ClassKey) {
  return classConfigs.find((item) => item.key === classKey) ?? null;
}

export function getMapConfig(mapKey: MapKey) {
  return mapConfigs.find((item) => item.key === mapKey) ?? null;
}

export function getBodySlotCapacities(raceKey: RaceKey) {
  const race = getRaceConfig(raceKey);
  const adjustments = race?.bodySlotAdjustments ?? {};

  return {
    head: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.head + (adjustments.head ?? 0)),
    hand: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.hand + (adjustments.hand ?? 0)),
    torso: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.torso + (adjustments.torso ?? 0)),
    legs: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.legs + (adjustments.legs ?? 0)),
    feet: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.feet + (adjustments.feet ?? 0)),
    neck: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.neck + (adjustments.neck ?? 0)),
    accessory: Math.max(0, DEFAULT_BODY_SLOT_CAPACITIES.accessory + (adjustments.accessory ?? 0)),
  } satisfies BodySlotCapacities;
}

export function getBodySlotTypeLabel(slotType: BodySlotType) {
  return {
    head: "头部",
    hand: "手部",
    torso: "上身",
    legs: "下身",
    feet: "脚部",
    neck: "脖颈",
    accessory: "饰品",
  }[slotType];
}

export function getLevelFromExp(exp: number) {
  const safeExp = Math.max(0, Math.floor(exp));

  for (let index = levelTable.length - 1; index >= 0; index -= 1) {
    if (safeExp >= levelTable[index].totalExpRequired) {
      return levelTable[index].level;
    }
  }

  return 1;
}

export function getMaxHealth(vitality: number, level: number) {
  return (
    BASE_HEALTH
    + Math.max(0, Math.floor(vitality)) * HEALTH_PER_VITALITY
    + Math.max(1, Math.floor(level)) * HEALTH_PER_LEVEL
  );
}

export function getCurrentLevelProgress(exp: number) {
  const currentLevel = getLevelFromExp(exp);
  const currentBase = getLevelBaseExp(currentLevel);
  const nextLevelExp = currentLevel >= LEVEL_CAP ? 0 : getExpRequiredForLevel(currentLevel);

  return {
    currentLevel,
    currentLevelExp: Math.max(0, exp - currentBase),
    nextLevelExp,
  };
}
