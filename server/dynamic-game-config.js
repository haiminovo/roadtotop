const { query } = require("./db");

const LEVEL_CAP = 30;
const EXP_PER_LEVEL = 100;
const EXP_GROWTH_PER_LEVEL = 10;
const DEFAULT_BODY_SLOT_CAPACITIES = {
  head: 1,
  hand: 2,
  torso: 1,
  legs: 1,
  feet: 1,
  neck: 1,
  accessory: 2,
};

const DEFAULT_RACE_CONFIGS = [
  {
    key: "human",
    label: "人类",
    summary: "四维均衡，最适合当前版本的万能开荒模版。",
    stats: { strength: 5, agility: 5, intelligence: 5, vitality: 5 },
    bodySlotAdjustments: {},
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

const DEFAULT_CLASS_CONFIGS = [
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

const DEFAULT_MAP_CONFIGS = [
  {
    key: "palmia-wilds",
    label: "野外",
    summary: "收益平衡，适合刚创角时开第一张图。",
    goldPerMinute: 20,
    aetherPerMinute: 0.25,
    expPerMinute: 10,
  },
  {
    key: "moonfall-ruins",
    label: "月陨遗迹",
    summary: "更危险的废墟地带，奖励更高，也会出现更强的敌人与稀有奇遇。",
    goldPerMinute: 42,
    aetherPerMinute: 0.7,
    expPerMinute: 22,
  },
];

const DEFAULT_AFK_ENCOUNTER_CHANCES = {
  common: 0.1,
  rare: 0.01,
  legendary: 0.001,
};

const DEFAULT_AFK_ENCOUNTER_POOL = [
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

const DEFAULT_BATTLE_ENEMIES = [
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

const DEFAULT_SKILL_TEMPLATES = [
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

const DEFAULT_ITEM_CATALOG = [
  { itemId: "rusty-blade", name: "生锈短剑", rarity: "white", slot: "hand", slotUsage: 1, description: "开荒时勉强能用的短剑。", sellPrice: 12, stats: { strength: 2 } },
  { itemId: "oak-staff", name: "橡木法杖", rarity: "white", slot: "hand", slotUsage: 2, description: "粗糙的入门法杖，适合法师起步。", sellPrice: 12, stats: { intelligence: 2 } },
  { itemId: "field-hoe", name: "旧铁锄", rarity: "white", slot: "hand", slotUsage: 2, description: "农活与近身防卫两不误的旧工具。", sellPrice: 10, stats: { vitality: 1, agility: 1 } },
  { itemId: "forest-cloak", name: "林地披风", rarity: "green", slot: "neck", slotUsage: 1, description: "轻便耐磨，适合野外挂机。", sellPrice: 30, stats: { agility: 2, vitality: 1 } },
  { itemId: "traveler-ring", name: "旅者戒指", rarity: "green", slot: "accessory", slotUsage: 1, description: "会在冒险者启程时发放的基础指环。", sellPrice: 36, stats: { strength: 1, intelligence: 1, vitality: 1 } },
  { itemId: "training-bow", name: "练习短弓", rarity: "white", slot: "hand", slotUsage: 2, description: "拉力一般，但足够让新手学会瞄准与走位。", sellPrice: 18, stats: { agility: 2 } },
  { itemId: "leather-cap", name: "皮质便帽", rarity: "white", slot: "head", slotUsage: 1, description: "不起眼的小帽子，能挡一点风沙与碎石。", sellPrice: 14, stats: { vitality: 1, agility: 1 } },
  { itemId: "scout-bracers", name: "斥候护腕", rarity: "white", slot: "accessory", slotUsage: 1, description: "轻量护腕，让抬手与闪避动作更利落。", sellPrice: 16, stats: { agility: 1, intelligence: 1 } },
  { itemId: "bronze-longsword", name: "青铜长剑", rarity: "green", slot: "hand", slotUsage: 1, description: "保养得当的军用品，劈砍手感远胜生锈短剑。", sellPrice: 48, stats: { strength: 3, vitality: 1 } },
  { itemId: "whisper-wand", name: "低语木杖", rarity: "green", slot: "hand", slotUsage: 1, description: "杖身会在夜里发出轻鸣，能稳定初阶法术。", sellPrice: 46, stats: { intelligence: 3, agility: 1 } },
  { itemId: "hunter-leathers", name: "猎人皮甲", rarity: "green", slot: "torso", slotUsage: 1, description: "柔韧结实，适合长时间追踪与奔行。", sellPrice: 54, stats: { agility: 2, vitality: 2 } },
  { itemId: "amber-charm", name: "琥珀护符", rarity: "green", slot: "neck", slotUsage: 1, description: "封着温热树脂的护符，能让心神更稳定。", sellPrice: 52, stats: { intelligence: 2, vitality: 1 } },
  { itemId: "moonshadow-dagger", name: "月影短匕", rarity: "blue", slot: "hand", slotUsage: 1, description: "刀锋轻薄如月光，适合迅捷而精准的出手。", sellPrice: 96, stats: { agility: 4, intelligence: 1 } },
  { itemId: "runic-vest", name: "符纹战衣", rarity: "blue", slot: "torso", slotUsage: 1, description: "内衬刻着细密符纹，兼顾防护与法感引导。", sellPrice: 104, stats: { intelligence: 3, vitality: 2 } },
  { itemId: "wolfbone-talisman", name: "狼骨符坠", rarity: "blue", slot: "accessory", slotUsage: 1, description: "粗犷却实用的护符，佩戴后胆气更足。", sellPrice: 98, stats: { strength: 2, agility: 2 } },
  { itemId: "stormglass-staff", name: "风暴晶杖", rarity: "purple", slot: "hand", slotUsage: 2, description: "杖芯封着风暴碎晶，能显著放大施法者感知。", sellPrice: 188, stats: { intelligence: 5, agility: 2 } },
  { itemId: "knightwatch-mail", name: "守夜骑士甲", rarity: "purple", slot: "torso", slotUsage: 1, description: "历经修补的厚重甲胄，仍保留着可靠的守护感。", sellPrice: 210, stats: { strength: 3, vitality: 5 } },
  { itemId: "dawnfire-pendant", name: "晨焰坠饰", rarity: "orange", slot: "neck", slotUsage: 1, description: "内部像封着一缕朝阳，能同时提振体魄与精神。", sellPrice: 320, stats: { strength: 2, intelligence: 3, vitality: 3 } },
];

const DEFAULT_SYSTEM_BALANCE = {
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

function getLevelBaseExp(level) {
  const safeLevel = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  const completedLevels = safeLevel - 1;
  return (
    completedLevels * EXP_PER_LEVEL
    + ((completedLevels * Math.max(0, completedLevels - 1)) / 2) * EXP_GROWTH_PER_LEVEL
  );
}

const DEFAULT_LEVEL_TABLE = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: getLevelBaseExp(index + 1),
}));

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asInt(value, fallback = 0) {
  return Math.trunc(asNumber(value, fallback));
}

function asRarity(value) {
  return value === "white"
    || value === "green"
    || value === "blue"
    || value === "purple"
    || value === "orange"
    ? value
    : "white";
}

function asSkillCategory(value) {
  return value === "attack" || value === "spell" || value === "guard" ? value : "attack";
}

function asSkillEffectType(value) {
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
    ? value
    : "attack_up";
}

function asSkillEffectTarget(value) {
  return value === "self" || value === "ally" || value === "enemy" ? value : "enemy";
}

function asEncounterTier(value) {
  return value === "common" || value === "rare" || value === "legendary" ? value : "common";
}

function normalizeMapKeys(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => asString(entry).trim())
    .filter(Boolean);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function normalizeBodySlotAdjustments(value) {
  const source = asObject(value);
  const result = {};

  if (!source) {
    return result;
  }

  for (const slotType of Object.keys(DEFAULT_BODY_SLOT_CAPACITIES)) {
    if (slotType in source) {
      result[slotType] = asInt(source[slotType]);
    }
  }

  return result;
}

function normalizeStats(value) {
  const source = asObject(value);

  return {
    strength: asInt(source?.strength, 0),
    agility: asInt(source?.agility, 0),
    intelligence: asInt(source?.intelligence, 0),
    vitality: asInt(source?.vitality, 0),
  };
}

function normalizeRaces(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_RACE_CONFIGS;
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
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_RACE_CONFIGS;
}

function normalizeClasses(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_CLASS_CONFIGS;
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
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_CLASS_CONFIGS;
}

function normalizeMaps(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_MAP_CONFIGS;
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
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_MAP_CONFIGS;
}

function normalizeEncounterChances(value) {
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

function normalizeEncounterReward(value) {
  const source = asObject(value);
  const items = [];

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

function normalizeEncounters(value) {
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
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_AFK_ENCOUNTER_POOL;
}

function normalizeBattleEnemies(value) {
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
      };
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_BATTLE_ENEMIES;
}

function normalizeSkillEffects(value) {
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
      };
    })
    .filter(Boolean);
}

function normalizeSkillTemplates(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_SKILL_TEMPLATES;
  }

  const normalized = value
    .map((entry) => {
      const source = asObject(entry);

      if (!source || !asString(source.key).trim()) {
        return null;
      }

      return {
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
    })
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_SKILL_TEMPLATES;
}

function normalizeSystemBalance(value) {
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

function createEncounterTierBucket() {
  return {
    common: [],
    rare: [],
    legendary: [],
  };
}

function buildAfkEncounterPoolByMapAndTier(pool, mapConfigs) {
  const allMapKeys = mapConfigs.map((map) => map.key);
  const buckets = Object.fromEntries(
    allMapKeys.map((mapKey) => [mapKey, createEncounterTierBucket()]),
  );

  for (const encounter of pool) {
    const targetMapKeys = encounter.mapKeys?.length ? encounter.mapKeys : allMapKeys;

    for (const mapKey of targetMapKeys) {
      if (!buckets[mapKey]) {
        buckets[mapKey] = createEncounterTierBucket();
      }

      buckets[mapKey][encounter.tier].push(encounter);
    }
  }

  return buckets;
}

function buildBattleEnemyTemplatesByMap(templates, mapConfigs) {
  const allMapKeys = mapConfigs.map((map) => map.key);
  const buckets = Object.fromEntries(
    allMapKeys.map((mapKey) => [mapKey, []]),
  );

  for (const template of templates) {
    const targetMapKeys = template.mapKeys?.length ? template.mapKeys : allMapKeys;

    for (const mapKey of targetMapKeys) {
      if (!buckets[mapKey]) {
        buckets[mapKey] = [];
      }

      buckets[mapKey].push(template);
    }
  }

  return buckets;
}

function buildRuntimeConfig(source) {
  const itemCatalog = source.itemCatalog;
  const afkEncounterPool = source.afkEncounterPool;

  return {
    ...source,
    afkEncounterPoolByMapAndTier: buildAfkEncounterPoolByMapAndTier(afkEncounterPool, source.mapConfigs),
    battleEnemyTemplatesByMap: buildBattleEnemyTemplatesByMap(source.battleEnemyTemplates, source.mapConfigs),
    itemSeedById: new Map(itemCatalog.map((item) => [item.itemId, item])),
    skillTemplateByKey: new Map(source.skillTemplates.map((skill) => [skill.key, skill])),
  };
}

let cachedRuntimeConfig = buildRuntimeConfig({
  afkEncounterChances: DEFAULT_AFK_ENCOUNTER_CHANCES,
  afkEncounterPool: DEFAULT_AFK_ENCOUNTER_POOL,
  battleEnemyTemplates: DEFAULT_BATTLE_ENEMIES,
  classConfigs: DEFAULT_CLASS_CONFIGS,
  itemCatalog: DEFAULT_ITEM_CATALOG,
  levelTable: DEFAULT_LEVEL_TABLE,
  mapConfigs: DEFAULT_MAP_CONFIGS,
  raceConfigs: DEFAULT_RACE_CONFIGS,
  skillTemplates: DEFAULT_SKILL_TEMPLATES,
  systemBalance: DEFAULT_SYSTEM_BALANCE,
});

async function getDynamicGameConfig() {
  const [configResult, itemResult] = await Promise.all([
    query(`
      SELECT config_key, value
      FROM game_config
    `),
    query(`
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
    `),
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
      stats: item.stat_json || {},
    })),
    levelTable: DEFAULT_LEVEL_TABLE,
    mapConfigs: normalizeMaps(configByKey.get("maps")),
    raceConfigs: normalizeRaces(configByKey.get("races")),
    skillTemplates: normalizeSkillTemplates(configByKey.get("skill-templates")),
    systemBalance: normalizeSystemBalance(configByKey.get("system-balance")),
  };
}

async function loadRuntimeGameConfig(forceRefresh = false) {
  if (forceRefresh) {
    cachedRuntimeConfig = buildRuntimeConfig(await getDynamicGameConfig());
  }

  return cachedRuntimeConfig;
}

async function refreshRuntimeGameConfig() {
  cachedRuntimeConfig = buildRuntimeConfig(await getDynamicGameConfig());
  return cachedRuntimeConfig;
}

module.exports = {
  DEFAULT_AFK_ENCOUNTER_CHANCES,
  DEFAULT_AFK_ENCOUNTER_POOL,
  DEFAULT_BATTLE_ENEMIES,
  DEFAULT_CLASS_CONFIGS,
  DEFAULT_ITEM_CATALOG,
  DEFAULT_LEVEL_TABLE,
  DEFAULT_MAP_CONFIGS,
  DEFAULT_RACE_CONFIGS,
  DEFAULT_SKILL_TEMPLATES,
  DEFAULT_SYSTEM_BALANCE,
  loadRuntimeGameConfig,
  refreshRuntimeGameConfig,
};
