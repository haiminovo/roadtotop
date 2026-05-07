export type ConfigEditorKey =
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
  "mapConfigs",
  "itemCatalog",
  "battleEnemyTemplates",
  "skillTemplates",
  "eventRules",
  "systemBalance",
];

export const CONFIG_LABELS: Record<ConfigEditorKey, string> = {
  raceConfigs: "种族配置",
  classConfigs: "职业配置",
  mapConfigs: "地图配置",
  itemCatalog: "物品目录",
  battleEnemyTemplates: "怪物模板",
  skillTemplates: "技能模板",
  eventRules: "统一事件池",
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
    const triggerType = trigger.type;
    const triggerLabel = triggerType === "afk_tick"
      ? "挂机触发"
      : triggerType === "enemy_kill"
        ? "击杀触发"
        : triggerType;
    return [row.key, triggerLabel, row.priority].filter(Boolean).join(" / ");
  }

  return [row.key, row.itemId, row.type, row.rarity].filter(Boolean).join(" / ");
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
        aetherPerMinute: 0,
        expPerMinute: 0,
        goldPerMinute: 0,
        key: `new-map-${Date.now()}`,
        label: "新地图",
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
          type: "enemy_kill",
          enemyKeys: [],
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
