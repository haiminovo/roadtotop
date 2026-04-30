export type RaceKey = "human" | "elf" | "dwarf";
export type ClassKey = "warrior" | "mage" | "farmer";
export type MapKey = "palmia-wilds";
export type PanelKey = "role" | "backpack" | "task" | "afk" | "settings" | "help";

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

export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
export const AFK_TASK_SECONDS = 10;
export const LEVEL_CAP = 30;
export const EXP_PER_LEVEL = 100;

export const raceConfigs: RaceConfig[] = [
  {
    key: "human",
    label: "人类",
    summary: "四维均衡，最适合 Day0 的万能开荒模版。",
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
    summary: "务实稳定，适合 Day0 的挂机与资源周转。",
    starterItemId: "field-hoe",
    stats: { strength: 2, agility: 2, intelligence: 1, vitality: 4 },
  },
];

export const mapConfigs: MapConfig[] = [
  {
    key: "palmia-wilds",
    label: "帕罗米亚野外",
    summary: "收益平衡，适合刚创角时开第一张图。",
    goldPerMinute: 20,
    aetherPerMinute: 0.25,
    expPerMinute: 10,
  },
];

export const levelTable = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: index * EXP_PER_LEVEL,
}));

export const starterTaskTemplates = [
  {
    code: "create-role",
    title: "启程准备",
    description: "完成一次角色创建，正式进入伊洛纳的挂机世界。",
    target: 1,
    rewardGold: 80,
    rewardExp: 30,
  },
  {
    code: "first-afk",
    title: "第一次挂机",
    description: "选择任意地图开始挂机一次。",
    target: 1,
    rewardGold: 120,
    rewardExp: 40,
  },
];

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
