'use client';

import { useEffect, useMemo, useState } from "react";

type AdminConfigResponse = {
  config: {
    afkEncounterChances: Record<string, number>;
    afkEncounterPool: unknown[];
    battleEnemyTemplates: unknown[];
    classConfigs: unknown[];
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

type AdminSectionKey = "accounts" | "roles" | "progression" | "content" | "encounters" | "system" | "reference";
type ConfigEditorKey =
  | "raceConfigs"
  | "classConfigs"
  | "mapConfigs"
  | "itemCatalog"
  | "battleEnemyTemplates"
  | "skillTemplates"
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
  category: Exclude<AdminSectionKey, "roles" | "reference">;
  description: string;
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

const SIDEBAR_SECTIONS: SectionDefinition[] = [
  { key: "accounts", label: "账号管理", hint: "账号 / 密码 / Token" },
  { key: "roles", label: "角色管理", hint: "角色 / 数值 / 职业" },
  { key: "progression", label: "成长体系", hint: "种族 / 职业 / 地图" },
  { key: "content", label: "内容资源", hint: "物品 / 怪物模板" },
  { key: "encounters", label: "挂机事件", hint: "遭遇池 / 概率" },
  { key: "system", label: "系统参数", hint: "战斗 / 市场 / 平衡" },
  { key: "reference", label: "运行时参考", hint: "常量 / 槽位辅助" },
];

const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    key: "raceConfigs",
    category: "progression",
    label: "种族配置",
    description: "定义初始四维、身体槽位修正和角色定位。",
  },
  {
    key: "classConfigs",
    category: "progression",
    label: "职业配置",
    description: "定义职业增益、开局装备和成长方向。",
  },
  {
    key: "mapConfigs",
    category: "progression",
    label: "地图配置",
    description: "定义挂机地图的经验、金币和以太收益。",
  },
  {
    key: "itemCatalog",
    category: "content",
    label: "物品目录",
    description: "定义装备、售价、占用槽位和词条属性。",
  },
  {
    key: "skillTemplates",
    category: "content",
    label: "技能模板",
    description: "定义技能倍率、单轮次数、冷却、技能效果与 buff/debuff 持续回合。",
  },
  {
    key: "battleEnemyTemplates",
    category: "content",
    label: "怪物模板",
    description: "定义怪物风格、技能次数和属性权重。",
  },
  {
    key: "afkEncounterPool",
    category: "encounters",
    label: "挂机遭遇池",
    description: "定义挂机触发的事件、文案、奖励与惩罚。",
  },
  {
    key: "afkEncounterChances",
    category: "encounters",
    label: "遭遇概率",
    description: "定义普通、稀有、传说事件的掉落概率。",
  },
  {
    key: "systemBalance",
    category: "system",
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

const ARRAY_CONFIG_KEYS: ConfigEditorKey[] = [
  "raceConfigs",
  "classConfigs",
  "mapConfigs",
  "itemCatalog",
  "skillTemplates",
  "battleEnemyTemplates",
  "afkEncounterPool",
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

function getArrayItemTitle(configKey: ConfigEditorKey, item: unknown, index: number) {
  if (!isRecord(item)) {
    return `第 ${index + 1} 项`;
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

function getArrayItemSubtitle(configKey: ConfigEditorKey, item: unknown) {
  if (!isRecord(item)) {
    return "未识别条目";
  }

  if (configKey === "itemCatalog") {
    return [item.itemId, item.slot, item.rarity].filter(Boolean).join(" / ");
  }

  if (configKey === "classConfigs") {
    return [item.key, item.starterItemId].filter(Boolean).join(" / ");
  }

  if (configKey === "mapConfigs") {
    return [item.key, item.label].filter(Boolean).join(" / ");
  }

  if (configKey === "afkEncounterPool") {
    return [item.key, item.tier].filter(Boolean).join(" / ");
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
        key: "new-race",
        label: "新种族",
        stats: { agility: 0, intelligence: 0, strength: 0, vitality: 0 },
        summary: "",
      };
    case "classConfigs":
      return {
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

function metricCard(title: string, value: string, detail: string) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-medium tracking-[0.16em] text-slate-400 uppercase">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function MobileAdminCollapse({
  children,
  defaultOpen = true,
  summary,
  title,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  summary: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.04)] lg:hidden"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{summary}</p>
        </div>
        <span className="ml-3 shrink-0 text-xs font-medium text-slate-400">
          {isOpen ? "收起" : "展开"}
        </span>
      </button>

      <div className={`${isOpen ? "block" : "hidden"} lg:block`}>
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

  const visibleConfigTabs = useMemo(
    () => CONFIG_DEFINITIONS.filter((item) => item.category === activeSection),
    [activeSection],
  );
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
    const encounterCount = Array.isArray(configPayload?.config.afkEncounterPool) ? configPayload.config.afkEncounterPool.length : 0;

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

  const updateRoleField = (roleId: string, field: keyof AdminRoleRecord, value: string) => {
    setRoles((current) => current.map((role) => {
      if (role.roleId !== roleId) {
        return role;
      }

      if (field === "name" || field === "raceKey" || field === "classKey" || field === "avatarSeed") {
        return { ...role, [field]: value };
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
      <main className="flex min-h-screen bg-[#f3f6fb] text-slate-600">
        <div className="m-auto">
        正在加载管理后台...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-slate-800 lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        {isSidebarOpen ? (
          <button
            aria-label="关闭菜单"
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[min(84vw,248px)] flex-col overflow-y-auto border-r border-slate-900/10 bg-[linear-gradient(180deg,#0a1a2b_0%,#081421_100%)] text-slate-100 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/20 text-lg font-semibold text-sky-200">
                GM
              </div>
              <div>
                <p className="text-sm font-semibold text-white">业务管理后台</p>
                <p className="mt-1 text-xs text-slate-400">Road To Top Console</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4">
            <p className="px-3 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              导航菜单
            </p>
            <div className="mt-3 space-y-1">
              {SIDEBAR_SECTIONS.map((section) => {
                const isActive = activeSection === section.key;

                return (
                  <button
                    key={section.key}
                    className={`flex w-full items-start rounded-xl px-3 py-3 text-left transition ${
                      isActive
                        ? "bg-sky-500 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                    onClick={() => setActiveSection(section.key)}
                    type="button"
                  >
                    <div>
                      <div className="text-sm font-medium">{section.label}</div>
                      <div className={`mt-1 text-xs ${isActive ? "text-sky-100/80" : "text-slate-500"}`}>
                        {section.hint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-500" />
        </aside>

        <section className="flex min-w-0 flex-col lg:min-h-0">
          <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                  type="button"
                >
                  菜单
                </button>
                <div>
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                    {SIDEBAR_SECTIONS.find((item) => item.key === activeSection)?.label ?? "管理后台"}
                  </h1>
                </div>
              </div>

              <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
                <button
                  className="w-full rounded-xl bg-[#1677ff] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_18px_rgba(22,119,255,0.25)] transition hover:bg-[#0f6de8] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

          <div className="flex-1 px-4 py-5 md:px-6 lg:min-h-0 lg:overflow-y-auto">
            <div className="space-y-5 pb-6">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <MobileAdminCollapse
              summary="账号、角色、成长与内容规模概览"
              title="总览指标"
            >
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metricCard("账号数量", formatNumber(metrics.accountCount), "当前账号总数")}
                {metricCard("角色数量", formatNumber(roles.length), "当前可编辑角色总数")}
                {metricCard("种族 / 职业", `${metrics.raceCount} / ${metrics.classCount}`, "成长体系配置规模")}
                {metricCard("物品 / 事件", `${formatNumber(metrics.itemCount)} / ${formatNumber(metrics.encounterCount)}`, "物品目录与挂机事件规模")}
              </section>
            </MobileAdminCollapse>

            {activeSection === "accounts" ? (
              <MobileAdminCollapse
                summary="账号表单、搜索与账号列表"
                title="账号增删改查"
              >
                <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">账号管理</p>
                        <h2 className="mt-2 text-xl font-semibold text-slate-900">账号增删改查</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10 md:w-72"
                          onChange={(event) => setAccountKeyword(event.target.value)}
                          placeholder="搜索账号 / token / 角色"
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

                  <div className="grid gap-5 p-5 2xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">账号表单</p>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">
                        {accountDraft.userId ? "编辑账号" : "新增账号"}
                      </h3>
                      <div className="mt-4 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-600">账号类型</span>
                          <select
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                            onChange={(event) => setAccountDraft((current) => ({
                              ...current,
                              accountType: event.target.value === "account" ? "account" : "guest",
                            }))}
                            value={accountDraft.accountType}
                          >
                            <option value="guest">guest</option>
                            <option value="account">account</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-600">游客 Token</span>
                          <input
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                            onChange={(event) => setAccountDraft((current) => ({ ...current, guestToken: event.target.value }))}
                            placeholder="为空则自动生成"
                            value={accountDraft.guestToken}
                          />
                        </label>

                        {accountDraft.accountType === "account" ? (
                          <>
                            <label className="block">
                              <span className="mb-2 block text-sm text-slate-600">账号名</span>
                              <input
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                                onChange={(event) => setAccountDraft((current) => ({ ...current, username: event.target.value }))}
                                placeholder="4-20 位字母 / 数字 / 下划线"
                                value={accountDraft.username}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-sm text-slate-600">
                                {accountDraft.userId ? "重置密码" : "初始密码"}
                              </span>
                              <input
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                                onChange={(event) => setAccountDraft((current) => ({ ...current, password: event.target.value }))}
                                placeholder={accountDraft.userId ? "留空则不修改" : "请输入密码"}
                                type="password"
                                value={accountDraft.password}
                              />
                            </label>
                          </>
                        ) : null}

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            className="rounded-xl bg-[#1677ff] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f6de8] disabled:opacity-50"
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

                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-[980px] text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">账号</th>
                            <th className="px-4 py-3 text-left font-medium">游客 Token</th>
                            <th className="px-4 py-3 text-left font-medium">角色</th>
                            <th className="px-4 py-3 text-left font-medium">密码</th>
                            <th className="px-4 py-3 text-left font-medium">创建时间</th>
                            <th className="px-4 py-3 text-left font-medium">最近登录</th>
                            <th className="px-4 py-3 text-left font-medium">最近在线</th>
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
                                <div className="font-medium text-slate-900">{account.username ?? "guest"}</div>
                                <div className="mt-1 text-xs text-slate-500">{account.accountType}</div>
                                <div className="mt-1 text-xs text-slate-400">{account.userId}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{account.guestToken}</td>
                              <td className="px-4 py-3 text-slate-600">{account.roleName ?? "-"}</td>
                              <td className="px-4 py-3 text-slate-600">{account.hasPassword ? "已设置" : "-"}</td>
                              <td className="px-4 py-3 text-slate-500">{formatDateTime(account.createdAt)}</td>
                              <td className="px-4 py-3 text-slate-500">{formatDateTime(account.lastLoginAt)}</td>
                              <td className="px-4 py-3 text-slate-500">{formatDateTime(account.lastSeenAt)}</td>
                              <td className="w-[152px] whitespace-nowrap px-4 py-3">
                                <div className="flex flex-nowrap gap-2">
                                  <button
                                    className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                    onClick={() => startEditAccount(account)}
                                    type="button"
                                  >
                                    编辑
                                  </button>
                                  <button
                                    className="whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-100"
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
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">角色列表</p>
                          <h2 className="mt-2 text-xl font-semibold text-slate-900">角色数据维护</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10 md:w-72"
                            onChange={(event) => setRoleKeyword(event.target.value)}
                            placeholder="搜索角色名 / 账号 / 种族 / 职业"
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

                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="min-w-[1400px] text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">账号</th>
                            {ROLE_COLUMNS.map((column) => (
                              <th key={column} className="px-3 py-3 text-left font-medium">
                                {column}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-left font-medium">最近更新时间</th>
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
                                <div className="font-medium text-slate-900">{role.username ?? "guest"}</div>
                                <div className="mt-1 text-xs text-slate-500">{role.accountType}</div>
                              </td>
                              {ROLE_COLUMNS.map((column) => (
                                <td key={column} className="px-3 py-3">
                                  <input
                                    className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                                    onChange={(event) => updateRoleField(role.roleId, column, event.target.value)}
                                    value={String(role[column] ?? "")}
                                  />
                                </td>
                              ))}
                              <td className="px-4 py-3 text-slate-500">
                                {formatDateTime(role.updatedAt)}
                              </td>
                              <td className="w-[120px] whitespace-nowrap px-4 py-3">
                                <button
                                  className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
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

            {activeSection !== "accounts" && activeSection !== "roles" && activeSection !== "reference" ? (
              <MobileAdminCollapse
                summary={`当前编辑 ${selectedConfig.label}`}
                title="配置工作台"
              >
              <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] xl:flex xl:min-h-0 xl:flex-col">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                        配置工作台
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900">
                        {SIDEBAR_SECTIONS.find((item) => item.key === activeSection)?.label}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visibleConfigTabs.map((tab) => {
                        const isActive = selectedConfigKey === tab.key;
                        const hasError = (configFieldErrors[tab.key] ?? []).length > 0;

                        return (
                          <button
                            key={tab.key}
                            className={`rounded-lg px-4 py-2 text-sm transition ${
                              isActive
                                ? hasError
                                  ? "bg-rose-600 text-white"
                                  : "bg-[#1677ff] text-white"
                                : hasError
                                  ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                            onClick={() => setSelectedConfigKey(tab.key)}
                            type="button"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span>{tab.label}</span>
                              {hasError ? (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-white/16 text-white" : "bg-rose-100 text-rose-700"}`}>
                                  {configFieldErrors[tab.key]?.length}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 p-5 2xl:grid-cols-[240px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
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
                      <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
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
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">编辑器</p>
                          <h4 className="mt-2 text-base font-semibold text-slate-900">
                            {editorMode === "structured" && hasStructuredEditor ? "结构化编辑" : "原始 JSON"}
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {hasStructuredEditor ? (
                            <button
                              className={`rounded-lg px-4 py-2 text-sm transition ${
                                editorMode === "structured"
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
                            className={`rounded-lg px-4 py-2 text-sm transition ${
                              editorMode === "raw"
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
                        <div className="grid gap-4 p-4 2xl:grid-cols-[180px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
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
                            <div className="mt-3 h-[16.5rem] overflow-y-auto px-1">
                              {selectedArrayItems.length === 0 ? (
                                <div className="px-3 py-4 text-sm text-slate-500">暂无条目</div>
                              ) : (
                                <div className="space-y-2">
                                  {selectedArrayItems.map((item, index) => {
                                    const isActive = index === selectedArrayItemIndex;

                                    return (
                                      <button
                                        key={`${selectedConfig.key}-${index}-${getArrayItemTitle(selectedConfig.key, item, index)}`}
                                      className={`min-h-[5rem] w-full rounded-xl border px-3 py-3 text-left transition ${
                                          isActive
                                            ? "border-[#1677ff] bg-[#1677ff]/8"
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
                                        <div className="text-sm font-medium text-slate-900">
                                          {getArrayItemTitle(selectedConfig.key, item, index)}
                                        </div>
                                        <div className="mt-1 text-xs leading-5 text-slate-500">
                                          {getArrayItemSubtitle(selectedConfig.key, item) || `第 ${index + 1} 项`}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:flex xl:min-h-0 xl:flex-col">
                            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">当前条目</p>
                                <h4 className="mt-2 text-base font-semibold text-slate-900">
                                  {selectedArrayItem === null
                                    ? "尚未选择"
                                    : getArrayItemTitle(selectedConfig.key, selectedArrayItem, selectedArrayItemIndex)}
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
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 transition hover:bg-rose-100"
                                    onClick={() => removeStructuredArrayItem(selectedArrayItemIndex)}
                                    type="button"
                                  >
                                    删除当前项
                                  </button>
                                  <button
                                    className="rounded-xl bg-[#1677ff] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0f6de8]"
                                    onClick={applySelectedItemEditor}
                                    type="button"
                                  >
                                    应用到列表
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            {selectedArrayItem !== null ? (
                              <textarea
                                className="mt-4 block min-h-[680px] w-full rounded-2xl border border-slate-200 bg-[#0b1220] px-5 py-4 font-mono text-[13px] leading-6 text-slate-100 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/15 xl:min-h-0 xl:flex-1"
                                onChange={(event) => {
                                  const nextValue = event.target.value;

                                  setItemEditorDrafts((current) => ({
                                    ...current,
                                    [selectedItemEditorKey]: nextValue,
                                  }));
                                }}
                                spellCheck={false}
                                value={selectedItemEditorValue}
                              />
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
                                <span className="block text-sm font-medium text-slate-700">{fieldKey}</span>
                                {typeof fieldValue === "boolean" ? (
                                  <select
                                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                                    onChange={(event) => updateStructuredObjectField(fieldKey, event.target.value)}
                                    value={String(fieldValue)}
                                  >
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                ) : (
                                  <input
                                    className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#1677ff] focus:ring-2 focus:ring-[#1677ff]/10"
                                    onChange={(event) => updateStructuredObjectField(fieldKey, event.target.value)}
                                    type={typeof fieldValue === "number" ? "number" : "text"}
                                    value={String(fieldValue ?? "")}
                                  />
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {editorMode === "raw" ? (
                        <textarea
                          className={`block min-h-[620px] w-full overflow-auto rounded-2xl border bg-[#0b1220] px-4 py-4 font-mono text-[13px] leading-6 text-slate-100 outline-none transition md:min-h-[760px] md:px-5 xl:min-h-0 xl:flex-1 ${
                            (configFieldErrors[selectedConfig.key] ?? []).length > 0
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
              <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] xl:flex xl:min-h-0 xl:flex-col">
                <div className="border-b border-slate-200 px-5 py-4">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">运行时参考</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">常量与辅助信息</h2>
                </div>
                <div className="grid gap-5 p-5 2xl:grid-cols-[320px_minmax(0,1fr)] xl:min-h-0 xl:flex-1">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" />
                  <pre className="max-h-[620px] overflow-auto rounded-2xl border border-slate-200 bg-[#0b1220] p-5 text-[13px] leading-6 text-slate-100">
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
      {accountDeleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose-500">删除确认</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">确定删除这个账号吗？</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              账号 <span className="font-medium text-slate-900">{accountDeleteTarget.username ?? "guest"}</span> 删除后，
              关联角色、背包、挂机状态和市场数据也会一并移除。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                onClick={() => setAccountDeleteTarget(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                disabled={savingKey === `account-delete-${accountDeleteTarget.userId}`}
                onClick={() => {
                  void removeAccount(accountDeleteTarget.userId).finally(() => {
                    setAccountDeleteTarget(null);
                  });
                }}
                type="button"
              >
                {savingKey === `account-delete-${accountDeleteTarget.userId}` ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
