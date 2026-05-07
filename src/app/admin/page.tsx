'use client';

import { useEffect, useMemo, useState } from "react";
import { ConfigProvider, Input, InputNumber, Modal, Segmented, Select, Switch } from "antd";

type AdminConfigResponse = {
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

type AdminRoleRecord = {
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

type AdminAccountRecord = {
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

type AdminAccountDraft = {
  accountType: "guest" | "account";
  guestToken: string;
  password: string;
  userId?: string;
  username: string;
};

type AdminSectionKey = "accounts" | "roles" | "configWorkbench" | "system" | "reference";
type ConfigEditorKey =
  | "raceConfigs"
  | "classConfigs"
  | "mapConfigs"
  | "itemCatalog"
  | "battleEnemyTemplates"
  | "skillTemplates"
  | "eventRules"
  | "afkEncounterPool"
  | "afkEncounterChances"
  | "systemBalance";

type SectionDefinition = {
  key: AdminSectionKey;
  label: string;
  hint: string;
};

type ConfigDefinition = {
  key: ConfigEditorKey;
  category: "configWorkbench" | "system";
  description: string;
  group: string;
  label: string;
};

type RequestErrorPayload = {
  details?: unknown;
  error?: string;
  fieldErrors?: Partial<Record<ConfigEditorKey, string[]>>;
  ok: boolean;
};

type RequestFailure = Error & {
  details?: unknown;
  fieldErrors?: Partial<Record<ConfigEditorKey, string[]>>;
};

type JsonParseResult =
  | { error: null; value: unknown }
  | { error: string; value: null };

type DisplayNameLookups = {
  classLabelsByKey: Record<string, string>;
  enemyNamesByKey: Record<string, string>;
  itemNamesById: Record<string, string>;
  mapLabelsByKey: Record<string, string>;
  raceLabelsByKey: Record<string, string>;
};

type ItemSelectOption = {
  itemId: string;
  itemType: string | null;
  name: string;
  rarity: string | null;
};

type BasicSelectOption = {
  label: string;
  value: string;
};

const SIDEBAR_SECTIONS: SectionDefinition[] = [
  { key: "accounts", label: "账号管理", hint: "账号 / 密码 / Token" },
  { key: "roles", label: "角色管理", hint: "角色 / 数值 / 职业" },
  { key: "configWorkbench", label: "配置中心", hint: "成长 / 内容 / 挂机事件" },
  { key: "system", label: "系统参数", hint: "战斗 / 市场 / 平衡" },
  { key: "reference", label: "运行时参考", hint: "常量 / 槽位辅助" },
];

const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    key: "raceConfigs",
    category: "configWorkbench",
    group: "成长体系",
    label: "种族配置",
    description: "定义初始四维、身体槽位修正和角色定位。",
  },
  {
    key: "classConfigs",
    category: "configWorkbench",
    group: "成长体系",
    label: "职业配置",
    description: "定义职业增益、开局装备和成长方向。",
  },
  {
    key: "mapConfigs",
    category: "configWorkbench",
    group: "成长体系",
    label: "地图配置",
    description: "定义挂机地图的经验、金币和以太收益。",
  },
  {
    key: "itemCatalog",
    category: "configWorkbench",
    group: "内容资源",
    label: "物品目录",
    description: "定义装备、售价、占用槽位和词条属性。",
  },
  {
    key: "skillTemplates",
    category: "configWorkbench",
    group: "内容资源",
    label: "技能模板",
    description: "定义技能倍率、单轮次数、冷却、技能效果与 buff/debuff 持续回合。",
  },
  {
    key: "battleEnemyTemplates",
    category: "configWorkbench",
    group: "内容资源",
    label: "怪物模板",
    description: "定义怪物风格、技能次数和属性权重。",
  },
  {
    key: "eventRules",
    category: "configWorkbench",
    group: "挂机事件",
    label: "统一事件池",
    description: "统一配置触发条件、目标筛选、概率与奖励动作（支持击杀怪物/挂机触发）。",
  },
  {
    key: "afkEncounterPool",
    category: "configWorkbench",
    group: "挂机事件",
    label: "挂机遭遇池（兼容）",
    description: "兼容旧配置，建议统一迁移到“统一事件池”。",
  },
  {
    key: "afkEncounterChances",
    category: "configWorkbench",
    group: "挂机事件",
    label: "遭遇概率（兼容）",
    description: "兼容旧配置，建议统一迁移到“统一事件池”。",
  },
  {
    key: "systemBalance",
    category: "system",
    group: "系统参数",
    label: "系统平衡参数",
    description: "定义市场手续费、战斗触发率和战斗判定参数。",
  },
];

const ROLE_COLUMNS = [
  "name",
  "raceKey",
  "classKey",
  "level",
  "exp",
  "gold",
  "aetherCrystal",
  "currentHealth",
  "strength",
  "agility",
  "intelligence",
  "vitality",
  "avatarSeed",
] as const;

const ROLE_TEXT_COLUMNS = ["name", "raceKey", "classKey", "avatarSeed"] as const;

const ROLE_COLUMN_WIDTHS: Record<(typeof ROLE_COLUMNS)[number], number> = {
  agility: 110,
  aetherCrystal: 130,
  avatarSeed: 170,
  classKey: 120,
  currentHealth: 120,
  exp: 120,
  gold: 120,
  intelligence: 120,
  level: 90,
  name: 140,
  raceKey: 120,
  strength: 110,
  vitality: 110,
};

const ARRAY_CONFIG_KEYS: ConfigEditorKey[] = [
  "raceConfigs",
  "classConfigs",
  "mapConfigs",
  "itemCatalog",
  "skillTemplates",
  "battleEnemyTemplates",
  "eventRules",
  "afkEncounterPool",
];

const SYSTEM_BALANCE_FIELD_LABELS: Record<string, string> = {
  marketFeeRatePercent: "市场手续费率（%）",
  battleTriggerChance: "战斗触发概率",
  actionBarTarget: "行动条目标值",
  playerHealRatio: "玩家治疗比例",
  playerGuardRatio: "玩家格挡比例",
  enemyHealRatio: "敌方治疗比例",
  enemyGuardRatio: "敌方格挡比例",
  spellBaseChance: "法术基础触发概率",
  intelligenceSpellBonusThreshold: "智力法术加成阈值",
  executionRewardTickSeconds: "处决奖励结算间隔（秒）",
  playerGuardHealthThreshold: "玩家格挡血量阈值",
  enemyGuardHealthThreshold: "敌方格挡血量阈值",
  playerGuardCooldownTurns: "玩家格挡冷却回合",
  enemyGuardCooldownTurns: "敌方格挡冷却回合",
};

const STAT_FIELDS = [
  { key: "strength", label: "力量" },
  { key: "agility", label: "敏捷" },
  { key: "intelligence", label: "智力" },
  { key: "vitality", label: "体质" },
] as const;

const BODY_SLOT_FALLBACK_OPTIONS: BasicSelectOption[] = [
  { label: "头部", value: "head" },
  { label: "手部", value: "hand" },
  { label: "躯干", value: "torso" },
  { label: "腿部", value: "legs" },
  { label: "脚部", value: "feet" },
  { label: "颈部", value: "neck" },
  { label: "饰品", value: "accessory" },
];

const ITEM_RARITY_OPTIONS: BasicSelectOption[] = [
  { label: "普通 white", value: "white" },
  { label: "优秀 green", value: "green" },
  { label: "稀有 blue", value: "blue" },
  { label: "史诗 purple", value: "purple" },
  { label: "传说 orange", value: "orange" },
];

const ITEM_TYPE_OPTIONS: BasicSelectOption[] = [
  { label: "装备 equipment", value: "equipment" },
  { label: "技能书 skill_book", value: "skill_book" },
  { label: "材料 material", value: "material" },
];

function formatDateTime(value: number | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsonSafe(value: string): JsonParseResult {
  try {
    return { error: null, value: JSON.parse(value) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "JSON 格式不合法。",
      value: null,
    };
  }
}

function isArrayConfigKey(key: ConfigEditorKey) {
  return ARRAY_CONFIG_KEYS.includes(key);
}

function isRoleTextColumn(column: (typeof ROLE_COLUMNS)[number]) {
  return (ROLE_TEXT_COLUMNS as readonly string[]).includes(column);
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumberOrDefault(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function buildDisplayNameMap(
  draft: string | undefined,
  keyField: string,
  labelFields: string[],
) {
  if (!draft) {
    return {} as Record<string, string>;
  }

  const parsed = parseJsonSafe(draft);
  if (parsed.error || !Array.isArray(parsed.value)) {
    return {} as Record<string, string>;
  }

  const entries: Record<string, string> = {};

  parsed.value.forEach((entry) => {
    if (!isRecord(entry)) {
      return;
    }

    const rawKey = asNonEmptyString(entry[keyField]);
    if (!rawKey) {
      return;
    }

    const localized = labelFields
      .map((fieldKey) => asNonEmptyString(entry[fieldKey]))
      .find((value) => Boolean(value));

    entries[rawKey] = localized ?? rawKey;
  });

  return entries;
}

function formatDisplayNameInline(rawValue: unknown, displayNameMap: Record<string, string>) {
  const raw = asNonEmptyString(rawValue);

  if (!raw) {
    return null;
  }

  const localized = displayNameMap[raw];
  if (!localized || localized === raw) {
    return raw;
  }

  return `${localized} (${raw})`;
}

function localizeCompositeText(value: unknown, displayNameLookups: DisplayNameLookups) {
  const raw = asNonEmptyString(value);
  if (!raw) {
    return raw;
  }

  let localizedText = raw;
  const replacements = new Map<string, string>();
  const sources = [
    displayNameLookups.enemyNamesByKey,
    displayNameLookups.itemNamesById,
    displayNameLookups.mapLabelsByKey,
    displayNameLookups.raceLabelsByKey,
    displayNameLookups.classLabelsByKey,
  ];

  sources.forEach((source) => {
    Object.entries(source).forEach(([key, displayName]) => {
      if (!key || !displayName || key === displayName) {
        return;
      }
      replacements.set(key, `${displayName} (${key})`);
    });
  });

  // Longer keys first to avoid partial replacement conflicts.
  Array.from(replacements.entries())
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([key, replacement]) => {
      localizedText = localizedText.split(key).join(replacement);
    });

  return localizedText;
}

function getArrayItemTitle(
  configKey: ConfigEditorKey,
  item: unknown,
  index: number,
  displayNameLookups?: DisplayNameLookups,
) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 项`;
  }

  if (configKey === "eventRules" && displayNameLookups) {
    const baseTitle = item.name ?? item.label ?? item.title ?? item.key;
    const localizedTitle = localizeCompositeText(baseTitle, displayNameLookups);

    if (localizedTitle) {
      return localizedTitle;
    }
  }

  return String(
    item.label
    ?? item.name
    ?? item.title
    ?? item.itemId
    ?? item.key
    ?? `第 ${index + 1} 项`,
  );
}

function getArrayItemSubtitle(
  configKey: ConfigEditorKey,
  item: unknown,
  displayNameLookups?: DisplayNameLookups,
) {
  if (!isRecord(item)) {
    return "未识别条目";
  }

  if (configKey === "itemCatalog") {
    return [
      formatDisplayNameInline(item.itemId, displayNameLookups?.itemNamesById ?? {}),
      item.slot,
      item.rarity,
    ].filter(Boolean).join(" / ");
  }

  if (configKey === "classConfigs") {
    return [
      item.key,
      formatDisplayNameInline(item.starterItemId, displayNameLookups?.itemNamesById ?? {}),
    ].filter(Boolean).join(" / ");
  }

  if (configKey === "mapConfigs") {
    return [item.key, item.label].filter(Boolean).join(" / ");
  }

  if (configKey === "afkEncounterPool") {
    return [item.key, item.tier].filter(Boolean).join(" / ");
  }

  if (configKey === "eventRules") {
    const trigger = isRecord(item.trigger) ? item.trigger : {};
    return [
      item.key,
      trigger.type,
      Array.isArray(trigger.enemyKeys)
        ? `怪物:${trigger.enemyKeys
          .map((enemyKey) => formatDisplayNameInline(enemyKey, displayNameLookups?.enemyNamesByKey ?? {}) ?? String(enemyKey))
          .join(",")}`
        : null,
      Array.isArray(trigger.mapKeys)
        ? `地图:${trigger.mapKeys
          .map((mapKey) => formatDisplayNameInline(mapKey, displayNameLookups?.mapLabelsByKey ?? {}) ?? String(mapKey))
          .join(",")}`
        : null,
    ].filter(Boolean).join(" / ");
  }

  if (configKey === "skillTemplates") {
    return [item.key, item.category, item.quality].filter(Boolean).join(" / ");
  }

  return [item.key, item.summary].filter(Boolean).join(" / ");
}

function createConfigArrayItem(configKey: ConfigEditorKey) {
  switch (configKey) {
    case "raceConfigs":
      return {
        bodySlotAdjustments: {},
        iconKey: null,
        key: "new-race",
        label: "新种族",
        stats: { agility: 0, intelligence: 0, strength: 0, vitality: 0 },
        summary: "",
      };
    case "classConfigs":
      return {
        iconKey: null,
        key: "new-class",
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
        key: "new-map",
        label: "新地图",
        summary: "",
      };
    case "itemCatalog":
      return {
        description: "",
        iconKey: null,
        itemId: "new-item",
        name: "新物品",
        rarity: "white",
        sellPrice: 0,
        slot: "hand",
        slotUsage: 1,
        stats: {},
      };
    case "battleEnemyTemplates":
      return {
        key: "new-enemy",
        mapKeys: ["palmia-wilds"],
        name: "新怪物",
        skillCaps: { guard: 0, spell: 0 },
        statWeights: { agility: 1, intelligence: 1, strength: 1, vitality: 1 },
        summary: "",
      };
    case "skillTemplates":
      return {
        key: "new-skill",
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
    case "afkEncounterPool":
      return {
        description: "",
        key: "new-encounter",
        mapKeys: ["palmia-wilds"],
        reward: {
          aetherCrystal: 0,
          exp: 0,
          gold: 0,
        },
        tier: "common",
        title: "新事件",
      };
    case "eventRules":
      return {
        key: "new-event-rule",
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

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json() as T & RequestErrorPayload;

  if (!response.ok || !payload.ok) {
    const requestError = new Error(payload.error ?? "请求失败。") as RequestFailure;

    if (payload.fieldErrors) {
      requestError.fieldErrors = payload.fieldErrors;
    }

    if (payload.details !== undefined) {
      requestError.details = payload.details;

      if (
        !requestError.fieldErrors
        && payload.details
        && typeof payload.details === "object"
        && "fieldErrors" in payload.details
      ) {
        requestError.fieldErrors = (payload.details as { fieldErrors?: RequestFailure["fieldErrors"] }).fieldErrors;
      }
    }

    throw requestError;
  }

  return payload;
}

function MobileAdminCollapse({
  children,
  className,
  contentClassName,
  defaultOpen = true,
  summary,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  summary: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={className ?? "space-y-3"}>
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_6px_16px_rgba(15,23,42,0.06)] lg:hidden"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{summary}</p>
        </div>
        <span className="ml-3 shrink-0 text-xs font-medium text-slate-500">
          {isOpen ? "收起" : "展开"}
        </span>
      </button>

      <div className={`${isOpen ? "block" : "hidden"} lg:block ${contentClassName ?? ""}`}>
        {children}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [accountDeleteTarget, setAccountDeleteTarget] = useState<AdminAccountRecord | null>(null);
  const [accountDraft, setAccountDraft] = useState<AdminAccountDraft>({
    accountType: "guest",
    guestToken: "",
    password: "",
    username: "",
  });
  const [accountKeyword, setAccountKeyword] = useState("");
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [activeSection, setActiveSection] = useState<AdminSectionKey>("accounts");
  const [configPayload, setConfigPayload] = useState<AdminConfigResponse | null>(null);
  const [configFieldErrors, setConfigFieldErrors] = useState<Partial<Record<ConfigEditorKey, string[]>>>({});
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [itemEditorDrafts, setItemEditorDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [roleKeyword, setRoleKeyword] = useState("");
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"structured" | "raw">("structured");
  const [selectedArrayItemIndexes, setSelectedArrayItemIndexes] = useState<Partial<Record<ConfigEditorKey, number>>>({});
  const [selectedConfigKey, setSelectedConfigKey] = useState<ConfigEditorKey>("raceConfigs");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    void Promise.all([
      requestJson<AdminConfigResponse>("/api/admin/config"),
      requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts"),
      requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles"),
    ])
      .then(([configResponse, accountsResponse, rolesResponse]) => {
        setConfigPayload(configResponse);
        setAccounts(accountsResponse.accounts);
        setRoles(rolesResponse.roles);
        setConfigFieldErrors({});
        setConfigDrafts({
          raceConfigs: pretty(configResponse.config.raceConfigs),
          classConfigs: pretty(configResponse.config.classConfigs),
          mapConfigs: pretty(configResponse.config.mapConfigs),
          itemCatalog: pretty(configResponse.config.itemCatalog),
          skillTemplates: pretty(configResponse.config.skillTemplates),
          battleEnemyTemplates: pretty(configResponse.config.battleEnemyTemplates),
          eventRules: pretty(configResponse.config.eventRules),
          afkEncounterPool: pretty(configResponse.config.afkEncounterPool),
          afkEncounterChances: pretty(configResponse.config.afkEncounterChances),
          systemBalance: pretty(configResponse.config.systemBalance),
        });
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "加载后台失败。");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    document.body.classList.add("admin-body");

    return () => {
      document.body.classList.remove("admin-body");
    };
  }, []);

  const selectedConfig = useMemo(
    () => CONFIG_DEFINITIONS.find((item) => item.key === selectedConfigKey) ?? CONFIG_DEFINITIONS[0],
    [selectedConfigKey],
  );

  const selectedConfigDraft = configDrafts[selectedConfig.key] ?? "";

  const selectedConfigParseResult = useMemo(
    () => parseJsonSafe(selectedConfigDraft),
    [selectedConfigDraft],
  );

  const selectedArrayItems = useMemo(
    () => Array.isArray(selectedConfigParseResult.value) ? selectedConfigParseResult.value : null,
    [selectedConfigParseResult.value],
  );

  const selectedObjectEntries = useMemo(() => {
    if (!isRecord(selectedConfigParseResult.value)) {
      return null;
    }

    return Object.entries(selectedConfigParseResult.value);
  }, [selectedConfigParseResult.value]);

  const selectedArrayItemIndex = selectedArrayItemIndexes[selectedConfig.key] ?? 0;
  const selectedArrayItem = selectedArrayItems?.[selectedArrayItemIndex] ?? null;
  const selectedItemEditorKey = `${selectedConfig.key}:${selectedArrayItemIndex}`;
  const selectedItemEditorValue = selectedArrayItem === null
    ? ""
    : itemEditorDrafts[selectedItemEditorKey] ?? pretty(selectedArrayItem);
  const selectedEventRule = useMemo(() => {
    if (selectedConfig.key !== "eventRules") {
      return null;
    }
    const parsed = parseJsonSafe(selectedItemEditorValue);
    return parsed.error || !isRecord(parsed.value) ? null : parsed.value;
  }, [selectedConfig.key, selectedItemEditorValue]);
  const selectedStructuredItem = useMemo(() => {
    const parsed = parseJsonSafe(selectedItemEditorValue);
    return parsed.error || !isRecord(parsed.value) ? null : parsed.value;
  }, [selectedItemEditorValue]);
  const selectedStructuredStats = useMemo(
    () => isRecord(selectedStructuredItem?.stats) ? selectedStructuredItem.stats : {},
    [selectedStructuredItem],
  );
  const selectedStructuredBodySlotAdjustments = useMemo(
    () => isRecord(selectedStructuredItem?.bodySlotAdjustments) ? selectedStructuredItem.bodySlotAdjustments : {},
    [selectedStructuredItem],
  );

  const visibleConfigTabs = useMemo(
    () => CONFIG_DEFINITIONS.filter((item) => item.category === activeSection),
    [activeSection],
  );
  const configTabGroups = useMemo(() => {
    const grouped = new Map<string, ConfigDefinition[]>();

    visibleConfigTabs.forEach((item) => {
      const items = grouped.get(item.group) ?? [];
      items.push(item);
      grouped.set(item.group, items);
    });

    return Array.from(grouped.entries()).map(([group, tabs]) => ({ group, tabs }));
  }, [visibleConfigTabs]);
  const hasStructuredEditor = !selectedConfigParseResult.error && (selectedArrayItems !== null || selectedObjectEntries !== null);

  useEffect(() => {
    if (activeSection === "roles" || activeSection === "reference") {
      return;
    }

    const nextTab = CONFIG_DEFINITIONS.find((item) => item.category === activeSection);

    if (nextTab) {
      setSelectedConfigKey(nextTab.key);
    }
  }, [activeSection]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeSection]);

  useEffect(() => {
    setEditorMode(hasStructuredEditor ? "structured" : "raw");
  }, [hasStructuredEditor, selectedConfig.key]);

  useEffect(() => {
    if (!selectedArrayItems) {
      return;
    }

    setSelectedArrayItemIndexes((current) => {
      const currentIndex = current[selectedConfig.key] ?? 0;
      const nextIndex = Math.min(currentIndex, Math.max(0, selectedArrayItems.length - 1));

      if (currentIndex === nextIndex) {
        return current;
      }

      return {
        ...current,
        [selectedConfig.key]: nextIndex,
      };
    });
  }, [selectedArrayItems, selectedConfig.key]);

  const filteredRoles = useMemo(() => {
    const keyword = roleKeyword.trim().toLowerCase();

    if (!keyword) {
      return roles;
    }

    return roles.filter((role) =>
      role.name.toLowerCase().includes(keyword)
      || role.raceKey.toLowerCase().includes(keyword)
      || role.classKey.toLowerCase().includes(keyword)
      || (role.username ?? "").toLowerCase().includes(keyword),
    );
  }, [roleKeyword, roles]);

  const enemyKeyOptions = useMemo(() => {
    try {
      const parsed = JSON.parse(configDrafts.battleEnemyTemplates ?? "[]");
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((entry) => isRecord(entry) && typeof entry.key === "string" ? entry.key : null)
        .filter((entry): entry is string => Boolean(entry));
    } catch {
      return [];
    }
  }, [configDrafts.battleEnemyTemplates]);

  const mapKeyOptions = useMemo(() => {
    try {
      const parsed = JSON.parse(configDrafts.mapConfigs ?? "[]");
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((entry) => isRecord(entry) && typeof entry.key === "string" ? entry.key : null)
        .filter((entry): entry is string => Boolean(entry));
    } catch {
      return [];
    }
  }, [configDrafts.mapConfigs]);

  const raceLabelsByKey = useMemo(
    () => buildDisplayNameMap(configDrafts.raceConfigs, "key", ["label", "name"]),
    [configDrafts.raceConfigs],
  );

  const classLabelsByKey = useMemo(
    () => buildDisplayNameMap(configDrafts.classConfigs, "key", ["label", "name"]),
    [configDrafts.classConfigs],
  );

  const mapLabelsByKey = useMemo(
    () => buildDisplayNameMap(configDrafts.mapConfigs, "key", ["label", "name"]),
    [configDrafts.mapConfigs],
  );

  const enemyNamesByKey = useMemo(
    () => buildDisplayNameMap(configDrafts.battleEnemyTemplates, "key", ["name", "label"]),
    [configDrafts.battleEnemyTemplates],
  );

  const itemNamesById = useMemo(
    () => buildDisplayNameMap(configDrafts.itemCatalog, "itemId", ["name", "label"]),
    [configDrafts.itemCatalog],
  );

  const itemSelectOptions = useMemo<ItemSelectOption[]>(() => {
    const parsed = parseJsonSafe(configDrafts.itemCatalog ?? "[]");
    if (parsed.error || !Array.isArray(parsed.value)) {
      return [];
    }

    const options: ItemSelectOption[] = parsed.value
      .map((entry) => {
        if (!isRecord(entry)) {
          return null;
        }

        const itemId = asNonEmptyString(entry.itemId);
        if (!itemId) {
          return null;
        }

        return {
          itemId,
          itemType: asNonEmptyString(entry.itemType),
          name: asNonEmptyString(entry.name) ?? itemId,
          rarity: asNonEmptyString(entry.rarity),
        };
      })
      .filter((entry): entry is ItemSelectOption => Boolean(entry));

    options.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
    return options;
  }, [configDrafts.itemCatalog]);

  const displayNameLookups = useMemo<DisplayNameLookups>(
    () => ({
      classLabelsByKey,
      enemyNamesByKey,
      itemNamesById,
      mapLabelsByKey,
      raceLabelsByKey,
    }),
    [classLabelsByKey, enemyNamesByKey, itemNamesById, mapLabelsByKey, raceLabelsByKey],
  );

  const mapSelectOptions = useMemo<BasicSelectOption[]>(
    () => mapKeyOptions.map((mapKey) => ({
      label: formatDisplayNameInline(mapKey, displayNameLookups.mapLabelsByKey) ?? mapKey,
      value: mapKey,
    })),
    [displayNameLookups.mapLabelsByKey, mapKeyOptions],
  );

  const enemySelectOptions = useMemo<BasicSelectOption[]>(
    () => enemyKeyOptions.map((enemyKey) => ({
      label: formatDisplayNameInline(enemyKey, displayNameLookups.enemyNamesByKey) ?? enemyKey,
      value: enemyKey,
    })),
    [displayNameLookups.enemyNamesByKey, enemyKeyOptions],
  );

  const itemSelectDropdownOptions = useMemo<BasicSelectOption[]>(
    () => itemSelectOptions.map((option) => ({
      label: `${option.name} (${option.itemId})${option.rarity ? ` · ${option.rarity}` : ""}${option.itemType ? ` · ${option.itemType}` : ""}`,
      value: option.itemId,
    })),
    [itemSelectOptions],
  );

  const accountTypeOptions = useMemo(
    () => [
      { label: "guest", value: "guest" },
      { label: "account", value: "account" },
    ] as const,
    [],
  );

  const eventTriggerTypeOptions = useMemo<BasicSelectOption[]>(
    () => [
      { label: "挂机结算触发", value: "afk_tick" },
      { label: "击杀怪物触发", value: "enemy_kill" },
    ],
    [],
  );

  const eventTierOptions = useMemo<BasicSelectOption[]>(
    () => [
      { label: "common", value: "common" },
      { label: "rare", value: "rare" },
      { label: "legendary", value: "legendary" },
    ],
    [],
  );

  const actionTypeOptions = useMemo<BasicSelectOption[]>(
    () => [
      { label: "金币", value: "grant_gold" },
      { label: "以太", value: "grant_aether" },
      { label: "经验", value: "grant_exp" },
      { label: "生命变化", value: "adjust_health" },
      { label: "物品", value: "grant_item" },
    ],
    [],
  );

  const bodySlotTypeOptions = useMemo<BasicSelectOption[]>(
    () => {
      const labels = configPayload?.meta?.helpers?.bodySlotTypeLabels;
      if (!Array.isArray(labels) || labels.length === 0) {
        return BODY_SLOT_FALLBACK_OPTIONS;
      }
      return labels
        .map((entry) => ({
          label: `${entry.label} (${entry.key})`,
          value: entry.key,
        }))
        .filter((entry) => entry.value);
    },
    [configPayload?.meta?.helpers?.bodySlotTypeLabels],
  );
  const bodySlotBaseCapacities = useMemo<Record<string, number>>(() => {
    const source = configPayload?.meta?.constants?.DEFAULT_BODY_SLOT_CAPACITIES;
    if (!isRecord(source)) {
      return {};
    }

    const entries: Record<string, number> = {};
    Object.entries(source).forEach(([slotType, value]) => {
      if (typeof value === "number") {
        entries[slotType] = value;
      }
    });
    return entries;
  }, [configPayload?.meta?.constants?.DEFAULT_BODY_SLOT_CAPACITIES]);

  const filteredAccounts = useMemo(() => {
    const keyword = accountKeyword.trim().toLowerCase();

    if (!keyword) {
      return accounts;
    }

    return accounts.filter((account) =>
      account.userId.toLowerCase().includes(keyword)
      || account.guestToken.toLowerCase().includes(keyword)
      || (account.username ?? "").toLowerCase().includes(keyword)
      || (account.roleName ?? "").toLowerCase().includes(keyword),
    );
  }, [accountKeyword, accounts]);

  const metrics = useMemo(() => {
    const raceCount = Array.isArray(configPayload?.config.raceConfigs) ? configPayload.config.raceConfigs.length : 0;
    const classCount = Array.isArray(configPayload?.config.classConfigs) ? configPayload.config.classConfigs.length : 0;
    const itemCount = Array.isArray(configPayload?.config.itemCatalog) ? configPayload.config.itemCatalog.length : 0;
    const encounterCount = Array.isArray(configPayload?.config.eventRules) ? configPayload.config.eventRules.length : 0;

    return {
      accountCount: accounts.length,
      classCount,
      encounterCount,
      itemCount,
      raceCount,
    };
  }, [accounts.length, configPayload]);

  const clearConfigFieldErrors = (configKey: ConfigEditorKey) => {
    setConfigFieldErrors((current) => {
      if (!current[configKey]?.length) {
        return current;
      }

      return {
        ...current,
        [configKey]: [],
      };
    });
  };

  const updateConfigDraftValue = (configKey: ConfigEditorKey, nextValue: string) => {
    setConfigDrafts((current) => ({ ...current, [configKey]: nextValue }));
    clearConfigFieldErrors(configKey);
  };

  const replaceSelectedArrayItems = (nextItems: unknown[], nextIndex?: number) => {
    updateConfigDraftValue(selectedConfig.key, pretty(nextItems));

    if (nextIndex !== undefined) {
      setSelectedArrayItemIndexes((current) => ({
        ...current,
        [selectedConfig.key]: nextIndex,
      }));
    }
  };

  const applySelectedItemEditor = () => {
    if (!selectedArrayItems || selectedArrayItem === null) {
      return;
    }

    const parsed = parseJsonSafe(selectedItemEditorValue);

    if (parsed.error) {
      setError(`当前项保存失败：${parsed.error}`);
      return;
    }

    const nextItems = selectedArrayItems.map((item, index) => (
      index === selectedArrayItemIndex ? parsed.value : item
    ));

    replaceSelectedArrayItems(nextItems, selectedArrayItemIndex);
    setError(null);
  };

  const patchSelectedItemEditorObject = (mutator: (current: Record<string, unknown>) => Record<string, unknown>) => {
    const base = parseJsonSafe(selectedItemEditorValue);
    if (base.error || !isRecord(base.value)) {
      return;
    }
    const nextValue = pretty(mutator(base.value));
    setItemEditorDrafts((current) => ({
      ...current,
      [selectedItemEditorKey]: nextValue,
    }));
  };

  const patchEventRuleTrigger = (patch: Record<string, unknown>) => {
    patchSelectedItemEditorObject((current) => {
      const trigger = isRecord(current.trigger) ? current.trigger : {};
      return {
        ...current,
        trigger: {
          ...trigger,
          ...patch,
        },
      };
    });
  };

  const patchEventRule = (patch: Record<string, unknown>) => {
    patchSelectedItemEditorObject((current) => ({
      ...current,
      ...patch,
    }));
  };

  const patchSelectedItemField = (field: string, value: unknown) => {
    patchSelectedItemEditorObject((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const patchSelectedItemStatsField = (field: string, value: number) => {
    patchSelectedItemEditorObject((current) => {
      const stats = isRecord(current.stats) ? current.stats : {};
      return {
        ...current,
        stats: {
          ...stats,
          [field]: value,
        },
      };
    });
  };

  const patchSelectedItemBodySlotAdjustment = (slotType: string, value: number) => {
    patchSelectedItemEditorObject((current) => {
      const bodySlotAdjustments = isRecord(current.bodySlotAdjustments) ? current.bodySlotAdjustments : {};
      return {
        ...current,
        bodySlotAdjustments: {
          ...bodySlotAdjustments,
          [slotType]: Math.max(0, value),
        },
      };
    });
  };

  const patchEventRuleActionAt = (index: number, patch: Record<string, unknown>) => {
    patchSelectedItemEditorObject((current) => {
      const actions = Array.isArray(current.actions) ? current.actions : [];
      const nextActions = actions.map((entry, actionIndex) => {
        if (!isRecord(entry) || actionIndex !== index) {
          return entry;
        }
        return {
          ...entry,
          ...patch,
        };
      });
      return {
        ...current,
        actions: nextActions,
      };
    });
  };

  const removeEventRuleActionAt = (index: number) => {
    patchSelectedItemEditorObject((current) => {
      const actions = Array.isArray(current.actions) ? current.actions : [];
      return {
        ...current,
        actions: actions.filter((_, actionIndex) => actionIndex !== index),
      };
    });
  };

  const addEventRuleAction = () => {
    patchSelectedItemEditorObject((current) => {
      const actions = Array.isArray(current.actions) ? current.actions : [];
      return {
        ...current,
        actions: [
          ...actions,
          {
            type: "grant_gold",
            amount: 100,
            chance: 1,
          },
        ],
      };
    });
  };

  const resetSelectedItemEditor = () => {
    if (selectedArrayItem === null) {
      return;
    }

    setItemEditorDrafts((current) => ({
      ...current,
      [selectedItemEditorKey]: pretty(selectedArrayItem),
    }));
  };

  const addStructuredArrayItem = () => {
    if (!selectedArrayItems || !isArrayConfigKey(selectedConfig.key)) {
      return;
    }

    const nextItems = [...selectedArrayItems, createConfigArrayItem(selectedConfig.key)];
    const nextIndex = nextItems.length - 1;

    replaceSelectedArrayItems(nextItems, nextIndex);
    setItemEditorDrafts((current) => ({
      ...current,
      [`${selectedConfig.key}:${nextIndex}`]: pretty(nextItems[nextIndex]),
    }));
    setError(null);
  };

  const removeStructuredArrayItem = (index: number) => {
    if (!selectedArrayItems || selectedArrayItems.length === 0) {
      return;
    }

    const nextItems = selectedArrayItems.filter((_, itemIndex) => itemIndex !== index);
    replaceSelectedArrayItems(nextItems, Math.max(0, Math.min(index, nextItems.length - 1)));
    setError(null);
  };

  const updateStructuredObjectField = (fieldKey: string, nextValue: string) => {
    if (!isRecord(selectedConfigParseResult.value)) {
      return;
    }

    const currentValue = selectedConfigParseResult.value[fieldKey];
    let normalizedValue: unknown = nextValue;

    if (typeof currentValue === "number") {
      normalizedValue = nextValue === "" ? 0 : Number(nextValue);
    } else if (typeof currentValue === "boolean") {
      normalizedValue = nextValue === "true";
    }

    updateConfigDraftValue(
      selectedConfig.key,
      pretty({
        ...selectedConfigParseResult.value,
        [fieldKey]: normalizedValue,
      }),
    );
    setError(null);
  };

  const saveConfig = async () => {
    if (!configPayload) {
      return;
    }

    try {
      setSavingKey("config");
      setError(null);
      setConfigFieldErrors({});

      const body = {} as Record<ConfigEditorKey, unknown>;

      for (const definition of CONFIG_DEFINITIONS) {
        try {
          body[definition.key] = JSON.parse(configDrafts[definition.key] ?? "");
        } catch (parseError) {
          setConfigFieldErrors({
            [definition.key]: [
              `JSON 解析失败：${parseError instanceof Error ? parseError.message : "格式不合法。"}`,
            ],
          });
          setError(`发布失败：${definition.label} 不是合法 JSON。`);
          setSelectedConfigKey(definition.key);
          return;
        }
      }

      const response = await requestJson<{ config: AdminConfigResponse["config"] }>("/api/admin/config", {
        body: JSON.stringify(body),
        method: "PUT",
      });

      setConfigPayload((current) => current ? { ...current, config: response.config } : current);
      setConfigFieldErrors({});
      setConfigDrafts({
        raceConfigs: pretty(response.config.raceConfigs),
        classConfigs: pretty(response.config.classConfigs),
        mapConfigs: pretty(response.config.mapConfigs),
        itemCatalog: pretty(response.config.itemCatalog),
        skillTemplates: pretty(response.config.skillTemplates),
        battleEnemyTemplates: pretty(response.config.battleEnemyTemplates),
        eventRules: pretty(response.config.eventRules),
        afkEncounterPool: pretty(response.config.afkEncounterPool),
        afkEncounterChances: pretty(response.config.afkEncounterChances),
        systemBalance: pretty(response.config.systemBalance),
      });
    } catch (saveError) {
      const requestError = saveError as RequestFailure;
      const nextFieldErrors = requestError.fieldErrors ?? {};

      if (Object.keys(nextFieldErrors).length > 0) {
        setConfigFieldErrors(nextFieldErrors);

        const firstInvalidKey = CONFIG_DEFINITIONS.find((definition) => {
          const fieldMessages = nextFieldErrors[definition.key];
          return Array.isArray(fieldMessages) && fieldMessages.length > 0;
        })?.key;

        if (firstInvalidKey) {
          setSelectedConfigKey(firstInvalidKey);
        }
      }

      setError(saveError instanceof Error ? saveError.message : "保存配置失败。");
    } finally {
      setSavingKey(null);
    }
  };

  const updateRoleField = (roleId: string, field: keyof AdminRoleRecord, value: string | number) => {
    setRoles((current) => current.map((role) => {
      if (role.roleId !== roleId) {
        return role;
      }

      if (field === "name" || field === "raceKey" || field === "classKey" || field === "avatarSeed") {
        return { ...role, [field]: String(value) };
      }

      return { ...role, [field]: Number(value) };
    }));
  };

  const saveRole = async (role: AdminRoleRecord) => {
    try {
      setSavingKey(role.roleId);
      setError(null);
      const response = await requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles", {
        body: JSON.stringify(role),
        method: "PUT",
      });
      setRoles(response.roles);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存角色失败。");
    } finally {
      setSavingKey(null);
    }
  };

  const startEditAccount = (account: AdminAccountRecord) => {
    setAccountDraft({
      accountType: account.accountType,
      guestToken: account.guestToken,
      password: "",
      userId: account.userId,
      username: account.username ?? "",
    });
  };

  const resetAccountDraft = () => {
    setAccountDraft({
      accountType: "guest",
      guestToken: "",
      password: "",
      username: "",
    });
  };

  const saveAccount = async () => {
    try {
      setSavingKey(accountDraft.userId ?? "account-create");
      setError(null);

      const body = {
        accountType: accountDraft.accountType,
        guestToken: accountDraft.guestToken.trim() || undefined,
        password: accountDraft.password.trim() || undefined,
        ...(accountDraft.accountType === "account" ? { username: accountDraft.username.trim() } : { username: null }),
        ...(accountDraft.userId ? { userId: accountDraft.userId } : {}),
      };

      const response = await requestJson<{ accounts: AdminAccountRecord[] }>(
        "/api/admin/accounts",
        {
          body: JSON.stringify(body),
          method: accountDraft.userId ? "PUT" : "POST",
        },
      );

      setAccounts(response.accounts);
      resetAccountDraft();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存账号失败。");
    } finally {
      setSavingKey(null);
    }
  };

  const removeAccount = async (userId: string) => {
    try {
      setSavingKey(`account-delete-${userId}`);
      setError(null);

      const response = await requestJson<{ accounts: AdminAccountRecord[] }>(
        "/api/admin/accounts",
        {
          body: JSON.stringify({ userId }),
          method: "DELETE",
        },
      );

      setAccounts(response.accounts);

      if (accountDraft.userId === userId) {
        resetAccountDraft();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除账号失败。");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen bg-slate-50 text-slate-600">
        <div className="m-auto">
          正在加载管理后台...
        </div>
      </main>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorText: "#334155",
          colorTextHeading: "#1e293b",
          colorTextPlaceholder: "#94a3b8",
          colorTextSecondary: "#64748b",
        },
      }}
    >
      <main className="admin-console-antd min-h-screen bg-slate-50 text-slate-700 lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[232px_minmax(0,1fr)]">
        {isSidebarOpen ? (
          <button
            aria-label="关闭菜单"
            className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[min(84vw,232px)] flex-col overflow-y-auto scrollbar-none border-r border-slate-200 bg-white text-slate-800 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-lg font-semibold text-cyan-700">
                GM
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">业务管理后台</p>
                <p className="mt-1 text-xs text-slate-500">Road To Top Console</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-2 py-3">
            <p className="px-3 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              导航菜单
            </p>
            <div className="mt-3 space-y-1">
              {SIDEBAR_SECTIONS.map((section) => {
                const isActive = activeSection === section.key;

                return (
                  <button
                    key={section.key}
                    className={`flex w-full items-start rounded-xl px-3 py-3 text-left transition ${isActive
                      ? "bg-[#1677ff] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    onClick={() => setActiveSection(section.key)}
                    type="button"
                  >
                    <div>
                      <div className="text-sm font-medium">{section.label}</div>
                      <div className={`mt-1 text-xs ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                        {section.hint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500" />
        </aside>

        <section className="flex min-w-0 flex-col lg:min-h-0">
          <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                  type="button"
                >
                  菜单
                </button>
                <div>
                  <h1 className="text-xl font-semibold tracking-[-0.02em] text-slate-900">
                    {SIDEBAR_SECTIONS.find((item) => item.key === activeSection)?.label ?? "管理后台"}
                  </h1>
                </div>
              </div>

              <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <button
                  className="w-full rounded-xl bg-[#1677ff] px-4 py-2.5 text-sm font-medium text-white shadow-[0_6px_14px_rgba(22,119,255,0.2)] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  disabled={savingKey === "config"}
                  onClick={() => {
                    void saveConfig();
                  }}
                  type="button"
                >
                  {savingKey === "config" ? "保存中..." : "发布当前配置"}
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-3 md:px-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain scrollbar-none">
            <div className="space-y-4 pb-5">
              {error ? (
                <div className="rounded-xl border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">账号 {formatNumber(metrics.accountCount)}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">角色 {formatNumber(roles.length)}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">种族/职业 {metrics.raceCount}/{metrics.classCount}</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">物品/事件 {formatNumber(metrics.itemCount)}/{formatNumber(metrics.encounterCount)}</span>
                </div>
              </section>

              {activeSection === "accounts" ? (
                <MobileAdminCollapse
                  summary="账号表单、搜索与账号列表"
                  title="账号增删改查"
                >
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">账号管理</p>
                          <h2 className="mt-2 text-xl font-semibold text-slate-900">账号增删改查</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Input
                            className="w-full md:w-72"
                            onChange={(event) => setAccountKeyword(event.target.value)}
                            placeholder="搜索账号 / token / 角色"
                            size="large"
                            value={accountKeyword}
                          />
                          <button
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                            onClick={() => {
                              setAccountKeyword("");
                              resetAccountDraft();
                            }}
                            type="button"
                          >
                            重置
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 2xl:grid-cols-[340px_minmax(0,1fr)]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">账号表单</p>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">
                          {accountDraft.userId ? "编辑账号" : "新增账号"}
                        </h3>
                        <div className="mt-4 space-y-4">
                          <label className="block">
                            <span className="mb-2 block text-sm text-slate-600">账号类型</span>
                            <Segmented
                              block
                              onChange={(value) => setAccountDraft((current) => ({
                                ...current,
                                accountType: value as AdminAccountDraft["accountType"],
                              }))}
                              options={accountTypeOptions as unknown as Array<{ label: string; value: string }>}
                              size="large"
                              value={accountDraft.accountType}
                            />
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-sm text-slate-600">游客 Token</span>
                            <Input
                              onChange={(event) => setAccountDraft((current) => ({ ...current, guestToken: event.target.value }))}
                              placeholder="为空则自动生成"
                              size="large"
                              value={accountDraft.guestToken}
                            />
                          </label>

                          {accountDraft.accountType === "account" ? (
                            <>
                              <label className="block">
                                <span className="mb-2 block text-sm text-slate-600">账号名</span>
                                <Input
                                  onChange={(event) => setAccountDraft((current) => ({ ...current, username: event.target.value }))}
                                  placeholder="4-20 位字母 / 数字 / 下划线"
                                  size="large"
                                  value={accountDraft.username}
                                />
                              </label>

                              <label className="block">
                                <span className="mb-2 block text-sm text-slate-600">
                                  {accountDraft.userId ? "重置密码" : "初始密码"}
                                </span>
                                <Input.Password
                                  onChange={(event) => setAccountDraft((current) => ({ ...current, password: event.target.value }))}
                                  placeholder={accountDraft.userId ? "留空则不修改" : "请输入密码"}
                                  size="large"
                                  value={accountDraft.password}
                                />
                              </label>
                            </>
                          ) : null}

                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                              className="rounded-xl bg-[#1677ff] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:opacity-50"
                              disabled={savingKey === "account-create" || savingKey === accountDraft.userId}
                              onClick={() => {
                                void saveAccount();
                              }}
                              type="button"
                            >
                              {savingKey === "account-create" || savingKey === accountDraft.userId ? "保存中..." : accountDraft.userId ? "更新账号" : "创建账号"}
                            </button>
                            <button
                              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-white"
                              onClick={resetAccountDraft}
                              type="button"
                            >
                              清空表单
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-[1100px] table-fixed text-sm">
                          <colgroup>
                            <col style={{ width: 210 }} />
                            <col style={{ width: 220 }} />
                            <col style={{ width: 120 }} />
                            <col style={{ width: 86 }} />
                            <col style={{ width: 120 }} />
                            <col style={{ width: 120 }} />
                            <col style={{ width: 120 }} />
                            <col style={{ width: 160 }} />
                          </colgroup>
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">账号</th>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">游客 Token</th>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">角色</th>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">密码</th>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">创建时间</th>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">最近登录</th>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">最近在线</th>
                              <th className="w-[152px] whitespace-nowrap px-4 py-3 text-left font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAccounts.map((account, index) => (
                              <tr
                                key={account.userId}
                                className={index % 2 === 0 ? "bg-white" : "bg-slate-50/55"}
                              >
                                <td className="px-4 py-3 align-top">
                                  <div className="truncate font-medium text-slate-900" title={account.username ?? "guest"}>
                                    {account.username ?? "guest"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">{account.accountType}</div>
                                  <div className="mt-1 truncate text-xs text-slate-500" title={account.userId}>
                                    {account.userId}
                                  </div>
                                </td>
                                <td className="truncate px-4 py-3 text-slate-600" title={account.guestToken}>{account.guestToken}</td>
                                <td className="truncate px-4 py-3 text-slate-600" title={account.roleName ?? "-"}>{account.roleName ?? "-"}</td>
                                <td className="px-4 py-3 text-slate-600">{account.hasPassword ? "已设置" : "-"}</td>
                                <td className="px-4 py-3 text-slate-500">{formatDateTime(account.createdAt)}</td>
                                <td className="px-4 py-3 text-slate-500">{formatDateTime(account.lastLoginAt)}</td>
                                <td className="px-4 py-3 text-slate-500">{formatDateTime(account.lastSeenAt)}</td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <div className="flex flex-nowrap gap-2">
                                    <button
                                      className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                      onClick={() => startEditAccount(account)}
                                      type="button"
                                    >
                                      编辑
                                    </button>
                                    <button
                                      className="whitespace-nowrap rounded-lg border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-300/30"
                                      onClick={() => setAccountDeleteTarget(account)}
                                      type="button"
                                    >
                                      删除
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>
                </MobileAdminCollapse>
              ) : null}

              {activeSection === "roles" ? (
                <div className="space-y-5">
                  <MobileAdminCollapse
                    summary="角色搜索、数值编辑与保存"
                    title="角色数据维护"
                  >
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">角色列表</p>
                            <h2 className="mt-2 text-xl font-semibold text-slate-900">角色数据维护</h2>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <Input
                              className="w-full md:w-72"
                              onChange={(event) => setRoleKeyword(event.target.value)}
                              placeholder="搜索角色名 / 账号 / 种族 / 职业"
                              size="large"
                              value={roleKeyword}
                            />
                            <button
                              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                              onClick={() => setRoleKeyword("")}
                              type="button"
                            >
                              重置
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <table className="min-w-[1760px] table-fixed text-sm">
                          <colgroup>
                            <col style={{ width: 220 }} />
                            {ROLE_COLUMNS.map((column) => (
                              <col key={`role-col-${column}`} style={{ width: ROLE_COLUMN_WIDTHS[column] }} />
                            ))}
                            <col style={{ width: 140 }} />
                            <col style={{ width: 120 }} />
                          </colgroup>
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">账号</th>
                              {ROLE_COLUMNS.map((column) => (
                                <th key={column} className="whitespace-nowrap px-3 py-3 text-left font-medium">
                                  {column}
                                </th>
                              ))}
                              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">最近更新时间</th>
                              <th className="w-[120px] whitespace-nowrap px-4 py-3 text-left font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRoles.map((role, index) => (
                              <tr
                                key={role.roleId}
                                className={index % 2 === 0 ? "bg-white" : "bg-slate-50/55"}
                              >
                                <td className="px-4 py-3 align-top">
                                  <div className="truncate font-medium text-slate-900" title={role.username ?? "guest"}>
                                    {role.username ?? "guest"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">{role.accountType}</div>
                                </td>
                                {ROLE_COLUMNS.map((column) => (
                                  <td key={column} className="px-3 py-3">
                                    <div>
                                      {isRoleTextColumn(column) ? (
                                        <Input
                                          className="w-28"
                                          onChange={(event) => updateRoleField(role.roleId, column, event.target.value)}
                                          size="small"
                                          value={String(role[column] ?? "")}
                                        />
                                      ) : (
                                        <InputNumber
                                          className="w-28"
                                          controls
                                          onChange={(value) => updateRoleField(role.roleId, column, typeof value === "number" ? value : 0)}
                                          value={typeof role[column] === "number" ? role[column] : 0}
                                        />
                                      )}
                                      {column === "raceKey" ? (
                                        <div
                                          className="mt-1 truncate text-[11px] text-slate-400"
                                          title={formatDisplayNameInline(role.raceKey, displayNameLookups.raceLabelsByKey) ?? role.raceKey}
                                        >
                                          {formatDisplayNameInline(role.raceKey, displayNameLookups.raceLabelsByKey) ?? role.raceKey}
                                        </div>
                                      ) : null}
                                      {column === "classKey" ? (
                                        <div
                                          className="mt-1 truncate text-[11px] text-slate-400"
                                          title={formatDisplayNameInline(role.classKey, displayNameLookups.classLabelsByKey) ?? role.classKey}
                                        >
                                          {formatDisplayNameInline(role.classKey, displayNameLookups.classLabelsByKey) ?? role.classKey}
                                        </div>
                                      ) : null}
                                    </div>
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-slate-500">
                                  {formatDateTime(role.updatedAt)}
                                </td>
                                <td className="w-[120px] whitespace-nowrap px-4 py-3">
                                  <button
                                    className="whitespace-nowrap rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-300/30 disabled:opacity-50"
                                    disabled={savingKey === role.roleId}
                                    onClick={() => {
                                      void saveRole(role);
                                    }}
                                    type="button"
                                  >
                                    {savingKey === role.roleId ? "保存中" : "保存"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </MobileAdminCollapse>
                </div>
              ) : null}

              {activeSection === "configWorkbench" || activeSection === "system" ? (
                <MobileAdminCollapse
                  className="space-y-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                  contentClassName="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
                  summary={`当前编辑 ${selectedConfig.label}`}
                  title="配置工作台"
                >
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)] xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                            配置工作台
                          </p>
                          <h2 className="mt-2 text-xl font-semibold text-slate-900">
                            {SIDEBAR_SECTIONS.find((item) => item.key === activeSection)?.label}
                          </h2>
                        </div>
                        <div className="space-y-3">
                          {configTabGroups.map(({ group, tabs }) => (
                            <div key={group} className="flex flex-wrap items-center gap-2">
                              <span className="mr-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                                {group}
                              </span>
                              {tabs.map((tab) => {
                                const isActive = selectedConfigKey === tab.key;
                                const hasError = (configFieldErrors[tab.key] ?? []).length > 0;

                                return (
                                  <button
                                    key={tab.key}
                                    className={`rounded-lg px-4 py-2 text-sm transition ${isActive
                                      ? hasError
                                        ? "bg-rose-600 text-white"
                                        : "bg-[#1677ff] text-white"
                                      : hasError
                                        ? "border border-rose-300/50 bg-rose-50 text-rose-700 hover:bg-rose-300/30"
                                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                      }`}
                                    onClick={() => setSelectedConfigKey(tab.key)}
                                    type="button"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <span>{tab.label}</span>
                                      {hasError ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>
                                          {configFieldErrors[tab.key]?.length}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 p-4 2xl:grid-cols-[220px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          当前编辑项
                        </p>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">{selectedConfig.label}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{selectedConfig.description}</p>

                      </div>

                      <div className="min-w-0 space-y-4 xl:min-h-0">
                        {selectedConfigParseResult.error ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                            <p className="text-sm leading-6 text-amber-700">
                              JSON 解析失败：{selectedConfigParseResult.error}
                            </p>
                          </div>
                        ) : null}

                        {(configFieldErrors[selectedConfig.key] ?? []).length > 0 ? (
                          <div className="mb-4 rounded-2xl border border-rose-300/50 bg-rose-50 px-4 py-4">
                            <ul className="mt-3 space-y-2 text-sm leading-6 text-rose-700">
                              {(configFieldErrors[selectedConfig.key] ?? []).map((message) => (
                                <li key={message}>{message}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-slate-200 bg-white xl:flex xl:min-h-0 xl:flex-col">
                          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">编辑器</p>
                              <h4 className="mt-2 text-base font-semibold text-slate-900">
                                {editorMode === "structured" && hasStructuredEditor ? "结构化编辑" : "原始 JSON"}
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {hasStructuredEditor ? (
                                <button
                                  className={`rounded-lg px-4 py-2 text-sm transition ${editorMode === "structured"
                                    ? "bg-[#1677ff] text-white"
                                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                  onClick={() => setEditorMode("structured")}
                                  type="button"
                                >
                                  结构化编辑
                                </button>
                              ) : null}
                              <button
                                className={`rounded-lg px-4 py-2 text-sm transition ${editorMode === "raw"
                                  ? "bg-[#1677ff] text-white"
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                onClick={() => setEditorMode("raw")}
                                type="button"
                              >
                                原始 JSON
                              </button>
                            </div>
                          </div>

                          {editorMode === "structured" && !selectedConfigParseResult.error && selectedArrayItems ? (
                            <div className="grid items-start gap-4 p-4 2xl:grid-cols-[180px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                              <div className="flex max-h-[62vh] min-h-0 self-start flex-col rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-2 pb-3">
                                  <p className="text-sm font-medium text-slate-900">条目列表</p>
                                  <button
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                                    onClick={addStructuredArrayItem}
                                    type="button"
                                  >
                                    新增
                                  </button>
                                </div>
                                <div className="mt-3 min-h-0 flex-1 overflow-y-auto scrollbar-none px-1 pr-1">
                                  {selectedArrayItems.length === 0 ? (
                                    <div className="px-3 py-4 text-sm text-slate-500">暂无条目</div>
                                  ) : (
                                    <div className="space-y-2">
                                      {selectedArrayItems.map((item, index) => {
                                        const isActive = index === selectedArrayItemIndex;
                                        const subtitle = getArrayItemSubtitle(selectedConfig.key, item, displayNameLookups) || "点击编辑";
                                        const title = getArrayItemTitle(selectedConfig.key, item, index, displayNameLookups);

                                        return (
                                          <button
                                            key={`${selectedConfig.key}-${index}-${title}`}
                                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${isActive
                                              ? "border-[#1677ff] bg-cyan-500/8"
                                              : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                                              }`}
                                            onClick={() => {
                                              setSelectedArrayItemIndexes((current) => ({
                                                ...current,
                                                [selectedConfig.key]: index,
                                              }));
                                            }}
                                            type="button"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-slate-100 px-1.5 text-[11px] text-slate-600">
                                                {index + 1}
                                              </span>
                                              <span className="truncate text-sm font-medium text-slate-900" title={title}>
                                                {title}
                                              </span>
                                            </div>
                                            <div className="mt-1 truncate text-[11px] text-slate-500" title={subtitle}>
                                              {subtitle}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">当前条目</p>
                                    <h4 className="mt-2 text-base font-semibold text-slate-900">
                                      {selectedArrayItem === null
                                        ? "尚未选择"
                                        : getArrayItemTitle(selectedConfig.key, selectedArrayItem, selectedArrayItemIndex, displayNameLookups)}
                                    </h4>
                                  </div>
                                  {selectedArrayItem !== null ? (
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                                        onClick={resetSelectedItemEditor}
                                        type="button"
                                      >
                                        重置当前项
                                      </button>
                                      <button
                                        className="rounded-xl border border-rose-300/50 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-300/30"
                                        onClick={() => removeStructuredArrayItem(selectedArrayItemIndex)}
                                        type="button"
                                      >
                                        删除当前项
                                      </button>
                                      <button
                                        className="rounded-xl bg-[#1677ff] px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-400"
                                        onClick={applySelectedItemEditor}
                                        type="button"
                                      >
                                        应用到列表
                                      </button>
                                    </div>
                                  ) : null}
                                </div>

                                {selectedArrayItem !== null ? (
                                  <div className="mb-4 mt-4 space-y-4">
                                    {(selectedConfig.key === "raceConfigs" || selectedConfig.key === "classConfigs") && selectedStructuredItem ? (
                                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">快速配置</p>
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">key</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("key", event.target.value)}
                                              size="large"
                                              value={typeof selectedStructuredItem.key === "string"
                                                ? selectedStructuredItem.key
                                                : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">名称</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("label", event.target.value)}
                                              size="large"
                                              value={typeof selectedStructuredItem.label === "string"
                                                ? selectedStructuredItem.label
                                                : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">图标 key（可空）</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("iconKey", event.target.value || null)}
                                              size="large"
                                              value={typeof selectedStructuredItem.iconKey === "string"
                                                ? selectedStructuredItem.iconKey
                                                : ""}
                                            />
                                          </label>
                                          {selectedConfig.key === "classConfigs" ? (
                                            <label className="block">
                                              <span className="mb-2 block text-sm text-slate-600">开局装备 starterItemId</span>
                                              <Select
                                                allowClear
                                                className="w-full"
                                                onChange={(value) => patchSelectedItemField("starterItemId", value ?? "")}
                                                options={itemSelectDropdownOptions}
                                                placeholder="选择开局装备"
                                                showSearch
                                                value={typeof selectedStructuredItem.starterItemId === "string"
                                                  ? selectedStructuredItem.starterItemId
                                                  : ""}
                                              />
                                            </label>
                                          ) : null}
                                          <label className="block md:col-span-2">
                                            <span className="mb-2 block text-sm text-slate-600">描述</span>
                                            <Input.TextArea
                                              autoSize={{ minRows: 2, maxRows: 5 }}
                                              onChange={(event) => patchSelectedItemField("summary", event.target.value)}
                                              value={typeof selectedStructuredItem.summary === "string"
                                                ? selectedStructuredItem.summary
                                                : ""}
                                            />
                                          </label>
                                        </div>
                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                          <p className="mb-2 text-sm font-medium text-slate-800">四维属性</p>
                                          <div className="grid gap-3 md:grid-cols-4">
                                            {STAT_FIELDS.map((stat) => {
                                              return (
                                                <label key={stat.key} className="block">
                                                  <span className="mb-1 block text-xs text-slate-600">{stat.label}</span>
                                                    <InputNumber
                                                      className="w-full"
                                                      onChange={(value) => patchSelectedItemStatsField(stat.key, typeof value === "number" ? value : 0)}
                                                      step={1}
                                                      value={asNumberOrDefault(selectedStructuredStats[stat.key], 0)}
                                                    />
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        {selectedConfig.key === "raceConfigs" ? (
                                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="mb-2 text-sm font-medium text-slate-800">身体槽位修正</p>
                                            <div className="grid gap-3 md:grid-cols-2">
                                              {bodySlotTypeOptions.map((slot) => {
                                                const baseCapacity = bodySlotBaseCapacities[slot.value];
                                                return (
                                                  <label key={slot.value} className="block">
                                                    <span className="mb-1 block text-xs text-slate-600">
                                                      {slot.label}
                                                      {typeof baseCapacity === "number" ? ` · 标准槽位 ${baseCapacity}` : ""}
                                                    </span>
                                                    <InputNumber
                                                      className="w-full"
                                                      onChange={(value) => patchSelectedItemBodySlotAdjustment(slot.value, typeof value === "number" ? value : 0)}
                                                      min={0}
                                                      step={1}
                                                      value={asNumberOrDefault(selectedStructuredBodySlotAdjustments[slot.value], 0)}
                                                    />
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {selectedConfig.key === "mapConfigs" && selectedStructuredItem ? (
                                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">快速配置</p>
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">key</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("key", event.target.value)}
                                              size="large"
                                              value={typeof selectedStructuredItem.key === "string" ? selectedStructuredItem.key : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">名称</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("label", event.target.value)}
                                              size="large"
                                              value={typeof selectedStructuredItem.label === "string" ? selectedStructuredItem.label : ""}
                                            />
                                          </label>
                                          <label className="block md:col-span-2">
                                            <span className="mb-2 block text-sm text-slate-600">描述</span>
                                            <Input.TextArea
                                              autoSize={{ minRows: 2, maxRows: 5 }}
                                              onChange={(event) => patchSelectedItemField("summary", event.target.value)}
                                              value={typeof selectedStructuredItem.summary === "string" ? selectedStructuredItem.summary : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">金币/分钟</span>
                                            <InputNumber
                                              className="w-full"
                                              onChange={(value) => patchSelectedItemField("goldPerMinute", typeof value === "number" ? value : 0)}
                                              step={1}
                                              value={typeof selectedStructuredItem.goldPerMinute === "number" ? selectedStructuredItem.goldPerMinute : 0}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">经验/分钟</span>
                                            <InputNumber
                                              className="w-full"
                                              onChange={(value) => patchSelectedItemField("expPerMinute", typeof value === "number" ? value : 0)}
                                              step={1}
                                              value={typeof selectedStructuredItem.expPerMinute === "number" ? selectedStructuredItem.expPerMinute : 0}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">以太/分钟</span>
                                            <InputNumber
                                              className="w-full"
                                              onChange={(value) => patchSelectedItemField("aetherPerMinute", typeof value === "number" ? value : 0)}
                                              step={1}
                                              value={typeof selectedStructuredItem.aetherPerMinute === "number" ? selectedStructuredItem.aetherPerMinute : 0}
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    ) : null}

                                    {selectedConfig.key === "itemCatalog" && selectedStructuredItem ? (
                                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">快速配置</p>
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">itemId</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("itemId", event.target.value)}
                                              size="large"
                                              value={typeof selectedStructuredItem.itemId === "string" ? selectedStructuredItem.itemId : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">名称</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("name", event.target.value)}
                                              size="large"
                                              value={typeof selectedStructuredItem.name === "string" ? selectedStructuredItem.name : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">稀有度</span>
                                            <Select
                                              className="w-full"
                                              onChange={(value) => patchSelectedItemField("rarity", value)}
                                              options={ITEM_RARITY_OPTIONS}
                                              value={typeof selectedStructuredItem.rarity === "string" ? selectedStructuredItem.rarity : "white"}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">类型</span>
                                            <Select
                                              className="w-full"
                                              onChange={(value) => patchSelectedItemField("itemType", value)}
                                              options={ITEM_TYPE_OPTIONS}
                                              value={typeof selectedStructuredItem.itemType === "string" ? selectedStructuredItem.itemType : "equipment"}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">装备槽位</span>
                                            <Select
                                              className="w-full"
                                              onChange={(value) => patchSelectedItemField("slot", value)}
                                              options={bodySlotTypeOptions}
                                              value={typeof selectedStructuredItem.slot === "string" ? selectedStructuredItem.slot : "hand"}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">槽位占用</span>
                                            <InputNumber
                                              className="w-full"
                                              min={1}
                                              onChange={(value) => patchSelectedItemField("slotUsage", typeof value === "number" ? value : 1)}
                                              step={1}
                                              value={typeof selectedStructuredItem.slotUsage === "number" ? selectedStructuredItem.slotUsage : 1}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">技能 key（可空）</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("skillKey", event.target.value || null)}
                                              size="large"
                                              value={typeof selectedStructuredItem.skillKey === "string" ? selectedStructuredItem.skillKey : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">图标 key（可空）</span>
                                            <Input
                                              onChange={(event) => patchSelectedItemField("iconKey", event.target.value || null)}
                                              size="large"
                                              value={typeof selectedStructuredItem.iconKey === "string" ? selectedStructuredItem.iconKey : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">售价</span>
                                            <InputNumber
                                              className="w-full"
                                              min={0}
                                              onChange={(value) => patchSelectedItemField("sellPrice", typeof value === "number" ? value : 0)}
                                              step={1}
                                              value={typeof selectedStructuredItem.sellPrice === "number" ? selectedStructuredItem.sellPrice : 0}
                                            />
                                          </label>
                                          <label className="block md:col-span-2">
                                            <span className="mb-2 block text-sm text-slate-600">描述</span>
                                            <Input.TextArea
                                              autoSize={{ minRows: 2, maxRows: 5 }}
                                              onChange={(event) => patchSelectedItemField("description", event.target.value)}
                                              value={typeof selectedStructuredItem.description === "string" ? selectedStructuredItem.description : ""}
                                            />
                                          </label>
                                        </div>
                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                          <p className="mb-2 text-sm font-medium text-slate-800">属性加成</p>
                                          <div className="grid gap-3 md:grid-cols-4">
                                            {STAT_FIELDS.map((stat) => {
                                              return (
                                                <label key={stat.key} className="block">
                                                  <span className="mb-1 block text-xs text-slate-600">{stat.label}</span>
                                                  <InputNumber
                                                    className="w-full"
                                                    onChange={(value) => patchSelectedItemStatsField(stat.key, typeof value === "number" ? value : 0)}
                                                    step={1}
                                                    value={asNumberOrDefault(selectedStructuredStats[stat.key], 0)}
                                                  />
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}

                                    {selectedConfig.key === "eventRules" && selectedEventRule ? (
                                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">快速配置</p>
                                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">规则 key</span>
                                            <Input
                                              onChange={(event) => patchEventRule({ key: event.target.value })}
                                              size="large"
                                              value={typeof selectedEventRule.key === "string" ? selectedEventRule.key : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">规则名称</span>
                                            <Input
                                              onChange={(event) => patchEventRule({ name: event.target.value })}
                                              size="large"
                                              value={typeof selectedEventRule.name === "string" ? selectedEventRule.name : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">是否启用</span>
                                            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4">
                                              <Switch
                                                checked={selectedEventRule.enabled !== false}
                                                checkedChildren="启用"
                                                onChange={(checked) => patchEventRule({ enabled: checked })}
                                                unCheckedChildren="停用"
                                              />
                                            </div>
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">规则概率 chance</span>
                                            <InputNumber
                                              className="w-full"
                                              max={1}
                                              min={0}
                                              onChange={(value) => patchEventRule({ chance: typeof value === "number" ? value : 0 })}
                                              step={0.01}
                                              value={typeof selectedEventRule.chance === "number" ? selectedEventRule.chance : 1}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">优先级 priority</span>
                                            <InputNumber
                                              className="w-full"
                                              onChange={(value) => patchEventRule({ priority: typeof value === "number" ? value : 0 })}
                                              step={1}
                                              value={typeof selectedEventRule.priority === "number" ? selectedEventRule.priority : 100}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">触发类型</span>
                                            <Select
                                              className="w-full"
                                              onChange={(value) => patchEventRuleTrigger({ type: value })}
                                              options={eventTriggerTypeOptions}
                                              value={isRecord(selectedEventRule.trigger) && typeof selectedEventRule.trigger.type === "string" ? selectedEventRule.trigger.type : "afk_tick"}
                                            />
                                          </label>
                                          <div className="block md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="mb-2 text-sm text-slate-700">触发地图（多选）</p>
                                            <Select
                                              allowClear
                                              className="w-full"
                                              mode="multiple"
                                              onChange={(values) => patchEventRuleTrigger({ mapKeys: values })}
                                              options={mapSelectOptions}
                                              placeholder="选择触发地图（可多选）"
                                              showSearch
                                              value={isRecord(selectedEventRule.trigger) && Array.isArray(selectedEventRule.trigger.mapKeys)
                                                ? selectedEventRule.trigger.mapKeys.map((entry) => String(entry))
                                                : []}
                                            />
                                          </div>
                                          <div className="block md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="mb-2 text-sm text-slate-700">触发怪物（多选）</p>
                                            <Select
                                              allowClear
                                              className="w-full"
                                              mode="multiple"
                                              onChange={(values) => patchEventRuleTrigger({ enemyKeys: values })}
                                              options={enemySelectOptions}
                                              placeholder="选择触发怪物（可多选）"
                                              showSearch
                                              value={isRecord(selectedEventRule.trigger) && Array.isArray(selectedEventRule.trigger.enemyKeys)
                                                ? selectedEventRule.trigger.enemyKeys.map((entry) => String(entry))
                                                : []}
                                            />
                                          </div>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">事件标题（可空）</span>
                                            <Input
                                              onChange={(event) => patchEventRule({
                                                encounter: {
                                                  ...(isRecord(selectedEventRule.encounter) ? selectedEventRule.encounter : {}),
                                                  title: event.target.value,
                                                },
                                              })}
                                              size="large"
                                              value={isRecord(selectedEventRule.encounter) && typeof selectedEventRule.encounter.title === "string"
                                                ? selectedEventRule.encounter.title
                                                : ""}
                                            />
                                          </label>
                                          <label className="block md:col-span-2">
                                            <span className="mb-2 block text-sm text-slate-600">事件描述（可空）</span>
                                            <Input.TextArea
                                              autoSize={{ minRows: 3, maxRows: 6 }}
                                              onChange={(event) => patchEventRule({
                                                encounter: {
                                                  ...(isRecord(selectedEventRule.encounter) ? selectedEventRule.encounter : {}),
                                                  description: event.target.value,
                                                },
                                              })}
                                              value={isRecord(selectedEventRule.encounter) && typeof selectedEventRule.encounter.description === "string"
                                                ? selectedEventRule.encounter.description
                                                : ""}
                                            />
                                          </label>
                                          <label className="block">
                                            <span className="mb-2 block text-sm text-slate-600">事件稀有度（可空）</span>
                                            <Select
                                              allowClear
                                              className="w-full"
                                              onChange={(value) => patchEventRule({
                                                encounter: {
                                                  ...(isRecord(selectedEventRule.encounter) ? selectedEventRule.encounter : {}),
                                                  tier: value || undefined,
                                                },
                                              })}
                                              options={eventTierOptions}
                                              placeholder="无"
                                              value={isRecord(selectedEventRule.encounter) && typeof selectedEventRule.encounter.tier === "string"
                                                ? selectedEventRule.encounter.tier
                                                : undefined}
                                            />
                                          </label>
                                        </div>
                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                          <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-slate-800">动作列表 actions</p>
                                            <button
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
                                              onClick={addEventRuleAction}
                                              type="button"
                                            >
                                              新增动作
                                            </button>
                                          </div>
                                          <div className="mt-3 space-y-3">
                                            {(Array.isArray(selectedEventRule.actions) ? selectedEventRule.actions : []).map((action, actionIndex) => {
                                              if (!isRecord(action)) {
                                                return null;
                                              }

                                              const actionType = typeof action.type === "string" ? action.type : "grant_gold";
                                              return (
                                                <div key={`event-action-${actionIndex}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                  <div className="grid gap-2 md:grid-cols-5">
                                                    <label className="block">
                                                      <span className="mb-1 block text-xs text-slate-600">类型</span>
                                                      <Select
                                                        className="w-full"
                                                        onChange={(value) => patchEventRuleActionAt(actionIndex, { type: value })}
                                                        options={actionTypeOptions}
                                                        value={actionType}
                                                      />
                                                    </label>
                                                    <label className="block">
                                                      <span className="mb-1 block text-xs text-slate-600">动作概率</span>
                                                      <InputNumber
                                                        className="w-full"
                                                        max={1}
                                                        min={0}
                                                        onChange={(value) => patchEventRuleActionAt(actionIndex, {
                                                          chance: typeof value === "number" ? value : 0,
                                                        })}
                                                        step={0.01}
                                                        value={typeof action.chance === "number" ? action.chance : 1}
                                                      />
                                                    </label>
                                                    {actionType === "grant_item" ? (
                                                      <>
                                                        <label className="block">
                                                          <span className="mb-1 block text-xs text-slate-600">itemId</span>
                                                          <Select
                                                            allowClear
                                                            className="w-full"
                                                            onChange={(value) => patchEventRuleActionAt(actionIndex, {
                                                              itemId: value ?? undefined,
                                                            })}
                                                            options={itemSelectDropdownOptions}
                                                            placeholder="选择物品（显示中文，实际写入 itemId）"
                                                            showSearch
                                                            value={typeof action.itemId === "string" ? action.itemId : undefined}
                                                          />
                                                        </label>
                                                        <label className="block">
                                                          <span className="mb-1 block text-xs text-slate-600">min/quantity</span>
                                                          <InputNumber
                                                            className="w-full"
                                                            onChange={(value) => patchEventRuleActionAt(actionIndex, {
                                                              min: typeof value === "number" ? value : 1,
                                                            })}
                                                            step={1}
                                                            value={typeof action.min === "number"
                                                              ? action.min
                                                              : typeof action.quantity === "number"
                                                                ? action.quantity
                                                                : 1}
                                                          />
                                                        </label>
                                                        <label className="block">
                                                          <span className="mb-1 block text-xs text-slate-600">max</span>
                                                          <InputNumber
                                                            className="w-full"
                                                            onChange={(value) => patchEventRuleActionAt(actionIndex, {
                                                              max: typeof value === "number" ? value : 1,
                                                            })}
                                                            step={1}
                                                            value={typeof action.max === "number" ? action.max : typeof action.min === "number" ? action.min : 1}
                                                          />
                                                        </label>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <label className="block">
                                                          <span className="mb-1 block text-xs text-slate-600">amount</span>
                                                          <InputNumber
                                                            className="w-full"
                                                            onChange={(value) => patchEventRuleActionAt(actionIndex, {
                                                              amount: typeof value === "number" ? value : 0,
                                                            })}
                                                            step={1}
                                                            value={typeof action.amount === "number" ? action.amount : 0}
                                                          />
                                                        </label>
                                                        <div className="flex items-end justify-end">
                                                          <button
                                                            className="h-10 rounded-lg border border-rose-300/50 bg-rose-50 px-3 text-sm text-rose-700 transition hover:bg-rose-300/30"
                                                            onClick={() => removeEventRuleActionAt(actionIndex)}
                                                            type="button"
                                                          >
                                                            删除动作
                                                          </button>
                                                        </div>
                                                      </>
                                                    )}
                                                  </div>
                                                  {actionType === "grant_item" ? (
                                                    <div className="mt-2 flex justify-end">
                                                      <button
                                                        className="h-10 rounded-lg border border-rose-300/50 bg-rose-50 px-3 text-sm text-rose-700 transition hover:bg-rose-300/30"
                                                        onClick={() => removeEventRuleActionAt(actionIndex)}
                                                        type="button"
                                                      >
                                                        删除动作
                                                      </button>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                {selectedArrayItem !== null ? (
                                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                                    当前为结构化编辑模式。原始 JSON 仅在上方切换到“原始 JSON”标签后显示。
                                  </div>
                                ) : (
                                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                                    请选择条目
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {editorMode === "structured" && !selectedConfigParseResult.error && !selectedArrayItems && selectedObjectEntries ? (
                            <div className="p-4">
                              <div className="grid gap-3 md:grid-cols-2">
                                {selectedObjectEntries.map(([fieldKey, fieldValue]) => (
                                  <label key={fieldKey} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    {selectedConfig.key === "systemBalance" ? (
                                      <>
                                        <span className="block text-sm font-medium text-slate-700">
                                          {SYSTEM_BALANCE_FIELD_LABELS[fieldKey] ?? fieldKey}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-slate-500">{fieldKey}</span>
                                      </>
                                    ) : (
                                      <span className="block text-sm font-medium text-slate-700">{fieldKey}</span>
                                    )}
                                    {typeof fieldValue === "boolean" ? (
                                      <Segmented
                                        block
                                        className="mt-3"
                                        onChange={(value) => updateStructuredObjectField(fieldKey, String(value))}
                                        options={[
                                          { label: "true", value: "true" },
                                          { label: "false", value: "false" },
                                        ]}
                                        size="large"
                                        value={fieldValue ? "true" : "false"}
                                      />
                                    ) : (
                                      typeof fieldValue === "number" ? (
                                        <InputNumber
                                          className="mt-3 w-full"
                                          onChange={(value) => updateStructuredObjectField(fieldKey, value === null ? "" : String(value))}
                                          value={typeof fieldValue === "number" ? fieldValue : 0}
                                        />
                                      ) : (
                                        <Input
                                          className="mt-3"
                                          onChange={(event) => updateStructuredObjectField(fieldKey, event.target.value)}
                                          size="large"
                                          value={String(fieldValue ?? "")}
                                        />
                                      )
                                    )}
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {editorMode === "raw" ? (
                            <textarea
                              className={`block min-h-[620px] w-full overflow-auto scrollbar-none rounded-2xl border bg-white px-4 py-4 font-mono text-[13px] leading-6 text-slate-800 outline-none transition md:min-h-[760px] md:px-5 xl:min-h-0 xl:flex-1 ${(configFieldErrors[selectedConfig.key] ?? []).length > 0
                                ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200/60"
                                : "border-slate-200 focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15"
                                }`}
                              onChange={(event) => {
                                const nextValue = event.target.value;

                                updateConfigDraftValue(selectedConfig.key, nextValue);
                              }}
                              spellCheck={false}
                              value={configDrafts[selectedConfig.key] ?? ""}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>
                </MobileAdminCollapse>
              ) : null}

              {activeSection === "reference" && configPayload?.meta ? (
                <MobileAdminCollapse
                  defaultOpen={false}
                  summary="运行时常量、槽位辅助与默认上下文"
                  title="常量与辅助信息"
                >
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)] xl:flex xl:min-h-0 xl:flex-col">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">运行时参考</p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900">常量与辅助信息</h2>
                    </div>
                    <div className="grid gap-4 p-4 2xl:grid-cols-[280px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" />
                      <pre className="max-h-[620px] overflow-auto scrollbar-none rounded-2xl border border-slate-200 bg-white p-5 text-[13px] leading-6 text-slate-800">
                        {pretty(configPayload.meta)}
                      </pre>
                    </div>
                  </section>
                </MobileAdminCollapse>
              ) : null}
            </div>
          </div>
        </section>
      </div>
      <Modal
        cancelText="取消"
        centered
        confirmLoading={Boolean(accountDeleteTarget && savingKey === `account-delete-${accountDeleteTarget.userId}`)}
        okButtonProps={{ danger: true }}
        okText="确认删除"
        onCancel={() => setAccountDeleteTarget(null)}
        onOk={() => {
          if (!accountDeleteTarget) {
            return;
          }
          void removeAccount(accountDeleteTarget.userId).finally(() => {
            setAccountDeleteTarget(null);
          });
        }}
        open={Boolean(accountDeleteTarget)}
        title="删除确认"
      >
        <p className="text-sm leading-7 text-slate-700">
          账号 <span className="font-medium text-slate-900">{accountDeleteTarget?.username ?? "guest"}</span> 删除后，
          关联角色、背包、挂机状态和市场数据也会一并移除。
        </p>
        <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          此操作不可恢复，请确认后再继续。
        </div>
      </Modal>
      </main>
    </ConfigProvider>
  );
}
