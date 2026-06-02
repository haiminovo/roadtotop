export type RaceKey = "human" | "elf" | "dwarf" | "orc" | "lizardfolk" | "moonkin";
export type ClassKey = "warrior" | "mage" | "farmer" | "ranger" | "priest" | "rogue";
export type MapKey = string;
export type ActivityKey = string;
export type PanelKey = "role" | "backpack" | "afk" | "market";
export type EncounterTier = "common" | "rare" | "legendary";
export type ItemRarity = "white" | "green" | "blue" | "purple" | "orange";
export type GameItemType = "equipment" | "skill_book" | "material";
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
  iconKey?: string;
  stats: Stats;
  bodySlotAdjustments?: Partial<BodySlotCapacities>;
};

export type ClassConfig = {
  key: ClassKey;
  label: string;
  summary: string;
  iconKey?: string;
  stats: Stats;
  starterItemId: string;
};

export type ActivityConfig = {
  key: ActivityKey;
  label: string;
  summary: string;
  iconKey?: string;
  taskDurationSeconds: number;
  baseEncounterChance: number;
};

export type MapConfig = {
  key: MapKey;
  label: string;
  summary: string;
  activityKey: ActivityKey;
  minLevel: number;
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
    itemType?: GameItemType;
    skillKey?: string;
  }>;
};

export type AfkEncounterConfig = {
  key: string;
  tier: EncounterTier;
  mapKeys?: MapKey[];
  activityKey?: ActivityKey;
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
    iconKey: "GiHumanTarget",
    stats: { strength: 5, agility: 5, intelligence: 5, vitality: 5 },
  },
  {
    key: "elf",
    label: "精灵",
    summary: "速度和法感更高，行动效率偏灵巧与法术。",
    iconKey: "GiElfEar",
    stats: { strength: 3, agility: 7, intelligence: 7, vitality: 3 },
    bodySlotAdjustments: { accessory: 1 },
  },
  {
    key: "dwarf",
    label: "矮人",
    summary: "更硬更稳，适合站桩和长期刷图。",
    iconKey: "GiDwarfFace",
    stats: { strength: 7, agility: 3, intelligence: 3, vitality: 7 },
    bodySlotAdjustments: { accessory: -1 },
  },
  {
    key: "orc",
    label: "兽人",
    summary: "力量与体质极强，能以更凶悍的方式推进战斗。",
    iconKey: "GiOrcHead",
    stats: { strength: 8, agility: 4, intelligence: 2, vitality: 6 },
    bodySlotAdjustments: { hand: 1, accessory: -1 },
  },
  {
    key: "lizardfolk",
    label: "蜥蜴人",
    summary: "爆发速度与生存能力兼具，擅长拉扯和持续作战。",
    iconKey: "GiLizardman",
    stats: { strength: 4, agility: 8, intelligence: 4, vitality: 6 },
    bodySlotAdjustments: { feet: 1 },
  },
  {
    key: "moonkin",
    label: "月裔",
    summary: "智力成长极高，偏向法术和控制流派。",
    iconKey: "GiMoon",
    stats: { strength: 2, agility: 4, intelligence: 9, vitality: 5 },
    bodySlotAdjustments: { neck: 1 },
  },
];

export const classConfigs: ClassConfig[] = [
  {
    key: "warrior",
    label: "战士",
    summary: "近战起步快，初始金币与白装最实用。",
    iconKey: "GiBroadsword",
    starterItemId: "rusty-blade",
    stats: { strength: 4, agility: 2, intelligence: 0, vitality: 3 },
  },
  {
    key: "mage",
    label: "法师",
    summary: "智力成长高，预计收益里的经验占比更高。",
    iconKey: "GiWizardStaff",
    starterItemId: "oak-staff",
    stats: { strength: 0, agility: 2, intelligence: 5, vitality: 2 },
  },
  {
    key: "farmer",
    label: "农民",
    summary: "务实稳定，适合当前版本的行动与资源周转。",
    iconKey: "GiPitchfork",
    starterItemId: "field-hoe",
    stats: { strength: 2, agility: 2, intelligence: 1, vitality: 4 },
  },
  {
    key: "ranger",
    label: "游侠",
    summary: "偏敏捷与机动，擅长抢节奏和持续输出。",
    iconKey: "GiArrowhead",
    starterItemId: "training-bow",
    stats: { strength: 2, agility: 5, intelligence: 1, vitality: 2 },
  },
  {
    key: "priest",
    label: "祭司",
    summary: "法术与续航更稳，适合中后期滚雪球。",
    iconKey: "GiPrayer",
    starterItemId: "whisper-wand",
    stats: { strength: 1, agility: 1, intelligence: 4, vitality: 3 },
  },
  {
    key: "rogue",
    label: "潜行者",
    summary: "上手快、爆发高，适合喜欢高风险高收益的玩家。",
    iconKey: "GiDaggers",
    starterItemId: "bronze-longsword",
    stats: { strength: 3, agility: 5, intelligence: 1, vitality: 1 },
  },
];

export const activityConfigs: ActivityConfig[] = [
  {
    key: "combat",
    label: "战斗",
    summary: "在野外与怪物战斗，获取经验和装备。",
    iconKey: "GiCrossedSwords",
    taskDurationSeconds: 10,
    baseEncounterChance: 0.06,
  },
  {
    key: "gathering",
    label: "采集",
    summary: "在森林和矿山中采集资源。",
    iconKey: "GiHerbsBundle",
    taskDurationSeconds: 15,
    baseEncounterChance: 0.04,
  },
  {
    key: "fishing",
    label: "钓鱼",
    summary: "在湖泊和河流中钓鱼，获取食材和稀有材料。",
    iconKey: "GiFishing",
    taskDurationSeconds: 20,
    baseEncounterChance: 0.03,
  },
];

export const mapConfigs: MapConfig[] = [
  {
    key: "palmia-wilds",
    label: "野外",
    summary: "收益平衡，适合刚创角时开第一张图。",
    activityKey: "combat",
    minLevel: 1,
    goldPerMinute: 20,
    aetherPerMinute: 0.25,
    expPerMinute: 10,
  },
  {
    key: "moonfall-ruins",
    label: "月陨遗迹",
    summary: "更危险的废墟地带，奖励更高，也会出现更强的敌人与稀有奇遇。",
    activityKey: "combat",
    minLevel: 5,
    goldPerMinute: 42,
    aetherPerMinute: 0.7,
    expPerMinute: 22,
  },
  {
    key: "timber-camp",
    label: "伐木林场",
    summary: "稳定产出木材和树脂，适合采集新手。",
    activityKey: "gathering",
    minLevel: 1,
    goldPerMinute: 8,
    aetherPerMinute: 0.1,
    expPerMinute: 8,
  },
  {
    key: "iron-vein-mine",
    label: "浅层矿脉",
    summary: "采集矿石，偶尔挖到以太晶矿。",
    activityKey: "gathering",
    minLevel: 3,
    goldPerMinute: 10,
    aetherPerMinute: 0.18,
    expPerMinute: 9,
  },
  {
    key: "misty-lake",
    label: "薄雾湖",
    summary: "湖面常年薄雾笼罩，盛产淡水鱼群。",
    activityKey: "fishing",
    minLevel: 2,
    goldPerMinute: 12,
    aetherPerMinute: 0.15,
    expPerMinute: 7,
  },
  {
    key: "crystal-stream",
    label: "晶溪",
    summary: "溪水清澈见底，偶尔能钓到带有微光的稀有鱼种。",
    activityKey: "fishing",
    minLevel: 4,
    goldPerMinute: 18,
    aetherPerMinute: 0.3,
    expPerMinute: 11,
  },
];

export const afkEncounterChances: Record<EncounterTier, number> = {
  common: 0.06,
  rare: 0.006,
  legendary: 0.0005,
};

export const afkEncounterPool: AfkEncounterConfig[] = [
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
  {
    key: "fallen-watchtower",
    mapKeys: ["palmia-wilds"],
    tier: "common",
    title: "坍塌哨塔",
    description: "你在破败哨塔间翻找，只捡到一袋零钱和几页残旧记录。",
    reward: { gold: 44, aetherCrystal: 0, exp: 10, items: [{ itemId: "material-wolf-fang", quantity: 1 }] },
  },
  {
    key: "herbal-hollow",
    mapKeys: ["palmia-wilds"],
    tier: "common",
    title: "草药浅坑",
    description: "地面草药气味浓重，你顺手调配出止痛药膏，缓住了伤势。",
    reward: { gold: 8, aetherCrystal: 1, exp: 10, healthDelta: 16 },
  },
  {
    key: "old-snare-line",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    tier: "common",
    title: "旧捕索线",
    description: "你险些踩中废弃捕索，躲开后仍被擦伤，幸好补给还算完整。",
    reward: { gold: 30, aetherCrystal: 0, exp: 9, healthDelta: -8 },
  },
  {
    key: "echoing-crevice",
    mapKeys: ["moonfall-ruins"],
    tier: "rare",
    title: "回响裂隙",
    description: "你在裂隙深处听见规律回响，顺着回声找到了隐藏晶簇。",
    reward: { gold: 112, aetherCrystal: 5, exp: 52, healthDelta: -12, items: [{ itemId: "material-crystal-shard", quantity: 2 }] },
  },
  {
    key: "ashen-cache",
    mapKeys: ["moonfall-ruins"],
    tier: "rare",
    title: "烬灰补给箱",
    description: "被灰烬掩埋的军用补给箱仍能开启，里面残存着完好的护具。",
    reward: { gold: 146, aetherCrystal: 2, exp: 34, items: [{ itemId: "runic-vest", quantity: 1 }] },
  },
  {
    key: "moonshard-choir",
    mapKeys: ["moonfall-ruins"],
    tier: "legendary",
    title: "月晶圣咏",
    description: "遍地碎晶突然共鸣，你在短暂失神中领悟并汲取了古老力量。",
    reward: {
      gold: 1560,
      aetherCrystal: 20,
      exp: 260,
      healthDelta: 48,
      items: [
        { itemId: "stormglass-staff", quantity: 1 },
        { itemId: "skillbook-arcane-burst", quantity: 1 },
        { itemId: "material-moon-dust", quantity: 2 },
      ],
    },
  },
  {
    key: "sunken-arsenal",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    tier: "legendary",
    title: "沉没军械所",
    description: "塌陷地窟深处藏着旧王朝军械，一件完好的传奇武装被你带走。",
    reward: { gold: 1488, aetherCrystal: 15, exp: 238, healthDelta: -20, items: [{ itemId: "knightwatch-mail", quantity: 1 }] },
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

export function getActivityConfig(activityKey: ActivityKey) {
  return activityConfigs.find((item) => item.key === activityKey) ?? null;
}

export function getMapsByActivity(activityKey: ActivityKey) {
  return mapConfigs.filter((map) => map.activityKey === activityKey);
}

export function isMapUnlocked(mapConfig: MapConfig, roleLevel: number): boolean {
  return roleLevel >= mapConfig.minLevel;
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
