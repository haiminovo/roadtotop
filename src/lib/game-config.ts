export type RaceKey = "human" | "elf" | "dwarf";
export type ClassKey = "warrior" | "mage" | "farmer";
export type MapKey = "palmia-wilds";
export type PanelKey = "role" | "backpack" | "afk";
export type EncounterTier = "common" | "rare" | "legendary";
export type ItemRarity = "white" | "green" | "blue" | "purple" | "orange";

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
  },
  {
    key: "dwarf",
    label: "矮人",
    summary: "更硬更稳，适合站桩和长期刷图。",
    stats: { strength: 7, agility: 3, intelligence: 3, vitality: 7 },
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
  common: 0.001,
  rare: 0.0001,
  legendary: 0.00001,
};

export const afkEncounterPool: AfkEncounterConfig[] = [
  {
    key: "wanderer-cache",
    tier: "common",
    title: "拾荒者的暗袋",
    description: "你在枯树根下翻出一只旧布袋，里面还残留着些许可用物资。",
    reward: { gold: 28, aetherCrystal: 0, exp: 8, items: [{ itemId: "scout-bracers", quantity: 1 }] },
  },
  {
    key: "mossy-altar",
    tier: "common",
    title: "长苔石坛",
    description: "路边石坛上还留着未散的微光，你靠近后精神为之一振。",
    reward: { gold: 12, aetherCrystal: 1, exp: 10, items: [{ itemId: "leather-cap", quantity: 1 }] },
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
    reward: { gold: 0, aetherCrystal: 1, exp: 14 },
  },
  {
    key: "crystal-burrow",
    tier: "rare",
    title: "隐晶兽巢",
    description: "灌木后藏着一处被废弃的兽巢，里面滚落出几枚完整结晶。",
    reward: { gold: 120, aetherCrystal: 4, exp: 36, items: [{ itemId: "amber-charm", quantity: 1 }] },
  },
  {
    key: "forgotten-caravan",
    tier: "rare",
    title: "失落商队",
    description: "你在旧车辙旁找到半埋的补给箱，像是某支商队遗落的库存。",
    reward: { gold: 168, aetherCrystal: 2, exp: 28, items: [{ itemId: "hunter-leathers", quantity: 1 }] },
  },
  {
    key: "moonlit-guidance",
    tier: "rare",
    title: "月影指引",
    description: "短暂闪过的银白轨迹为你指明了近路，也让你看清了更多细节。",
    reward: { gold: 88, aetherCrystal: 3, exp: 56, items: [{ itemId: "moonshadow-dagger", quantity: 1 }] },
  },
  {
    key: "dragonbone-relic",
    tier: "legendary",
    title: "龙骨遗辉",
    description: "你在荒野深处碰见一截仍在低鸣的龙骨，其残响将力量灌入你的血脉。",
    reward: { gold: 888, aetherCrystal: 18, exp: 220, items: [{ itemId: "knightwatch-mail", quantity: 1 }] },
  },
  {
    key: "starlight-vault",
    tier: "legendary",
    title: "星辉秘匣",
    description: "古老封印在你面前自行开启，匣中溢出的星光化作了惊人的收获。",
    reward: { gold: 1280, aetherCrystal: 12, exp: 188, items: [{ itemId: "dawnfire-pendant", quantity: 1 }] },
  },
];

export const levelTable = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: index * EXP_PER_LEVEL,
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

export function getLevelFromExp(exp: number) {
  return Math.min(LEVEL_CAP, Math.floor(Math.max(0, exp) / EXP_PER_LEVEL) + 1);
}

export function getCurrentLevelProgress(exp: number) {
  const currentLevel = getLevelFromExp(exp);
  const currentBase = (currentLevel - 1) * EXP_PER_LEVEL;
  const nextRequirement =
    currentLevel >= LEVEL_CAP ? currentBase : currentLevel * EXP_PER_LEVEL;

  return {
    currentLevel,
    currentLevelExp: Math.max(0, exp - currentBase),
    nextLevelExp: currentLevel >= LEVEL_CAP ? 0 : nextRequirement - currentBase,
  };
}
