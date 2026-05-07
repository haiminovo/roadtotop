import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import type {
  AfkEncounterConfig,
  BodySlotCapacities,
  BodySlotType,
  ClassConfig,
  EncounterTier,
  GameItemType,
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
  fixedSkillKeys?: string[];
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

export type SkillEffectType =
  | "attack_up"
  | "attack_down"
  | "defense_up"
  | "defense_down"
  | "damage_over_time"
  | "heal_over_time"
  | "intelligence_up"
  | "intelligence_down"
  | "vitality_up"
  | "vitality_down"
  | "agility_up"
  | "agility_down"
  | "interrupt_cast";

export type SkillEffectTarget = "self" | "ally" | "enemy";

export type SkillEffectTemplate = {
  key: string;
  name: string;
  description: string;
  effectType: SkillEffectType;
  target: SkillEffectTarget;
  durationTurns: number;
  magnitude: number;
};

export type SkillTemplate = {
  key: string;
  name: string;
  iconText: string;
  description: string;
  quality: "white" | "green" | "blue" | "purple" | "orange";
  category: "attack" | "spell" | "guard";
  trigger: string;
  acquisitionHint: string;
  source?: "learned" | "enemy";
  maxLevel: number;
  damageMultiplier: number;
  levelDamageGrowth: number;
  healRatio: number;
  levelHealGrowth: number;
  guardRatio: number;
  levelGuardGrowth: number;
  maxUses: number;
  cooldownTurns: number;
  effects: SkillEffectTemplate[];
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

export type GameEventTriggerType = "afk_tick" | "enemy_kill";

export type GameEventActionType =
  | "grant_gold"
  | "grant_aether"
  | "grant_exp"
  | "adjust_health"
  | "grant_item";

export type GameEventTrigger = {
  type: GameEventTriggerType;
  mapKeys?: string[];
  enemyKeys?: string[];
};

export type GameEventAction = {
  type: GameEventActionType;
  chance?: number;
  amount?: number;
  min?: number;
  max?: number;
  itemId?: string;
  quantity?: number;
};

export type GameEventEncounterMeta = {
  tier?: EncounterTier;
  title?: string;
  description?: string;
};

export type GameEventRule = {
  key: string;
  name: string;
  enabled: boolean;
  priority: number;
  chance: number;
  trigger: GameEventTrigger;
  actions: GameEventAction[];
  encounter?: GameEventEncounterMeta;
};

export type DynamicGameConfig = {
  afkEncounterChances: Record<EncounterTier, number>;
  afkEncounterPool: AfkEncounterConfig[];
  battleEnemyTemplates: BattleEnemyTemplate[];
  classConfigs: ClassConfig[];
  eventRules: GameEventRule[];
  itemCatalog: Array<{
    itemId: string;
    name: string;
    rarity: string;
    itemType: GameItemType;
    skillKey: string | null;
    iconKey: string | null;
    slot: BodySlotType;
    slotUsage: number;
    description: string;
    sellPrice: number;
    stats: Record<string, number>;
  }>;
  levelTable: Array<{ level: number; totalExpRequired: number }>;
  mapConfigs: MapConfig[];
  raceConfigs: RaceConfig[];
  skillTemplates: SkillTemplate[];
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

export type AdminRoleCreateInput = {
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
  common: 0.06,
  rare: 0.006,
  legendary: 0.0005,
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

const DEFAULT_BATTLE_ENEMIES: BattleEnemyTemplate[] = [
  {
    key: "stray-wolf",
    mapKeys: ["palmia-wilds"],
    name: "荒原孤狼",
    summary: "敏捷高、出手快，喜欢趁空档撕咬。",
    fixedSkillKeys: ["enemy-brace"],
    skillCaps: { guard: 1, spell: 0 },
    statWeights: { agility: 1.15, intelligence: 0.45, strength: 0.9, vitality: 0.85 },
  },
  {
    key: "bandit-scout",
    mapKeys: ["palmia-wilds"],
    name: "流匪斥候",
    summary: "动作灵活，偶尔会抓时机用投刃压血线。",
    fixedSkillKeys: ["enemy-chaos-spell"],
    skillCaps: { guard: 1, spell: 2 },
    statWeights: { agility: 1.05, intelligence: 0.65, strength: 0.95, vitality: 0.9 },
  },
  {
    key: "ruin-mage",
    mapKeys: ["moonfall-ruins"],
    name: "遗迹术士",
    summary: "智力偏高，擅长在残血时用法术收尾。",
    fixedSkillKeys: ["enemy-chaos-spell"],
    skillCaps: { guard: 1, spell: 3 },
    statWeights: { agility: 0.75, intelligence: 1.25, strength: 0.55, vitality: 0.95 },
  },
  {
    key: "stonehide-boar",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    name: "石皮野猪",
    summary: "血厚皮硬，撞击前摇慢但很难被秒掉。",
    fixedSkillKeys: ["enemy-brace"],
    skillCaps: { guard: 1, spell: 0 },
    statWeights: { agility: 0.65, intelligence: 0.25, strength: 1, vitality: 1.15 },
  },
  {
    key: "moonshard-sentinel",
    mapKeys: ["moonfall-ruins"],
    name: "月碎守卫",
    summary: "驻守在遗迹深处的残损傀儡，会用晶片爆发压制血线。",
    fixedSkillKeys: ["enemy-brace", "enemy-chaos-spell"],
    skillCaps: { guard: 2, spell: 2 },
    statWeights: { agility: 0.9, intelligence: 1.1, strength: 1.05, vitality: 1.2 },
  },
  {
    key: "gloomfang-panther",
    mapKeys: ["palmia-wilds", "moonfall-ruins"],
    name: "黯牙影豹",
    summary: "会利用地形突袭，攻势凌厉且具有压制力。",
    fixedSkillKeys: ["enemy-chaos-spell"],
    skillCaps: { guard: 1, spell: 1 },
    statWeights: { agility: 1.25, intelligence: 0.7, strength: 1.05, vitality: 0.95 },
  },
  {
    key: "sunken-warden",
    mapKeys: ["moonfall-ruins"],
    name: "沉渊看守者",
    summary: "古代重甲守卫，节奏慢但每次出手都极具威胁。",
    fixedSkillKeys: ["enemy-brace"],
    skillCaps: { guard: 2, spell: 1 },
    statWeights: { agility: 0.7, intelligence: 0.8, strength: 1.25, vitality: 1.35 },
  },
];

const DEFAULT_SKILL_TEMPLATES: SkillTemplate[] = [
  {
    key: "focus-strike",
    name: "凝神重击",
    iconText: "斩",
    description: "集中精神后进行更狠的一击，是最容易入门的主动技能。",
    quality: "white",
    category: "attack",
    trigger: "random",
    acquisitionHint: "野外奇遇和训练系技能书都可能获取。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 2.15,
    levelDamageGrowth: 0.08,
    healRatio: 0,
    levelHealGrowth: 0,
    guardRatio: 0,
    levelGuardGrowth: 0,
    maxUses: 1,
    cooldownTurns: 0,
    effects: [
      {
        key: "focus-strike-defense-break",
        name: "破绽压制",
        description: "命中后削弱敌方防御。",
        effectType: "defense_down",
        target: "enemy",
        durationTurns: 2,
        magnitude: 0.12,
      },
    ],
  },
  {
    key: "iron-guard",
    name: "铁壁守势",
    iconText: "御",
    description: "摆出稳固架势，回复生命并获得短暂减伤。",
    quality: "green",
    category: "guard",
    trigger: "low-health",
    acquisitionHint: "战斗奇遇与守护型怪物掉落的技能书中较常见。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 0,
    levelDamageGrowth: 0,
    healRatio: 0.2,
    levelHealGrowth: 0.02,
    guardRatio: 0.48,
    levelGuardGrowth: 0.02,
    maxUses: 1,
    cooldownTurns: 2,
    effects: [
      {
        key: "iron-guard-defense-up",
        name: "铁壁",
        description: "提高自身防御。",
        effectType: "defense_up",
        target: "self",
        durationTurns: 2,
        magnitude: 0.45,
      },
      {
        key: "iron-guard-vitality-up",
        name: "稳固呼吸",
        description: "短暂强化体质。",
        effectType: "vitality_up",
        target: "self",
        durationTurns: 2,
        magnitude: 4,
      },
    ],
  },
  {
    key: "severing-strike",
    name: "断脉击",
    iconText: "断",
    description: "以精准斩击打乱对手蓄力节奏，适合克制依赖读条的敌人。",
    quality: "green",
    category: "attack",
    trigger: "random",
    acquisitionHint: "可从战斗奇遇或精英怪掉落的技能书中学会。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 2.05,
    levelDamageGrowth: 0.09,
    healRatio: 0,
    levelHealGrowth: 0,
    guardRatio: 0,
    levelGuardGrowth: 0,
    maxUses: 1,
    cooldownTurns: 0,
    effects: [
      {
        key: "severing-strike-interrupt",
        name: "断势",
        description: "命中后打断敌方读条。",
        effectType: "interrupt_cast",
        target: "enemy",
        durationTurns: 1,
        magnitude: 1,
      },
    ],
  },
  {
    key: "arcane-burst",
    name: "奥术爆裂",
    iconText: "奥",
    description: "压缩法力形成爆裂法球，擅长稳定收尾。",
    quality: "blue",
    category: "spell",
    trigger: "enemy-low-health",
    acquisitionHint: "法师初始传承，也可从月陨遗迹奇遇中重新参悟。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 2.8,
    levelDamageGrowth: 0.12,
    healRatio: 0,
    levelHealGrowth: 0,
    guardRatio: 0,
    levelGuardGrowth: 0,
    maxUses: 2,
    cooldownTurns: 0,
    effects: [
      {
        key: "arcane-burst-dot",
        name: "奥能灼蚀",
        description: "持续灼烧敌人。",
        effectType: "damage_over_time",
        target: "enemy",
        durationTurns: 3,
        magnitude: 0.22,
      },
      {
        key: "arcane-burst-int-down",
        name: "法感紊乱",
        description: "降低敌方智力。",
        effectType: "intelligence_down",
        target: "enemy",
        durationTurns: 2,
        magnitude: 3,
      },
    ],
  },
  {
    key: "venom-thrust",
    name: "毒牙突刺",
    iconText: "毒",
    description: "突进刺击后附带毒素，能在后续回合持续压低对手血线。",
    quality: "blue",
    category: "attack",
    trigger: "random",
    acquisitionHint: "可通过稀有奇遇与潜行者系技能书获得。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 2.25,
    levelDamageGrowth: 0.11,
    healRatio: 0,
    levelHealGrowth: 0,
    guardRatio: 0,
    levelGuardGrowth: 0,
    maxUses: 1,
    cooldownTurns: 0,
    effects: [
      {
        key: "venom-thrust-dot",
        name: "毒液侵蚀",
        description: "持续造成伤害。",
        effectType: "damage_over_time",
        target: "enemy",
        durationTurns: 3,
        magnitude: 0.2,
      },
      {
        key: "venom-thrust-agi-down",
        name: "筋络麻痹",
        description: "降低敌方敏捷。",
        effectType: "agility_down",
        target: "enemy",
        durationTurns: 2,
        magnitude: 3,
      },
    ],
  },
  {
    key: "moon-prayer",
    name: "月祷庇佑",
    iconText: "祷",
    description: "祈愿月辉护体，短时间内恢复生命并提高防御。",
    quality: "purple",
    category: "guard",
    trigger: "low-health",
    acquisitionHint: "祭司职业传承或传说奇遇技能书。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 0,
    levelDamageGrowth: 0,
    healRatio: 0.26,
    levelHealGrowth: 0.03,
    guardRatio: 0.52,
    levelGuardGrowth: 0.02,
    maxUses: 1,
    cooldownTurns: 2,
    effects: [
      {
        key: "moon-prayer-defense-up",
        name: "圣辉护障",
        description: "提高自身防御。",
        effectType: "defense_up",
        target: "self",
        durationTurns: 2,
        magnitude: 0.42,
      },
      {
        key: "moon-prayer-hot",
        name: "余晖回流",
        description: "每回合恢复生命。",
        effectType: "heal_over_time",
        target: "self",
        durationTurns: 2,
        magnitude: 0.1,
      },
    ],
  },
  {
    key: "storm-lance",
    name: "风暴穿枪",
    iconText: "岚",
    description: "凝聚风压与雷弧投射，命中后压制对手攻势。",
    quality: "purple",
    category: "spell",
    trigger: "enemy-low-health",
    acquisitionHint: "月陨遗迹深层奇遇与高阶法术书。",
    source: "learned",
    maxLevel: 10,
    damageMultiplier: 3.05,
    levelDamageGrowth: 0.14,
    healRatio: 0,
    levelHealGrowth: 0,
    guardRatio: 0,
    levelGuardGrowth: 0,
    maxUses: 2,
    cooldownTurns: 0,
    effects: [
      {
        key: "storm-lance-attack-down",
        name: "雷殛压制",
        description: "降低敌方攻击。",
        effectType: "attack_down",
        target: "enemy",
        durationTurns: 2,
        magnitude: 0.18,
      },
      {
        key: "storm-lance-int-down",
        name: "法流紊乱",
        description: "降低敌方智力。",
        effectType: "intelligence_down",
        target: "enemy",
        durationTurns: 2,
        magnitude: 4,
      },
    ],
  },
  {
    key: "enemy-chaos-spell",
    name: "混沌咒击",
    iconText: "咒",
    description: "怪物凝聚混乱能量发动法术攻击。",
    quality: "green",
    category: "spell",
    trigger: "enemy-low-health",
    acquisitionHint: "怪物天赋",
    source: "enemy",
    maxLevel: 10,
    damageMultiplier: 2.4,
    levelDamageGrowth: 0.1,
    healRatio: 0,
    levelHealGrowth: 0,
    guardRatio: 0,
    levelGuardGrowth: 0,
    maxUses: 2,
    cooldownTurns: 0,
    effects: [
      {
        key: "enemy-chaos-spell-dot",
        name: "混乱侵蚀",
        description: "对目标造成持续伤害。",
        effectType: "damage_over_time",
        target: "enemy",
        durationTurns: 2,
        magnitude: 0.16,
      },
    ],
  },
  {
    key: "enemy-brace",
    name: "野性护体",
    iconText: "守",
    description: "怪物本能驱动的防御姿态。",
    quality: "white",
    category: "guard",
    trigger: "low-health",
    acquisitionHint: "怪物天赋",
    source: "enemy",
    maxLevel: 10,
    damageMultiplier: 0,
    levelDamageGrowth: 0,
    healRatio: 0.08,
    levelHealGrowth: 0.01,
    guardRatio: 0.35,
    levelGuardGrowth: 0.02,
    maxUses: 1,
    cooldownTurns: 3,
    effects: [
      {
        key: "enemy-brace-defense-up",
        name: "野性皮膜",
        description: "提升自身防御。",
        effectType: "defense_up",
        target: "self",
        durationTurns: 2,
        magnitude: 0.3,
      },
      {
        key: "enemy-brace-hot",
        name: "生命回涌",
        description: "每回合恢复生命。",
        effectType: "heal_over_time",
        target: "self",
        durationTurns: 2,
        magnitude: 0.08,
      },
    ],
  },
];

const DEFAULT_ITEM_CATALOG: DynamicGameConfig["itemCatalog"] = [
  { itemId: "rusty-blade", name: "生锈短剑", rarity: "white", itemType: "equipment", skillKey: null, iconKey: "GiSwordman", slot: "hand", slotUsage: 1, description: "开荒时勉强能用的短剑。", sellPrice: 12, stats: { strength: 2 } },
  { itemId: "oak-staff", name: "橡木法杖", rarity: "white", itemType: "equipment", skillKey: null, iconKey: "GiWizardStaff", slot: "hand", slotUsage: 2, description: "粗糙的入门法杖，适合法师起步。", sellPrice: 12, stats: { intelligence: 2 } },
  { itemId: "field-hoe", name: "旧铁锄", rarity: "white", itemType: "equipment", skillKey: null, iconKey: "GiBattleAxe", slot: "hand", slotUsage: 2, description: "农活与近身防卫两不误的旧工具。", sellPrice: 10, stats: { vitality: 1, agility: 1 } },
  { itemId: "forest-cloak", name: "林地披风", rarity: "green", itemType: "equipment", skillKey: null, iconKey: "GiCloak", slot: "neck", slotUsage: 1, description: "轻便耐磨，适合野外挂机。", sellPrice: 30, stats: { agility: 2, vitality: 1 } },
  { itemId: "traveler-ring", name: "旅者戒指", rarity: "green", itemType: "equipment", skillKey: null, iconKey: "GiRing", slot: "accessory", slotUsage: 1, description: "会在冒险者启程时发放的基础指环。", sellPrice: 36, stats: { strength: 1, intelligence: 1, vitality: 1 } },
  { itemId: "training-bow", name: "练习短弓", rarity: "white", itemType: "equipment", skillKey: null, iconKey: "GiPocketBow", slot: "hand", slotUsage: 2, description: "拉力一般，但足够让新手学会瞄准与走位。", sellPrice: 18, stats: { agility: 2 } },
  { itemId: "leather-cap", name: "皮质便帽", rarity: "white", itemType: "equipment", skillKey: null, iconKey: "GiBilledCap", slot: "head", slotUsage: 1, description: "不起眼的小帽子，能挡一点风沙与碎石。", sellPrice: 14, stats: { vitality: 1, agility: 1 } },
  { itemId: "scout-bracers", name: "斥候护腕", rarity: "white", itemType: "equipment", skillKey: null, iconKey: "GiBracer", slot: "accessory", slotUsage: 1, description: "轻量护腕，让抬手与闪避动作更利落。", sellPrice: 16, stats: { agility: 1, intelligence: 1 } },
  { itemId: "bronze-longsword", name: "青铜长剑", rarity: "green", itemType: "equipment", skillKey: null, iconKey: "GiBroadsword", slot: "hand", slotUsage: 1, description: "保养得当的军用品，劈砍手感远胜生锈短剑。", sellPrice: 48, stats: { strength: 3, vitality: 1 } },
  { itemId: "whisper-wand", name: "低语木杖", rarity: "green", itemType: "equipment", skillKey: null, iconKey: "GiCrystalWand", slot: "hand", slotUsage: 1, description: "杖身会在夜里发出轻鸣，能稳定初阶法术。", sellPrice: 46, stats: { intelligence: 3, agility: 1 } },
  { itemId: "hunter-leathers", name: "猎人皮甲", rarity: "green", itemType: "equipment", skillKey: null, iconKey: "GiLeatherArmor", slot: "torso", slotUsage: 1, description: "柔韧结实，适合长时间追踪与奔行。", sellPrice: 54, stats: { agility: 2, vitality: 2 } },
  { itemId: "amber-charm", name: "琥珀护符", rarity: "green", itemType: "equipment", skillKey: null, iconKey: "GiCharm", slot: "neck", slotUsage: 1, description: "封着温热树脂的护符，能让心神更稳定。", sellPrice: 52, stats: { intelligence: 2, vitality: 1 } },
  { itemId: "moonshadow-dagger", name: "月影短匕", rarity: "blue", itemType: "equipment", skillKey: null, iconKey: "GiCurvyKnife", slot: "hand", slotUsage: 1, description: "刀锋轻薄如月光，适合迅捷而精准的出手。", sellPrice: 96, stats: { agility: 4, intelligence: 1 } },
  { itemId: "runic-vest", name: "符纹战衣", rarity: "blue", itemType: "equipment", skillKey: null, iconKey: "GiArmorVest", slot: "torso", slotUsage: 1, description: "内衬刻着细密符纹，兼顾防护与法感引导。", sellPrice: 104, stats: { intelligence: 3, vitality: 2 } },
  { itemId: "wolfbone-talisman", name: "狼骨符坠", rarity: "blue", itemType: "equipment", skillKey: null, iconKey: "GiGemPendant", slot: "accessory", slotUsage: 1, description: "粗犷却实用的护符，佩戴后胆气更足。", sellPrice: 98, stats: { strength: 2, agility: 2 } },
  { itemId: "stormglass-staff", name: "风暴晶杖", rarity: "purple", itemType: "equipment", skillKey: null, iconKey: "GiCrystalWand", slot: "hand", slotUsage: 2, description: "杖芯封着风暴碎晶，能显著放大施法者感知。", sellPrice: 188, stats: { intelligence: 5, agility: 2 } },
  { itemId: "knightwatch-mail", name: "守夜骑士甲", rarity: "purple", itemType: "equipment", skillKey: null, iconKey: "GiArmorVest", slot: "torso", slotUsage: 1, description: "历经修补的厚重甲胄，仍保留着可靠的守护感。", sellPrice: 210, stats: { strength: 3, vitality: 5 } },
  { itemId: "dawnfire-pendant", name: "晨焰坠饰", rarity: "orange", itemType: "equipment", skillKey: null, iconKey: "GiGemPendant", slot: "neck", slotUsage: 1, description: "内部像封着一缕朝阳，能同时提振体魄与精神。", sellPrice: 320, stats: { strength: 2, intelligence: 3, vitality: 3 } },
  { itemId: "obsidian-edge", name: "黑曜断刃", rarity: "orange", itemType: "equipment", skillKey: null, iconKey: "GiSwordman", slot: "hand", slotUsage: 1, description: "淬火黑曜石锻成的利刃，兼具穿透力与稳定性。", sellPrice: 338, stats: { strength: 6, agility: 2 } },
  { itemId: "skillbook-focus-strike", name: "技能书·凝神重击", rarity: "white", itemType: "skill_book", skillKey: "focus-strike", iconKey: "GiSpellBook", slot: "accessory", slotUsage: 1, description: "记录了基础斩击心法的技能书。学习后可掌握凝神重击。", sellPrice: 28, stats: {} },
  { itemId: "skillbook-iron-guard", name: "技能书·铁壁守势", rarity: "green", itemType: "skill_book", skillKey: "iron-guard", iconKey: "GiSpellBook", slot: "accessory", slotUsage: 1, description: "记载守势要诀的技能书。学习后可掌握铁壁守势。", sellPrice: 60, stats: {} },
  { itemId: "skillbook-arcane-burst", name: "技能书·奥术爆裂", rarity: "blue", itemType: "skill_book", skillKey: "arcane-burst", iconKey: "GiSpellBook", slot: "accessory", slotUsage: 1, description: "封存奥术结构的技能书。学习后可掌握奥术爆裂。", sellPrice: 110, stats: {} },
  { itemId: "material-wolf-fang", name: "狼牙", rarity: "white", itemType: "material", skillKey: null, iconKey: "GiMinerals", slot: "accessory", slotUsage: 1, description: "常见野兽掉落材料，可用于后续制作与任务。", sellPrice: 6, stats: {} },
  { itemId: "material-crystal-shard", name: "碎晶片", rarity: "green", itemType: "material", skillKey: null, iconKey: "GiCrystalCluster", slot: "accessory", slotUsage: 1, description: "奇遇与遗迹怪物常见材料，带有微弱能量。", sellPrice: 12, stats: {} },
  { itemId: "material-moon-dust", name: "月尘", rarity: "blue", itemType: "material", skillKey: null, iconKey: "GiPowder", slot: "accessory", slotUsage: 1, description: "稀有月辉残渣，多见于高阶奇遇与精英敌人。", sellPrice: 24, stats: {} },
];
const DEFAULT_SYSTEM_BALANCE: SystemBalanceConfig = {
  marketFeeRatePercent: 10,
  battleTriggerChance: 0.24,
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

const LEGACY_MATERIAL_DROP_POOL_BY_ENEMY_KEY: Record<string, Array<{ itemId: string; chance: number; min: number; max: number }>> = {
  "stray-wolf": [
    { itemId: "material-wolf-fang", chance: 0.35, min: 1, max: 2 },
  ],
  "bandit-scout": [
    { itemId: "material-wolf-fang", chance: 0.25, min: 1, max: 1 },
    { itemId: "material-crystal-shard", chance: 0.12, min: 1, max: 1 },
  ],
  "ruin-mage": [
    { itemId: "material-crystal-shard", chance: 0.3, min: 1, max: 2 },
    { itemId: "material-moon-dust", chance: 0.08, min: 1, max: 1 },
  ],
  "stonehide-boar": [
    { itemId: "material-wolf-fang", chance: 0.22, min: 1, max: 2 },
  ],
  "moonshard-sentinel": [
    { itemId: "material-crystal-shard", chance: 0.34, min: 1, max: 2 },
    { itemId: "material-moon-dust", chance: 0.12, min: 1, max: 1 },
  ],
  "gloomfang-panther": [
    { itemId: "material-wolf-fang", chance: 0.28, min: 1, max: 2 },
    { itemId: "material-moon-dust", chance: 0.06, min: 1, max: 1 },
  ],
  "sunken-warden": [
    { itemId: "material-crystal-shard", chance: 0.36, min: 1, max: 2 },
    { itemId: "material-moon-dust", chance: 0.15, min: 1, max: 1 },
  ],
};

const LEGACY_SKILL_BOOK_DROP_POOL_BY_ENEMY_KEY: Record<string, Array<{ itemId: string; chance: number; min: number; max: number }>> = {
  "stray-wolf": [
    { itemId: "skillbook-focus-strike", chance: 0.05, min: 1, max: 1 },
  ],
  "bandit-scout": [
    { itemId: "skillbook-focus-strike", chance: 0.06, min: 1, max: 1 },
  ],
  "ruin-mage": [
    { itemId: "skillbook-arcane-burst", chance: 0.04, min: 1, max: 1 },
  ],
  "stonehide-boar": [
    { itemId: "skillbook-iron-guard", chance: 0.04, min: 1, max: 1 },
  ],
  "moonshard-sentinel": [
    { itemId: "skillbook-arcane-burst", chance: 0.05, min: 1, max: 1 },
    { itemId: "skillbook-iron-guard", chance: 0.04, min: 1, max: 1 },
  ],
  "gloomfang-panther": [
    { itemId: "skillbook-focus-strike", chance: 0.05, min: 1, max: 1 },
  ],
  "sunken-warden": [
    { itemId: "skillbook-iron-guard", chance: 0.06, min: 1, max: 1 },
    { itemId: "skillbook-arcane-burst", chance: 0.06, min: 1, max: 1 },
  ],
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

function asItemType(value: unknown): GameItemType {
  return value === "skill_book" || value === "material" || value === "equipment"
    ? value
    : "equipment";
}

function asSkillCategory(value: unknown): SkillTemplate["category"] {
  return value === "attack" || value === "spell" || value === "guard" ? value : "attack";
}

function asSkillEffectType(value: unknown): SkillEffectType {
  return value === "attack_up"
    || value === "attack_down"
    || value === "defense_up"
    || value === "defense_down"
    || value === "damage_over_time"
    || value === "heal_over_time"
    || value === "intelligence_up"
    || value === "intelligence_down"
    || value === "vitality_up"
    || value === "vitality_down"
    || value === "agility_up"
    || value === "agility_down"
    || value === "interrupt_cast"
    ? value
    : "attack_up";
}

function asSkillEffectTarget(value: unknown): SkillEffectTarget {
  return value === "self" || value === "ally" || value === "enemy" ? value : "enemy";
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

function normalizeSkillEffects(value: unknown): SkillEffectTemplate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        name: asString(source.name, `效果 ${index + 1}`),
        description: asString(source.description),
        effectType: asSkillEffectType(source.effectType),
        target: asSkillEffectTarget(source.target),
        durationTurns: Math.max(1, asInt(source.durationTurns, 1)),
        magnitude: asNumber(source.magnitude, 0),
      } satisfies SkillEffectTemplate;
    })
    .filter((entry): entry is SkillEffectTemplate => Boolean(entry));
}

function createConfigErrorBucket(): AdminConfigFieldErrors {
  return {
    afkEncounterChances: [],
    afkEncounterPool: [],
    battleEnemyTemplates: [],
    classConfigs: [],
    eventRules: [],
    itemCatalog: [],
    mapConfigs: [],
    raceConfigs: [],
    skillTemplates: [],
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

function isKnownItemType(value: unknown): value is GameItemType {
  return value === "equipment" || value === "skill_book" || value === "material";
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
  eventRules: GameEventRule[];
  itemCatalog: DynamicGameConfig["itemCatalog"];
  mapConfigs: MapConfig[];
  raceConfigs: RaceConfig[];
  skillTemplates: SkillTemplate[];
  systemBalance: SystemBalanceConfig;
}) {
  const errors = createConfigErrorBucket();
  const itemIds = new Set<string>();
  const raceKeys = new Set<string>();
  const classKeys = new Set<string>();
  const mapKeys = new Set<string>();
  const enemyKeys = new Set<string>();
  const encounterKeys = new Set<string>();
  const skillKeys = new Set<string>();
  const pendingSkillBookRefs: Array<{ skillKey: string; push: (message: string) => void }> = [];

  if (!Array.isArray(input.raceConfigs) || input.raceConfigs.length === 0) {
    pushConfigError(errors, "raceConfigs", "种族配置必须是非空数组。");
  } else {
    input.raceConfigs.forEach((race, index) => {
      const push = (message: string) => pushConfigError(errors, "raceConfigs", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(race?.key, "key", push);
      validateRequiredString(race?.label, "label", push);
      validateStatsObject(race?.stats, "stats", push);

      if (race?.iconKey !== undefined && race?.iconKey !== null) {
        if (typeof race.iconKey !== "string" || !race.iconKey.trim()) {
          push("iconKey 若提供必须是非空字符串。");
        }
      }

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

      if (item?.iconKey !== undefined && item?.iconKey !== null) {
        if (typeof item.iconKey !== "string" || !item.iconKey.trim()) {
          push("iconKey 若提供必须是非空字符串。");
        }
      }

      if (!isKnownRarity(item?.rarity)) {
        push("rarity 必须是 white / green / blue / purple / orange 之一。");
      }

      if (!isKnownItemType(item?.itemType)) {
        push("itemType 必须是 equipment / skill_book / material 之一。");
      }

      if (!isKnownBodySlotType(item?.slot)) {
        push("slot 不是合法装备槽位。");
      }

      if (item?.itemType === "skill_book") {
        if (typeof item.skillKey !== "string" || !item.skillKey.trim()) {
          push("skill_book 类型物品必须提供有效的 skillKey。");
        } else {
          pendingSkillBookRefs.push({
            skillKey: item.skillKey.trim(),
            push,
          });
        }
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

      if (classConfig?.iconKey !== undefined && classConfig?.iconKey !== null) {
        if (typeof classConfig.iconKey !== "string" || !classConfig.iconKey.trim()) {
          push("iconKey 若提供必须是非空字符串。");
        }
      }

      if (key) {
        if (classKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        classKeys.add(key);
      }

      if (classConfig?.starterItemId && !itemIds.has(classConfig.starterItemId)) {
        push(`starterItemId "${classConfig.starterItemId}" 不存在于物品目录。`);
      }

      if (classConfig?.starterItemId) {
        const starter = input.itemCatalog.find((item) => item.itemId === classConfig.starterItemId);
        if (starter && starter.itemType !== "equipment") {
          push(`starterItemId "${classConfig.starterItemId}" 必须是 equipment 类型。`);
        }
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

      if (enemy?.fixedSkillKeys !== undefined) {
        if (!Array.isArray(enemy.fixedSkillKeys)) {
          push("fixedSkillKeys 必须是字符串数组。");
        } else {
          enemy.fixedSkillKeys.forEach((skillKey, skillIndex) => {
            validateRequiredString(skillKey, `fixedSkillKeys[${skillIndex + 1}]`, push);
          });
        }
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

  if (!Array.isArray(input.skillTemplates) || input.skillTemplates.length === 0) {
    pushConfigError(errors, "skillTemplates", "技能模板必须是非空数组。");
  } else {
    input.skillTemplates.forEach((skill, index) => {
      const push = (message: string) => pushConfigError(errors, "skillTemplates", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(skill?.key, "key", push);
      validateRequiredString(skill?.name, "name", push);
      validateRequiredString(skill?.iconText, "iconText", push);
      validateRequiredString(skill?.description, "description", push);
      validateRequiredString(skill?.acquisitionHint, "acquisitionHint", push);
      validateFiniteNumber(skill?.maxLevel, "maxLevel", push, { integer: true, min: 1 });
      validateFiniteNumber(skill?.damageMultiplier, "damageMultiplier", push, { min: 0 });
      validateFiniteNumber(skill?.levelDamageGrowth, "levelDamageGrowth", push, { min: 0 });
      validateFiniteNumber(skill?.healRatio, "healRatio", push, { min: 0 });
      validateFiniteNumber(skill?.levelHealGrowth, "levelHealGrowth", push, { min: 0 });
      validateFiniteNumber(skill?.guardRatio, "guardRatio", push, { min: 0, max: 1 });
      validateFiniteNumber(skill?.levelGuardGrowth, "levelGuardGrowth", push, { min: 0, max: 1 });
      validateFiniteNumber(skill?.maxUses, "maxUses", push, { integer: true, min: 0 });
      validateFiniteNumber(skill?.cooldownTurns, "cooldownTurns", push, { integer: true, min: 0 });

      if (skill?.quality && !isKnownRarity(skill.quality)) {
        push("quality 必须是 white / green / blue / purple / orange 之一。");
      }

      if (skill?.category !== "attack" && skill?.category !== "spell" && skill?.category !== "guard") {
        push("category 必须是 attack / spell / guard 之一。");
      }

      if (skill?.source !== undefined && skill.source !== "learned" && skill.source !== "enemy") {
        push("source 必须是 learned / enemy 之一。");
      }

      if (key) {
        if (skillKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }

        skillKeys.add(key);
      }

      if (!Array.isArray(skill?.effects)) {
        push("effects 必须是数组。");
      } else {
        const effectKeys = new Set<string>();

        skill.effects.forEach((effect, effectIndex) => {
          const effectKey = validateRequiredString(effect?.key, `effects[${effectIndex + 1}].key`, push);
          validateRequiredString(effect?.name, `effects[${effectIndex + 1}].name`, push);
          validateFiniteNumber(effect?.durationTurns, `effects[${effectIndex + 1}].durationTurns`, push, {
            integer: true,
            min: 1,
          });
          validateFiniteNumber(effect?.magnitude, `effects[${effectIndex + 1}].magnitude`, push, { min: 0 });

          if (
            effect?.effectType !== "attack_up"
            && effect?.effectType !== "attack_down"
            && effect?.effectType !== "defense_up"
            && effect?.effectType !== "defense_down"
            && effect?.effectType !== "damage_over_time"
            && effect?.effectType !== "heal_over_time"
            && effect?.effectType !== "intelligence_up"
            && effect?.effectType !== "intelligence_down"
            && effect?.effectType !== "vitality_up"
            && effect?.effectType !== "vitality_down"
            && effect?.effectType !== "agility_up"
            && effect?.effectType !== "agility_down"
            && effect?.effectType !== "interrupt_cast"
          ) {
            push(`effects[${effectIndex + 1}].effectType 不合法。`);
          }

          if (effect?.target !== "self" && effect?.target !== "ally" && effect?.target !== "enemy") {
            push(`effects[${effectIndex + 1}].target 必须是 self / ally / enemy 之一。`);
          }

          if (effectKey) {
            if (effectKeys.has(effectKey)) {
              push(`effects[${effectIndex + 1}].key "${effectKey}" 重复。`);
            }

            effectKeys.add(effectKey);
          }
        });
      }
    });
  }

  pendingSkillBookRefs.forEach(({ skillKey, push }) => {
    if (!skillKeys.has(skillKey)) {
      push(`skillKey "${skillKey}" 不存在于技能模板。`);
    }
  });

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

  if (!Array.isArray(input.eventRules) || input.eventRules.length === 0) {
    pushConfigError(errors, "eventRules", "统一事件池必须是非空数组。");
  } else {
    const eventKeys = new Set<string>();

    input.eventRules.forEach((rule, index) => {
      const push = (message: string) => pushConfigError(errors, "eventRules", `第 ${index + 1} 项：${message}`);
      const key = validateRequiredString(rule?.key, "key", push);
      validateRequiredString(rule?.name, "name", push);
      validateFiniteNumber(rule?.priority, "priority", push, { integer: true });
      validateFiniteNumber(rule?.chance, "chance", push, { min: 0, max: 1 });

      if (key) {
        if (eventKeys.has(key)) {
          push(`key "${key}" 重复。`);
        }
        eventKeys.add(key);
      }

      if (typeof rule?.enabled !== "boolean") {
        push("enabled 必须是布尔值。");
      }

      if (!rule?.trigger || typeof rule.trigger !== "object") {
        push("trigger 必须是对象。");
      } else {
        if (rule.trigger.type !== "afk_tick" && rule.trigger.type !== "enemy_kill") {
          push("trigger.type 必须是 afk_tick / enemy_kill 之一。");
        }

        if (rule.trigger.mapKeys !== undefined) {
          if (!Array.isArray(rule.trigger.mapKeys)) {
            push("trigger.mapKeys 必须是字符串数组。");
          } else {
            rule.trigger.mapKeys.forEach((mapKey, mapIndex) => {
              const validated = validateRequiredString(mapKey, `trigger.mapKeys[${mapIndex + 1}]`, push);
              if (validated && !mapKeys.has(validated)) {
                push(`trigger.mapKeys[${mapIndex + 1}] "${validated}" 不存在于地图配置。`);
              }
            });
          }
        }

        if (rule.trigger.enemyKeys !== undefined) {
          if (!Array.isArray(rule.trigger.enemyKeys)) {
            push("trigger.enemyKeys 必须是字符串数组。");
          } else {
            rule.trigger.enemyKeys.forEach((enemyKey, enemyIndex) => {
              const validated = validateRequiredString(enemyKey, `trigger.enemyKeys[${enemyIndex + 1}]`, push);
              if (validated && !enemyKeys.has(validated)) {
                push(`trigger.enemyKeys[${enemyIndex + 1}] "${validated}" 不存在于怪物模板。`);
              }
            });
          }
        }
      }

      if (!Array.isArray(rule?.actions) || rule.actions.length === 0) {
        push("actions 必须是非空数组。");
      } else {
        rule.actions.forEach((action, actionIndex) => {
          const prefix = `actions[${actionIndex + 1}]`;

          if (
            action?.type !== "grant_gold"
            && action?.type !== "grant_aether"
            && action?.type !== "grant_exp"
            && action?.type !== "adjust_health"
            && action?.type !== "grant_item"
          ) {
            push(`${prefix}.type 不合法。`);
            return;
          }

          if (action.chance !== undefined) {
            validateFiniteNumber(action.chance, `${prefix}.chance`, push, { min: 0, max: 1 });
          }

          if (
            action.type === "grant_gold"
            || action.type === "grant_aether"
            || action.type === "grant_exp"
            || action.type === "adjust_health"
          ) {
            if (action.amount === undefined) {
              push(`${prefix}.amount 不能为空。`);
            } else {
              validateFiniteNumber(action.amount, `${prefix}.amount`, push, { integer: true });
            }
          }

          if (action.type === "grant_item") {
            const itemId = validateRequiredString(action.itemId, `${prefix}.itemId`, push);
            if (itemId && !itemIds.has(itemId)) {
              push(`${prefix}.itemId "${itemId}" 不存在于物品目录。`);
            }

            if (action.quantity !== undefined) {
              validateFiniteNumber(action.quantity, `${prefix}.quantity`, push, { integer: true, min: 1 });
            }
            if (action.min !== undefined) {
              validateFiniteNumber(action.min, `${prefix}.min`, push, { integer: true, min: 1 });
            }
            if (action.max !== undefined) {
              validateFiniteNumber(action.max, `${prefix}.max`, push, { integer: true, min: 1 });
            }

            if (action.quantity === undefined && action.min === undefined) {
              push(`${prefix}.quantity 或 ${prefix}.min 至少提供一个。`);
            }

            if (action.min !== undefined && action.max !== undefined && action.max < action.min) {
              push(`${prefix}.max 不能小于 ${prefix}.min。`);
            }
          }
        });
      }

      if (rule?.encounter !== undefined) {
        if (!rule.encounter || typeof rule.encounter !== "object") {
          push("encounter 必须是对象。");
        } else {
          if (rule.encounter.tier !== undefined && !isKnownEncounterTier(rule.encounter.tier)) {
            push("encounter.tier 必须是 common / rare / legendary 之一。");
          }
          if (rule.encounter.title !== undefined) {
            validateRequiredString(rule.encounter.title, "encounter.title", push);
          }
          if (rule.encounter.description !== undefined) {
            validateRequiredString(rule.encounter.description, "encounter.description", push);
          }
        }
      }
    });
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
  const normalized = Array.isArray(value)
    ? value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        label: asString(source.label),
        summary: asString(source.summary),
        iconKey: asString(source.iconKey).trim() || undefined,
        stats: normalizeStats(source.stats),
        bodySlotAdjustments: normalizeBodySlotAdjustments(source.bodySlotAdjustments),
      } as RaceConfig;
    })
    .filter((entry): entry is RaceConfig => Boolean(entry))
    : [];
  const merged = [...defaultRaceConfigs];
  const indexByKey = new Map(merged.map((entry, index) => [entry.key, index]));

  normalized.forEach((entry) => {
    const existingIndex = indexByKey.get(entry.key);

    if (existingIndex === undefined) {
      indexByKey.set(entry.key, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = entry;
  });

  return merged;
}

function normalizeClasses(value: unknown): ClassConfig[] {
  const normalized = Array.isArray(value)
    ? value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
        key: asString(source.key).trim(),
        label: asString(source.label),
        summary: asString(source.summary),
        iconKey: asString(source.iconKey).trim() || undefined,
        starterItemId: asString(source.starterItemId),
        stats: normalizeStats(source.stats),
      } as ClassConfig;
    })
    .filter((entry): entry is ClassConfig => Boolean(entry))
    : [];
  const merged = [...defaultClassConfigs];
  const indexByKey = new Map(merged.map((entry, index) => [entry.key, index]));

  normalized.forEach((entry) => {
    const existingIndex = indexByKey.get(entry.key);

    if (existingIndex === undefined) {
      indexByKey.set(entry.key, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = entry;
  });

  return merged;
}

function normalizeMaps(value: unknown): MapConfig[] {
  const normalized = Array.isArray(value)
    ? value
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
    .filter((entry): entry is MapConfig => Boolean(entry))
    : [];
  const merged = [...defaultMapConfigs];
  const indexByKey = new Map(merged.map((entry, index) => [entry.key, index]));

  normalized.forEach((entry) => {
    const existingIndex = indexByKey.get(entry.key);

    if (existingIndex === undefined) {
      indexByKey.set(entry.key, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = entry;
  });

  return merged;
}

function normalizeEncounterChances(value: unknown): Record<EncounterTier, number> {
  const source = asObject(value);

  if (!source) {
    return DEFAULT_AFK_ENCOUNTER_CHANCES;
  }

  const next = {
    common: asNumber(source.common, DEFAULT_AFK_ENCOUNTER_CHANCES.common),
    rare: asNumber(source.rare, DEFAULT_AFK_ENCOUNTER_CHANCES.rare),
    legendary: asNumber(source.legendary, DEFAULT_AFK_ENCOUNTER_CHANCES.legendary),
  };

  if (next.common === 0.1 && next.rare === 0.01 && next.legendary === 0.001) {
    return DEFAULT_AFK_ENCOUNTER_CHANCES;
  }

  return next;
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
        itemType: asItemType(item.itemType),
        skillKey: asString(item.skillKey).trim() || undefined,
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

function asEventTriggerType(value: unknown): GameEventTriggerType {
  return value === "enemy_kill" ? "enemy_kill" : "afk_tick";
}

function asEventActionType(value: unknown): GameEventActionType {
  return value === "grant_gold"
    || value === "grant_aether"
    || value === "grant_exp"
    || value === "adjust_health"
    || value === "grant_item"
    ? value
    : "grant_gold";
}

function normalizeEventActions(value: unknown): GameEventAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const source = asObject(entry);
      if (!source) {
        return null;
      }

      const actionType = asEventActionType(source.type);
      const normalized: GameEventAction = {
        type: actionType,
      };

      if ("chance" in source) {
        normalized.chance = asNumber(source.chance, 1);
      }

      if (actionType === "grant_item") {
        const itemId = asString(source.itemId).trim();
        if (!itemId) {
          return null;
        }
        normalized.itemId = itemId;
      }

      if ("amount" in source) {
        normalized.amount = asInt(source.amount, 0);
      }
      if ("min" in source) {
        normalized.min = asInt(source.min, 1);
      }
      if ("max" in source) {
        normalized.max = asInt(source.max, normalized.min ?? 1);
      }
      if ("quantity" in source) {
        normalized.quantity = asInt(source.quantity, 1);
      }

      return normalized;
    })
    .filter((entry): entry is GameEventAction => Boolean(entry));
}

function buildLegacyEventRules(): GameEventRule[] {
  const rules: GameEventRule[] = [];

  DEFAULT_AFK_ENCOUNTER_POOL.forEach((encounter, index) => {
    const actions: GameEventAction[] = [];
    if (asInt(encounter.reward.gold, 0) > 0) {
      actions.push({ type: "grant_gold", amount: asInt(encounter.reward.gold, 0) });
    }
    if (asInt(encounter.reward.aetherCrystal, 0) > 0) {
      actions.push({ type: "grant_aether", amount: asInt(encounter.reward.aetherCrystal, 0) });
    }
    if (asInt(encounter.reward.exp, 0) > 0) {
      actions.push({ type: "grant_exp", amount: asInt(encounter.reward.exp, 0) });
    }
    if (asInt(encounter.reward.healthDelta, 0) !== 0) {
      actions.push({ type: "adjust_health", amount: asInt(encounter.reward.healthDelta, 0) });
    }
    (encounter.reward.items ?? []).forEach((itemEntry) => {
      const quantity = Math.max(1, asInt(itemEntry.quantity, 1));
      actions.push({ type: "grant_item", itemId: itemEntry.itemId, quantity });
    });

    const tierChance = DEFAULT_AFK_ENCOUNTER_CHANCES[encounter.tier] ?? 0;
    rules.push({
      key: `legacy-encounter-${encounter.key}`,
      name: encounter.title || encounter.key,
      enabled: true,
      priority: 1000 + index,
      chance: tierChance,
      trigger: {
        type: "afk_tick",
        ...(encounter.mapKeys?.length ? { mapKeys: encounter.mapKeys } : {}),
      },
      actions,
      encounter: {
        tier: encounter.tier,
        title: encounter.title,
        description: encounter.description,
      },
    });
  });

  const appendEnemyDropRules = (
    pool: Record<string, Array<{ itemId: string; chance: number; min: number; max: number }>>,
    prefix: string,
    offset: number,
  ) => {
    Object.entries(pool).forEach(([enemyKey, entries], index) => {
      entries.forEach((entry, dropIndex) => {
        rules.push({
          key: `${prefix}-${enemyKey}-${dropIndex + 1}`,
          name: `${enemyKey} 掉落 ${entry.itemId}`,
          enabled: true,
          priority: offset + index * 10 + dropIndex,
          chance: Math.max(0, asNumber(entry.chance, 0)),
          trigger: {
            type: "enemy_kill",
            enemyKeys: [enemyKey],
          },
          actions: [{
            type: "grant_item",
            itemId: entry.itemId,
            min: Math.max(1, asInt(entry.min, 1)),
            max: Math.max(Math.max(1, asInt(entry.min, 1)), asInt(entry.max, Math.max(1, asInt(entry.min, 1)))),
          }],
        });
      });
    });
  };

  appendEnemyDropRules(LEGACY_MATERIAL_DROP_POOL_BY_ENEMY_KEY, "legacy-drop-material", 5000);
  appendEnemyDropRules(LEGACY_SKILL_BOOK_DROP_POOL_BY_ENEMY_KEY, "legacy-drop-skillbook", 7000);

  return rules;
}

const DEFAULT_EVENT_RULES: GameEventRule[] = buildLegacyEventRules();

function normalizeEventRules(value: unknown): GameEventRule[] {
  const source = Array.isArray(value) ? value : [];

  if (source.length === 0) {
    return DEFAULT_EVENT_RULES;
  }

  const normalized = source
    .map((entry, index) => {
      const row = asObject(entry);
      const trigger = asObject(row?.trigger);
      const encounter = asObject(row?.encounter);

      if (!row || !asString(row.key).trim()) {
        return null;
      }

      const rule: GameEventRule = {
        key: asString(row.key).trim(),
        name: asString(row.name, `事件 ${index + 1}`),
        enabled: row.enabled === undefined ? true : Boolean(row.enabled),
        priority: asInt(row.priority, index),
        chance: asNumber(row.chance, 1),
        trigger: {
          type: asEventTriggerType(trigger?.type),
          ...(normalizeMapKeys(trigger?.mapKeys) ? { mapKeys: normalizeMapKeys(trigger?.mapKeys) } : {}),
          ...(normalizeMapKeys(trigger?.enemyKeys) ? { enemyKeys: normalizeMapKeys(trigger?.enemyKeys) } : {}),
        },
        actions: normalizeEventActions(row.actions),
      };

      if (encounter) {
        rule.encounter = {
          ...(isKnownEncounterTier(encounter.tier) ? { tier: encounter.tier } : {}),
          ...(asString(encounter.title).trim() ? { title: asString(encounter.title).trim() } : {}),
          ...(asString(encounter.description).trim() ? { description: asString(encounter.description).trim() } : {}),
        };
      }

      return rule;
    })
    .filter((entry): entry is GameEventRule => Boolean(entry));

  if (normalized.length === 0) {
    return DEFAULT_EVENT_RULES;
  }

  return normalized.sort((left, right) => left.priority - right.priority);
}

function normalizeEncounters(value: unknown): AfkEncounterConfig[] {
  const normalized = Array.isArray(value)
    ? value
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
    .filter((entry): entry is AfkEncounterConfig => Boolean(entry))
    : [];
  const merged = [...DEFAULT_AFK_ENCOUNTER_POOL];
  const indexByKey = new Map(merged.map((entry, index) => [entry.key, index]));

  normalized.forEach((entry) => {
    const existingIndex = indexByKey.get(entry.key);

    if (existingIndex === undefined) {
      indexByKey.set(entry.key, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = entry;
  });

  return merged;
}

function normalizeBattleEnemies(value: unknown): BattleEnemyTemplate[] {
  const normalized = Array.isArray(value)
    ? value
    .map((entry) => {
      const source = asObject(entry);
      const skillCaps = asObject(source?.skillCaps);
      const statWeights = asObject(source?.statWeights);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      const normalizedEnemy: BattleEnemyTemplate = {
        key: asString(source.key).trim(),
        ...(normalizeMapKeys(source.mapKeys) ? { mapKeys: normalizeMapKeys(source.mapKeys) } : {}),
        name: asString(source.name),
        summary: asString(source.summary),
        ...(Array.isArray(source.fixedSkillKeys)
          ? {
            fixedSkillKeys: source.fixedSkillKeys
              .map((entry) => asString(entry).trim())
              .filter(Boolean),
          }
          : {}),
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
      };

      return normalizedEnemy;
    })
    .filter((entry): entry is BattleEnemyTemplate => Boolean(entry))
    : [];
  const merged = [...DEFAULT_BATTLE_ENEMIES];
  const indexByKey = new Map(merged.map((entry, index) => [entry.key, index]));

  normalized.forEach((entry) => {
    const existingIndex = indexByKey.get(entry.key);

    if (existingIndex === undefined) {
      indexByKey.set(entry.key, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = entry;
  });

  return merged;
}

function normalizeSkillTemplates(value: unknown): SkillTemplate[] {
  const normalized = Array.isArray(value)
    ? value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      const normalizedSkill: SkillTemplate = {
        key: asString(source.key).trim(),
        name: asString(source.name),
        iconText: asString(source.iconText),
        description: asString(source.description),
        quality: asRarity(source.quality),
        category: asSkillCategory(source.category),
        trigger: asString(source.trigger, "random"),
        acquisitionHint: asString(source.acquisitionHint),
        source: source.source === "enemy" ? "enemy" : "learned",
        maxLevel: Math.max(1, asInt(source.maxLevel, 10)),
        damageMultiplier: asNumber(source.damageMultiplier, 0),
        levelDamageGrowth: asNumber(source.levelDamageGrowth, 0),
        healRatio: asNumber(source.healRatio, 0),
        levelHealGrowth: asNumber(source.levelHealGrowth, 0),
        guardRatio: asNumber(source.guardRatio, 0),
        levelGuardGrowth: asNumber(source.levelGuardGrowth, 0),
        maxUses: Math.max(0, asInt(source.maxUses, 0)),
        cooldownTurns: Math.max(0, asInt(source.cooldownTurns, 0)),
        effects: normalizeSkillEffects(source.effects),
      };

      return normalizedSkill;
    })
    .filter((entry): entry is SkillTemplate => entry !== null)
    : [];
  const merged = [...DEFAULT_SKILL_TEMPLATES];
  const indexByKey = new Map(merged.map((entry, index) => [entry.key, index]));

  normalized.forEach((entry) => {
    const existingIndex = indexByKey.get(entry.key);

    if (existingIndex === undefined) {
      indexByKey.set(entry.key, merged.length);
      merged.push(entry);
      return;
    }

    merged[existingIndex] = entry;
  });

  return merged;
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

function mergeItemCatalog(itemCatalog: DynamicGameConfig["itemCatalog"]): DynamicGameConfig["itemCatalog"] {
  const merged = [...DEFAULT_ITEM_CATALOG];
  const indexById = new Map(merged.map((item, index) => [item.itemId, index]));

  itemCatalog.forEach((item) => {
    const existingIndex = indexById.get(item.itemId);

    if (existingIndex === undefined) {
      indexById.set(item.itemId, merged.length);
      merged.push(item);
      return;
    }

    merged[existingIndex] = item;
  });

  return merged;
}

type ItemCatalogRow = {
  item_id: string;
  name: string;
  rarity: string;
  item_type: GameItemType;
  skill_key: string | null;
  icon_key: string | null;
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
          item_type,
          skill_key,
          icon_key,
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
    eventRules: normalizeEventRules(configByKey.get("event-rules")),
    itemCatalog: mergeItemCatalog(itemResult.rows.map((item) => ({
      itemId: item.item_id,
      name: item.name,
      rarity: item.rarity,
      itemType: asItemType(item.item_type),
      skillKey: item.skill_key || null,
      iconKey: item.icon_key || null,
      slot: item.slot,
      slotUsage: item.slot_usage,
      description: item.description,
      sellPrice: item.sell_price,
      stats: item.stat_json ?? {},
    }))),
    levelTable: DEFAULT_LEVEL_TABLE,
    mapConfigs: normalizeMaps(configByKey.get("maps")),
    raceConfigs: normalizeRaces(configByKey.get("races")),
    skillTemplates: normalizeSkillTemplates(configByKey.get("skill-templates")),
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

export async function createAdminRole(input: AdminRoleCreateInput) {
  const userId = input.userId.trim();

  if (!userId) {
    throw new Error("缺少账号标识。");
  }

  const roleName = input.name.trim();

  if (!roleName) {
    throw new Error("角色名不能为空。");
  }

  await withTransaction(async (client) => {
    const userResult = await client.query<{ user_id: string }>(
      `SELECT user_id FROM "user" WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );

    if ((userResult.rowCount ?? 0) === 0) {
      throw new Error("账号不存在。");
    }

    const existingRole = await client.query<{ role_id: string }>(
      `SELECT role_id FROM role WHERE user_id = $1`,
      [userId],
    );

    if ((existingRole.rowCount ?? 0) > 0) {
      throw new Error("该账号已有角色。");
    }

    await client.query(
      `
        INSERT INTO role (
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
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16,
          NOW(), NOW()
        )
      `,
      [
        makeId("role"),
        userId,
        roleName,
        input.raceKey.trim(),
        input.classKey.trim(),
        Math.max(1, asInt(input.level, 1)),
        Math.max(0, asInt(input.exp, 0)),
        LEVEL_CURVE_VERSION,
        Math.max(0, asInt(input.gold, 0)),
        Math.max(0, asInt(input.aetherCrystal, 0)),
        asInt(input.strength, 0),
        asInt(input.agility, 0),
        asInt(input.intelligence, 0),
        asInt(input.vitality, 0),
        Math.max(1, asInt(input.currentHealth, 1)),
        input.avatarSeed.trim() || randomUUID(),
      ],
    );
  });
}

export async function deleteAdminRole(roleId: string) {
  const normalizedRoleId = roleId.trim();

  if (!normalizedRoleId) {
    throw new Error("缺少角色标识。");
  }

  await query(
    `
      DELETE FROM role
      WHERE role_id = $1
    `,
    [normalizedRoleId],
  );
}

export async function saveAdminGameConfig(input: {
  afkEncounterChances: Record<EncounterTier, number>;
  afkEncounterPool: AfkEncounterConfig[];
  battleEnemyTemplates: BattleEnemyTemplate[];
  classConfigs: ClassConfig[];
  eventRules: GameEventRule[];
  itemCatalog: DynamicGameConfig["itemCatalog"];
  mapConfigs: MapConfig[];
  raceConfigs: RaceConfig[];
  skillTemplates: SkillTemplate[];
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
    await upsertConfig("event-rules", "list", input.eventRules);
    await upsertConfig("battle-enemies", "list", input.battleEnemyTemplates);
    await upsertConfig("skill-templates", "list", input.skillTemplates);
    await upsertConfig("system-balance", "object", input.systemBalance);

    const nextItemIds = input.itemCatalog.map((item) => item.itemId);

    for (const item of input.itemCatalog) {
      await client.query(
        `
          INSERT INTO item (
            item_id,
            name,
            rarity,
            item_type,
            skill_key,
            icon_key,
            slot,
            slot_usage,
            description,
            sell_price,
            stat_json,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
          ON CONFLICT (item_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            rarity = EXCLUDED.rarity,
            item_type = EXCLUDED.item_type,
            skill_key = EXCLUDED.skill_key,
            icon_key = EXCLUDED.icon_key,
            slot = EXCLUDED.slot,
            slot_usage = EXCLUDED.slot_usage,
            description = EXCLUDED.description,
            sell_price = EXCLUDED.sell_price,
            stat_json = EXCLUDED.stat_json,
            updated_at = NOW()
        `,
        [
          item.itemId,
          item.name,
          item.rarity,
          item.itemType,
          item.skillKey,
          item.iconKey ?? null,
          item.slot,
          item.slotUsage,
          item.description,
          item.sellPrice,
          JSON.stringify(item.stats ?? {}),
        ],
      );
    }

    // 清理已从配置移除、且没有被业务数据引用的旧物品，避免外键冲突。
    await client.query(
      `
        DELETE FROM item
        WHERE item_id <> ALL($1::text[])
          AND NOT EXISTS (
            SELECT 1
            FROM market_listing
            WHERE market_listing.item_id = item.item_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM backpack
            WHERE backpack.item_id = item.item_id
          )
      `,
      [nextItemIds],
    );
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
