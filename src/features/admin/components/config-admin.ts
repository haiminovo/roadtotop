export type ConfigEditorKey =
  | "activityConfigs"
  | "raceConfigs"
  | "classConfigs"
  | "mapConfigs"
  | "itemCatalog"
  | "battleEnemyTemplates"
  | "skillTemplates"
  | "eventRules"
  | "systemBalance";

export type EventRuleFilter = "all" | "afk_tick" | "enemy_kill";

export type AdminConfigResponse = {
  config: {
    afkEncounterChances: Record<string, number>;
    afkEncounterPool: unknown[];
    activityConfigs: unknown[];
    battleEnemyTemplates: unknown[];
    classConfigs: unknown[];
    eventRules: unknown[];
    itemCatalog: unknown[];
    levelTable: Array<{ level: number; totalExpRequired: number }>;
    mapConfigs: unknown[];
    raceConfigs: unknown[];
    skillTemplates: unknown[];
    systemBalance: Record<string, number>;
  };
  meta: {
    constants: Record<string, unknown>;
    helpers: {
      bodySlotTypeLabels: Array<{ key: string; label: string }>;
    };
  };
};

export const CONFIG_KEYS: ConfigEditorKey[] = [
  "raceConfigs",
  "classConfigs",
  "activityConfigs",
  "mapConfigs",
  "itemCatalog",
  "battleEnemyTemplates",
  "skillTemplates",
  "eventRules",
  "systemBalance",
];

export const CONFIG_LABELS: Record<ConfigEditorKey, string> = {
  activityConfigs: "活动配置",
  raceConfigs: "种族配置",
  classConfigs: "职业配置",
  mapConfigs: "地图配置",
  itemCatalog: "物品目录",
  battleEnemyTemplates: "怪物模板",
  skillTemplates: "技能模板",
  eventRules: "事件池（行为/地图）",
  systemBalance: "系统平衡参数",
};

export const EVENT_RULE_FILTER_LABELS: Record<EventRuleFilter, string> = {
  all: "全部",
  afk_tick: "挂机触发",
  enemy_kill: "击杀触发",
};

const ARRAY_CONFIG_KEYS: ConfigEditorKey[] = [
  "raceConfigs",
  "classConfigs",
  "activityConfigs",
  "mapConfigs",
  "itemCatalog",
  "battleEnemyTemplates",
  "skillTemplates",
  "eventRules",
];

export function isConfigKey(value: string): value is ConfigEditorKey {
  return (CONFIG_KEYS as string[]).includes(value);
}

export function isArrayConfigKey(key: ConfigEditorKey) {
  return ARRAY_CONFIG_KEYS.includes(key);
}

export function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

const RARITY_LABELS: Record<string, string> = {
  white: "白装",
  green: "绿装",
  blue: "蓝装",
  purple: "紫装",
  orange: "橙装",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  equipment: "装备",
  skill_book: "技能书",
  material: "材料",
};

const BODY_SLOT_LABELS: Record<string, string> = {
  head: "头部",
  hand: "手部",
  torso: "上身",
  legs: "下身",
  feet: "脚部",
  neck: "脖颈",
  accessory: "饰品",
};

const ENCOUNTER_TIER_LABELS: Record<string, string> = {
  common: "普通",
  rare: "稀有",
  legendary: "传说",
};

const EVENT_TRIGGER_LABELS: Record<string, string> = {
  afk_tick: "挂机触发",
  enemy_kill: "击杀触发",
};

const EVENT_ACTION_LABELS: Record<string, string> = {
  grant_gold: "奖励金币",
  grant_aether: "奖励以太",
  grant_exp: "奖励经验",
  adjust_health: "调整生命",
  grant_item: "奖励物品",
};

const SKILL_CATEGORY_LABELS: Record<string, string> = {
  attack: "战技",
  spell: "法术",
  guard: "守御",
};

const SKILL_SOURCE_LABELS: Record<string, string> = {
  learned: "玩家技能",
  enemy: "怪物技能",
};

const MAP_KEY_LABELS: Record<string, string> = {
  "palmia-wilds": "野外",
  "moonfall-ruins": "月陨遗迹",
  "timber-camp": "伐木林场",
  "iron-vein-mine": "浅层矿脉",
  "misty-lake": "薄雾湖",
  "crystal-stream": "晶溪",
};

const ACTIVITY_KEY_LABELS: Record<string, string> = {
  combat: "战斗",
  gathering: "采集",
  fishing: "钓鱼",
};

function localizeEnumByPath(path: string, value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  if (path.endsWith(".trigger.type")) {
    return EVENT_TRIGGER_LABELS[value] ?? null;
  }

  if (path.endsWith(".activityKey") || /activityKeys\[\d+\]$/.test(path)) {
    return ACTIVITY_KEY_LABELS[value] ?? null;
  }

  if (/actions\[\d+\]\.type$/.test(path)) {
    return EVENT_ACTION_LABELS[value] ?? null;
  }

  if (path.endsWith(".tier")) {
    return ENCOUNTER_TIER_LABELS[value] ?? null;
  }

  if (path.endsWith(".rarity")) {
    return RARITY_LABELS[value] ?? null;
  }

  if (path.endsWith(".itemType")) {
    return ITEM_TYPE_LABELS[value] ?? null;
  }

  if (path.endsWith(".slot")) {
    return BODY_SLOT_LABELS[value] ?? null;
  }

  if (path.endsWith(".category")) {
    return SKILL_CATEGORY_LABELS[value] ?? null;
  }

  if (path.endsWith(".source")) {
    return SKILL_SOURCE_LABELS[value] ?? null;
  }

  if (path.endsWith(".mapKey") || /mapKeys\[\d+\]$/.test(path)) {
    return MAP_KEY_LABELS[value] ?? null;
  }

  return null;
}

function enumLabel(raw: unknown, label: string | null) {
  if (!label) {
    return raw;
  }

  return `${raw}（${label}）`;
}

export type EnumReadableEntry = {
  path: string;
  raw: string;
  label: string;
};

export function collectEnumReadableEntries(value: unknown) {
  const entries: EnumReadableEntry[] = [];

  function visit(current: unknown, path: string) {
    const localized = localizeEnumByPath(path, current);

    if (localized && typeof current === "string") {
      entries.push({
        path,
        raw: current,
        label: localized,
      });
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, `${path}[${index}]`);
      });
      return;
    }

    const row = asRecord(current);

    if (!row) {
      return;
    }

    Object.entries(row).forEach(([key, fieldValue]) => {
      const nextPath = path ? `${path}.${key}` : key;
      visit(fieldValue, nextPath);
    });
  }

  visit(value, "");

  const unique = new Map<string, EnumReadableEntry>();
  entries.forEach((entry) => {
    unique.set(`${entry.path}:${entry.raw}`, entry);
  });

  return [...unique.values()];
}

export function getArrayItemKey(item: unknown, index: number) {
  const row = asRecord(item);

  if (!row) {
    return `index-${index}`;
  }

  const candidates = [row.itemId, row.key, row.name, row.label]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  return candidates[0] ?? `index-${index}`;
}

export function getArrayItemTitle(item: unknown, index: number) {
  const row = asRecord(item);

  if (!row) {
    return `第 ${index + 1} 项`;
  }

  return String(row.name ?? row.label ?? row.title ?? row.itemId ?? row.key ?? `第 ${index + 1} 项`);
}

export function getArrayItemSubtitle(item: unknown) {
  const row = asRecord(item);

  if (!row) {
    return "";
  }

  const trigger = asRecord(row.trigger);
  if (trigger && typeof trigger.type === "string") {
    const triggerLabel = EVENT_TRIGGER_LABELS[trigger.type] ?? trigger.type;
    const activityText = Array.isArray(trigger.activityKeys)
      ? trigger.activityKeys.map((entry) => enumLabel(entry, localizeEnumByPath("activityKeys[0]", entry))).join(", ")
      : null;
    const mapText = Array.isArray(trigger.mapKeys)
      ? trigger.mapKeys.map((entry) => enumLabel(entry, localizeEnumByPath("mapKeys[0]", entry))).join(", ")
      : null;

    return [row.key, triggerLabel, activityText, mapText, row.priority].filter(Boolean).join(" / ");
  }

  const parts = [
    row.key,
    row.itemId,
    row.type ? enumLabel(row.type, localizeEnumByPath("type", row.type)) : null,
    row.rarity ? enumLabel(row.rarity, localizeEnumByPath("rarity", row.rarity)) : null,
    row.itemType ? enumLabel(row.itemType, localizeEnumByPath("itemType", row.itemType)) : null,
    row.activityKey ? enumLabel(row.activityKey, localizeEnumByPath("activityKey", row.activityKey)) : null,
    row.slot ? enumLabel(row.slot, localizeEnumByPath("slot", row.slot)) : null,
    row.tier ? enumLabel(row.tier, localizeEnumByPath("tier", row.tier)) : null,
    row.category ? enumLabel(row.category, localizeEnumByPath("category", row.category)) : null,
    row.source ? enumLabel(row.source, localizeEnumByPath("source", row.source)) : null,
  ]
    .filter(Boolean)
    .map((entry) => String(entry));

  return parts.join(" / ");
}

export function getEventRuleTriggerType(item: unknown): EventRuleFilter | null {
  const row = asRecord(item);

  const trigger = row ? asRecord(row.trigger) : null;

  if (!row || !trigger || typeof trigger.type !== "string") {
    return null;
  }

  if (trigger.type === "afk_tick") {
    return "afk_tick";
  }

  if (trigger.type === "enemy_kill") {
    return "enemy_kill";
  }

  return null;
}

export function createConfigArrayItem(configKey: ConfigEditorKey) {
  switch (configKey) {
    case "activityConfigs":
      return {
        baseEncounterChance: 0.05,
        iconKey: null,
        key: `new-activity-${Date.now()}`,
        label: "新活动",
        summary: "",
        taskDurationSeconds: 10,
      };
    case "raceConfigs":
      return {
        bodySlotAdjustments: {},
        iconKey: null,
        key: `new-race-${Date.now()}`,
        label: "新种族",
        stats: { agility: 0, intelligence: 0, strength: 0, vitality: 0 },
        summary: "",
      };
    case "classConfigs":
      return {
        iconKey: null,
        key: `new-class-${Date.now()}`,
        label: "新职业",
        starterItemId: "",
        stats: { agility: 0, intelligence: 0, strength: 0, vitality: 0 },
        summary: "",
      };
    case "mapConfigs":
      return {
        activityKey: "combat",
        aetherPerMinute: 0,
        expPerMinute: 0,
        goldPerMinute: 0,
        key: `new-map-${Date.now()}`,
        label: "新地图",
        minLevel: 1,
        summary: "",
      };
    case "itemCatalog":
      return {
        description: "",
        iconKey: null,
        itemId: `new-item-${Date.now()}`,
        name: "新物品",
        rarity: "white",
        sellPrice: 0,
        slot: "hand",
        slotUsage: 1,
        stats: {},
      };
    case "battleEnemyTemplates":
      return {
        key: `new-enemy-${Date.now()}`,
        mapKeys: ["palmia-wilds"],
        name: "新怪物",
        skillCaps: { guard: 0, spell: 0 },
        statWeights: { agility: 1, intelligence: 1, strength: 1, vitality: 1 },
        summary: "",
      };
    case "skillTemplates":
      return {
        key: `new-skill-${Date.now()}`,
        name: "新技能",
        iconText: "新",
        description: "",
        quality: "white",
        category: "attack",
        trigger: "random",
        acquisitionHint: "通过技能书获取",
        source: "learned",
        maxLevel: 10,
        damageMultiplier: 2,
        levelDamageGrowth: 0.1,
        healRatio: 0,
        levelHealGrowth: 0,
        guardRatio: 0,
        levelGuardGrowth: 0,
        maxUses: 1,
        cooldownTurns: 0,
        effects: [],
      };
    case "eventRules":
      return {
        key: `new-event-${Date.now()}`,
        name: "新事件规则",
        enabled: true,
        priority: 100,
        chance: 0.5,
        trigger: {
          type: "afk_tick",
          activityKeys: ["combat"],
          mapKeys: ["palmia-wilds"],
        },
        actions: [
          {
            type: "grant_gold",
            amount: 1000,
            chance: 1,
          },
        ],
      };
    default:
      return {};
  }
}

export function parseJsonSafe(text: string): { value: unknown; error: string | null } {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : "JSON 格式不合法。",
    };
  }
}
