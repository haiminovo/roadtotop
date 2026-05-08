'use client';

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, InputNumber, Select, Space, Spin, Switch, Tabs, Tooltip, message } from "antd";
import type { TabsProps } from "antd";
import { requestJson } from "@/features/admin/components/admin-utils";
import {
  collectEnumReadableEntries,
  CONFIG_LABELS,
  isArrayConfigKey,
  isConfigKey,
  parseJsonSafe,
  pretty,
  type AdminConfigResponse,
  type ConfigEditorKey,
} from "@/features/admin/components/config-admin";

type FieldDoc = {
  hint: string;
  label: string;
};

type FieldOption = {
  label: string;
  value: string;
};

type JsonFieldHint = {
  example: string;
  fields: string[];
};

type StructuredNumericFieldDescriptor = {
  columnsClassName: string;
  fields: Array<{ key: string; label: string }>;
  integer?: boolean;
  min?: number;
  step?: number;
};

const CORE_STAT_FIELDS = [
  { key: "strength", label: "力量" },
  { key: "agility", label: "敏捷" },
  { key: "intelligence", label: "智力" },
  { key: "vitality", label: "体质" },
];

const BODY_SLOT_FIELDS = [
  { key: "head", label: "头部" },
  { key: "hand", label: "手部" },
  { key: "torso", label: "上身" },
  { key: "legs", label: "下身" },
  { key: "feet", label: "脚部" },
  { key: "neck", label: "脖颈" },
  { key: "accessory", label: "饰品" },
];

const SKILL_CAP_FIELDS = [
  { key: "guard", label: "守御上限" },
  { key: "spell", label: "法术上限" },
];

const RARITY_OPTIONS: FieldOption[] = [
  { label: "白装", value: "white" },
  { label: "绿装", value: "green" },
  { label: "蓝装", value: "blue" },
  { label: "紫装", value: "purple" },
  { label: "橙装", value: "orange" },
];

const ITEM_TYPE_OPTIONS: FieldOption[] = [
  { label: "装备", value: "equipment" },
  { label: "技能书", value: "skill_book" },
  { label: "材料", value: "material" },
];

const SLOT_OPTIONS: FieldOption[] = [
  { label: "头部", value: "head" },
  { label: "手部", value: "hand" },
  { label: "上身", value: "torso" },
  { label: "下身", value: "legs" },
  { label: "脚部", value: "feet" },
  { label: "脖颈", value: "neck" },
  { label: "饰品", value: "accessory" },
];

const SKILL_CATEGORY_OPTIONS: FieldOption[] = [
  { label: "战技", value: "attack" },
  { label: "法术", value: "spell" },
  { label: "守御", value: "guard" },
];

const SKILL_SOURCE_OPTIONS: FieldOption[] = [
  { label: "玩家技能", value: "learned" },
  { label: "怪物技能", value: "enemy" },
];

const EVENT_TRIGGER_OPTIONS: FieldOption[] = [
  { label: "挂机触发", value: "afk_tick" },
  { label: "击杀触发", value: "enemy_kill" },
];

const FIELD_DOCS: Partial<Record<ConfigEditorKey, Record<string, FieldDoc>>> = {
  battleEnemyTemplates: {
    fixedSkillKeys: { hint: "固定技能列表，优先于随机技能池。", label: "固定技能" },
    key: { hint: "怪物唯一标识，不能重复。", label: "怪物Key" },
    mapKeys: { hint: "该怪物会出现在哪些地图。", label: "出现地图" },
    name: { hint: "展示给玩家的怪物名称。", label: "怪物名称" },
    skillCaps: { hint: "怪物可携带技能上限，按分类限制。", label: "技能上限" },
    statWeights: { hint: "怪物属性权重，影响战斗属性分配。", label: "属性权重" },
    summary: { hint: "文案描述，方便策划识别。", label: "描述" },
  },
  classConfigs: {
    iconKey: { hint: "职业图标资源 key，可为空。", label: "图标Key" },
    key: { hint: "职业唯一标识，不能重复。", label: "职业Key" },
    label: { hint: "展示给玩家的职业名称。", label: "职业名称" },
    starterItemId: { hint: "角色创建时发放的初始物品 itemId。", label: "初始物品" },
    stats: { hint: "职业基础属性加成。", label: "基础属性" },
    summary: { hint: "职业说明文案。", label: "职业说明" },
  },
  eventRules: {
    actions: { hint: "触发后执行的奖励或效果动作列表。", label: "动作列表" },
    chance: { hint: "该规则整体触发概率，范围 0~1。", label: "触发概率" },
    enabled: { hint: "是否启用该规则。", label: "启用" },
    encounter: { hint: "奇遇展示内容（标题、描述、奖励等）。", label: "奇遇内容" },
    key: { hint: "规则唯一标识，不能重复。", label: "规则Key" },
    name: { hint: "规则名称，方便检索和识别。", label: "规则名称" },
    priority: { hint: "优先级，越大越先判定。", label: "优先级" },
    trigger: { hint: "触发条件（挂机/击杀、地图、怪物等）。", label: "触发条件" },
  },
  itemCatalog: {
    description: { hint: "物品描述文本。", label: "描述" },
    iconKey: { hint: "物品图标资源 key，可为空。", label: "图标Key" },
    itemId: { hint: "物品唯一ID，不能重复。", label: "物品ID" },
    itemType: { hint: "物品类型：装备 / 技能书 / 材料。", label: "物品类型" },
    name: { hint: "物品展示名称。", label: "名称" },
    rarity: { hint: "稀有度，会影响展示和掉落感知。", label: "稀有度" },
    sellPrice: { hint: "出售价格，需 >= 0。", label: "出售价格" },
    skillKey: { hint: "当类型为技能书时，对应技能 key。", label: "技能Key" },
    slot: { hint: "装备槽位（仅装备生效）。", label: "装备槽位" },
    slotUsage: { hint: "占用槽位数，需 >= 1。", label: "槽位占用" },
    stats: { hint: "装备附加属性。", label: "属性加成" },
  },
  mapConfigs: {
    aetherPerMinute: { hint: "挂机每分钟产出的以太。", label: "每分钟以太" },
    expPerMinute: { hint: "挂机每分钟产出的经验。", label: "每分钟经验" },
    goldPerMinute: { hint: "挂机每分钟产出的金币。", label: "每分钟金币" },
    key: { hint: "地图唯一标识，不能重复。", label: "地图Key" },
    label: { hint: "地图展示名。", label: "地图名称" },
    summary: { hint: "地图描述文案。", label: "地图描述" },
  },
  raceConfigs: {
    bodySlotAdjustments: { hint: "种族对各装备槽位容量的修正。", label: "槽位修正" },
    iconKey: { hint: "种族图标资源 key，可为空。", label: "图标Key" },
    key: { hint: "种族唯一标识，不能重复。", label: "种族Key" },
    label: { hint: "种族展示名。", label: "种族名称" },
    stats: { hint: "种族基础属性加成。", label: "基础属性" },
    summary: { hint: "种族说明文案。", label: "种族说明" },
  },
  skillTemplates: {
    acquisitionHint: { hint: "技能获取途径提示。", label: "获取方式" },
    category: { hint: "技能分类：战技 / 法术 / 守御。", label: "技能分类" },
    cooldownTurns: { hint: "技能冷却回合数。", label: "冷却回合" },
    damageMultiplier: { hint: "基础伤害倍率。", label: "伤害倍率" },
    description: { hint: "技能描述。", label: "技能描述" },
    effects: { hint: "附加效果配置（debuff/buff）。", label: "附加效果" },
    guardRatio: { hint: "守御效果比例，通常 0~1。", label: "守御比例" },
    healRatio: { hint: "治疗比例。", label: "治疗比例" },
    iconText: { hint: "技能图标上的文本。", label: "图标文字" },
    key: { hint: "技能唯一标识，不能重复。", label: "技能Key" },
    levelDamageGrowth: { hint: "每级伤害成长。", label: "伤害成长" },
    levelGuardGrowth: { hint: "每级守御成长。", label: "守御成长" },
    levelHealGrowth: { hint: "每级治疗成长。", label: "治疗成长" },
    maxLevel: { hint: "技能最高等级，需 >= 1。", label: "最高等级" },
    maxUses: { hint: "每场可使用次数，0 表示无限制。", label: "使用次数" },
    name: { hint: "技能展示名称。", label: "技能名称" },
    quality: { hint: "技能品质，会影响展示层级。", label: "技能品质" },
    source: { hint: "技能来源：玩家/怪物。", label: "技能来源" },
    trigger: { hint: "触发模式（如 random）。", label: "触发方式" },
  },
  systemBalance: {
    actionBarTarget: { hint: "行动条达标阈值（大于 0）。", label: "行动条阈值" },
    battleTriggerChance: { hint: "挂机触发战斗概率，范围 0~1。", label: "战斗触发概率" },
    enemyGuardCooldownTurns: { hint: "怪物守御冷却回合。", label: "怪物守御冷却" },
    enemyGuardHealthThreshold: { hint: "怪物触发守御的血线阈值，0~1。", label: "怪物守御血线" },
    enemyGuardRatio: { hint: "怪物守御比例，0~1。", label: "怪物守御比例" },
    enemyHealRatio: { hint: "怪物治疗比例，0~1。", label: "怪物治疗比例" },
    executionRewardTickSeconds: { hint: "挂机奖励发放间隔秒数（大于 0）。", label: "奖励间隔秒" },
    intelligenceSpellBonusThreshold: { hint: "智力触发额外法术收益的阈值。", label: "智力阈值" },
    marketFeeRatePercent: { hint: "交易手续费百分比，0~100。", label: "手续费%" },
    playerGuardCooldownTurns: { hint: "玩家守御冷却回合。", label: "玩家守御冷却" },
    playerGuardHealthThreshold: { hint: "玩家触发守御的血线阈值，0~1。", label: "玩家守御血线" },
    playerGuardRatio: { hint: "玩家守御比例，0~1。", label: "玩家守御比例" },
    playerHealRatio: { hint: "玩家治疗比例，0~1。", label: "玩家治疗比例" },
    spellBaseChance: { hint: "法术基础触发概率，0~1。", label: "法术基础概率" },
  },
};

const JSON_FIELD_HINTS: Partial<Record<ConfigEditorKey, Record<string, JsonFieldHint>>> = {
  battleEnemyTemplates: {
    fixedSkillKeys: {
      example: "[\"heavy-strike\", \"iron-skin\"]",
      fields: ["数组元素: skill key（字符串）"],
    },
    mapKeys: {
      example: "[\"palmia-wilds\", \"moonfall-ruins\"]",
      fields: ["数组元素: 地图 key（必须存在于 mapConfigs）"],
    },
    skillCaps: {
      example: "{\n  \"guard\": 1,\n  \"spell\": 2\n}",
      fields: ["guard: number", "spell: number"],
    },
    statWeights: {
      example: "{\n  \"strength\": 1,\n  \"agility\": 1,\n  \"intelligence\": 0.8,\n  \"vitality\": 1.2\n}",
      fields: ["strength: number (>0)", "agility: number (>0)", "intelligence: number (>0)", "vitality: number (>0)"],
    },
  },
  classConfigs: {
    stats: {
      example: "{\n  \"strength\": 2,\n  \"agility\": 1,\n  \"intelligence\": 0,\n  \"vitality\": 1\n}",
      fields: ["strength: number", "agility: number", "intelligence: number", "vitality: number"],
    },
  },
  eventRules: {
    actions: {
      example: "[\n  {\n    \"type\": \"grant_gold\",\n    \"amount\": 100,\n    \"chance\": 1\n  }\n]",
      fields: ["type: grant_gold | grant_aether | grant_exp | adjust_health | grant_item", "chance: number (0~1)", "amount: number（部分 type 使用）", "itemId/quantity/min/max（grant_item 时使用）"],
    },
    encounter: {
      example: "{\n  \"title\": \"遭遇战利品\",\n  \"description\": \"你从怪物身上找到了一袋金币\"\n}",
      fields: ["title: string", "description: string", "reward: object（可选）"],
    },
    trigger: {
      example: "{\n  \"type\": \"enemy_kill\",\n  \"enemyKeys\": [\"slime\"]\n}",
      fields: ["type: afk_tick | enemy_kill", "mapKeys: string[]（可选）", "enemyKeys: string[]（enemy_kill 时常用）"],
    },
  },
  itemCatalog: {
    stats: {
      example: "{\n  \"strength\": 2,\n  \"vitality\": 1\n}",
      fields: ["strength: integer", "agility: integer", "intelligence: integer", "vitality: integer"],
    },
  },
  raceConfigs: {
    bodySlotAdjustments: {
      example: "{\n  \"head\": 0,\n  \"hand\": 1,\n  \"torso\": 0,\n  \"legs\": 0,\n  \"feet\": 0,\n  \"neck\": 0,\n  \"accessory\": 1\n}",
      fields: ["head/hand/torso/legs/feet/neck/accessory: integer"],
    },
    stats: {
      example: "{\n  \"strength\": 1,\n  \"agility\": 0,\n  \"intelligence\": 0,\n  \"vitality\": 2\n}",
      fields: ["strength: number", "agility: number", "intelligence: number", "vitality: number"],
    },
  },
  skillTemplates: {
    effects: {
      example: "[\n  {\n    \"key\": \"bleed\",\n    \"name\": \"流血\",\n    \"durationTurns\": 2,\n    \"magnitude\": 0.15\n  }\n]",
      fields: ["key: string", "name: string", "durationTurns: integer >= 1", "magnitude: number >= 0"],
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getDraftStorageKey(configKey: ConfigEditorKey, draftId: string) {
  return `admin-config-draft:${configKey}:${draftId}`;
}

function getEnumOptions(fieldKey: string): FieldOption[] | null {
  if (fieldKey === "rarity" || fieldKey === "quality") {
    return RARITY_OPTIONS;
  }

  if (fieldKey === "itemType") {
    return ITEM_TYPE_OPTIONS;
  }

  if (fieldKey === "slot") {
    return SLOT_OPTIONS;
  }

  if (fieldKey === "category") {
    return SKILL_CATEGORY_OPTIONS;
  }

  if (fieldKey === "source") {
    return SKILL_SOURCE_OPTIONS;
  }

  if (fieldKey === "type") {
    return EVENT_TRIGGER_OPTIONS;
  }

  return null;
}

function getFieldDoc(configKey: ConfigEditorKey, fieldKey: string): FieldDoc {
  const doc = FIELD_DOCS[configKey]?.[fieldKey];

  if (doc) {
    return doc;
  }

  return {
    hint: "该字段暂无专门说明，可在 JSON 模式查看完整结构。",
    label: fieldKey,
  };
}

function getJsonFieldHint(configKey: ConfigEditorKey, fieldKey: string): JsonFieldHint | null {
  return JSON_FIELD_HINTS[configKey]?.[fieldKey] ?? null;
}

function normalizeStringValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function getStructuredNumericFieldDescriptor(
  configKey: ConfigEditorKey,
  fieldKey: string,
): StructuredNumericFieldDescriptor | null {
  if (
    fieldKey === "stats"
    && (configKey === "itemCatalog" || configKey === "raceConfigs" || configKey === "classConfigs")
  ) {
    return {
      columnsClassName: "grid-cols-2 md:grid-cols-4",
      fields: CORE_STAT_FIELDS,
      integer: true,
      step: 1,
    };
  }

  if (configKey === "battleEnemyTemplates" && fieldKey === "statWeights") {
    return {
      columnsClassName: "grid-cols-2 md:grid-cols-4",
      fields: CORE_STAT_FIELDS,
      min: 0,
      step: 0.1,
    };
  }

  if (configKey === "battleEnemyTemplates" && fieldKey === "skillCaps") {
    return {
      columnsClassName: "grid-cols-1 md:grid-cols-2",
      fields: SKILL_CAP_FIELDS,
      integer: true,
      min: 0,
      step: 1,
    };
  }

  if (configKey === "raceConfigs" && fieldKey === "bodySlotAdjustments") {
    return {
      columnsClassName: "grid-cols-2 md:grid-cols-4",
      fields: BODY_SLOT_FIELDS,
      integer: true,
      step: 1,
    };
  }

  return null;
}

export default function ConfigItemEditorPage() {
  const params = useParams<{ configKey: string; itemKey: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<AdminConfigResponse["config"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftSourceValue, setDraftSourceValue] = useState<unknown | null>(null);
  const [draftSourceReady, setDraftSourceReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "json">("form");
  const [formValue, setFormValue] = useState<unknown>(null);
  const [complexFieldDrafts, setComplexFieldDrafts] = useState<Record<string, string>>({});
  const [advancedJsonFieldEditors, setAdvancedJsonFieldEditors] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const rawConfigKey = decodeURIComponent(params.configKey);
  const itemKey = decodeURIComponent(params.itemKey);
  const indexText = searchParams.get("index");
  const field = searchParams.get("field");
  const createMode = searchParams.get("create") === "1";
  const draftId = searchParams.get("draftId");
  const configKey: ConfigEditorKey | null = isConfigKey(rawConfigKey) ? rawConfigKey : null;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestJson<AdminConfigResponse>("/api/admin/config");
      setConfig(response.config);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载配置失败。");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!configKey || !createMode || !draftId || typeof window === "undefined") {
      setDraftSourceValue(null);
      setDraftSourceReady(!createMode);
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(getDraftStorageKey(configKey, draftId));

      if (!raw) {
        setDraftSourceValue(null);
      } else {
        const parsed = JSON.parse(raw) as unknown;
        setDraftSourceValue(parsed);
      }
    } catch {
      setDraftSourceValue(null);
    } finally {
      setDraftSourceReady(true);
    }
  }, [configKey, createMode, draftId]);

  const currentValue = useMemo(() => {
    if (createMode) {
      return draftSourceValue;
    }

    if (!config || !configKey) {
      return null;
    }

    const source = config[configKey];

    if (isArrayConfigKey(configKey)) {
      if (!Array.isArray(source)) {
        return null;
      }

      const idx = Number(indexText);

      if (!Number.isInteger(idx) || idx < 0 || idx >= source.length) {
        return null;
      }

      return source[idx];
    }

    if (!isRecord(source) || !field) {
      return null;
    }

    return source[field];
  }, [config, configKey, createMode, draftSourceValue, field, indexText]);

  const enumReadableEntries = useMemo(
    () => (currentValue === null ? [] : collectEnumReadableEntries(currentValue)),
    [currentValue],
  );

  useEffect(() => {
    if (currentValue === null) {
      return;
    }

    const nextFormValue = cloneValue(currentValue);
    setFormValue(nextFormValue);
    setDraft(pretty(nextFormValue));

    if (isRecord(nextFormValue)) {
      const nextComplexDrafts: Record<string, string> = {};
      Object.entries(nextFormValue).forEach(([key, value]) => {
        if (Array.isArray(value) || isRecord(value)) {
          nextComplexDrafts[key] = pretty(value);
        }
      });
      setComplexFieldDrafts(nextComplexDrafts);
      setAdvancedJsonFieldEditors({});
    } else {
      setComplexFieldDrafts({});
      setAdvancedJsonFieldEditors({});
    }
  }, [currentValue]);

  const setTopLevelField = (fieldKey: string, value: unknown) => {
    if (!isRecord(formValue)) {
      setFormValue(value);
      setDraft(pretty(value));
      return;
    }

    const nextValue = {
      ...formValue,
      [fieldKey]: value,
    };

    setFormValue(nextValue);
    setDraft(pretty(nextValue));
  };

  const applyComplexFieldJson = (fieldKey: string) => {
    const text = complexFieldDrafts[fieldKey] ?? "";
    const parsed = parseJsonSafe(text);

    if (parsed.error) {
      messageApi.error(`${fieldKey} JSON 解析失败: ${parsed.error}`);
      return;
    }

    setTopLevelField(fieldKey, parsed.value);
    messageApi.success(`${fieldKey} 已应用。`);
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === "form") {
      const parsed = parseJsonSafe(draft);

      if (parsed.error) {
        messageApi.error(`当前 JSON 非法，无法切换到表单模式: ${parsed.error}`);
        return;
      }

      setFormValue(parsed.value);

      if (isRecord(parsed.value)) {
        const nextComplexDrafts: Record<string, string> = {};
        Object.entries(parsed.value).forEach(([key, value]) => {
          if (Array.isArray(value) || isRecord(value)) {
            nextComplexDrafts[key] = pretty(value);
          }
        });
        setComplexFieldDrafts(nextComplexDrafts);
      } else {
        setComplexFieldDrafts({});
      }
    }

    setActiveTab(nextTab as "form" | "json");
  };

  const save = async () => {
    if (!configKey || !config) {
      return;
    }

    const parsed = parseJsonSafe(draft);

    if (parsed.error) {
      messageApi.error(`JSON 解析失败: ${parsed.error}`);
      return;
    }

    try {
      setSaving(true);
      const source = config[configKey];
      let nextValue: unknown = source;

      if (isArrayConfigKey(configKey)) {
        if (!Array.isArray(source)) {
          messageApi.error("目标配置不是数组。\n");
          return;
        }

        if (createMode) {
          nextValue = [...source, parsed.value];
        } else {
          const idx = Number(indexText);

          if (!Number.isInteger(idx) || idx < 0 || idx >= source.length) {
            messageApi.error("索引无效。\n");
            return;
          }

          nextValue = source.map((item, index) => (index === idx ? parsed.value : item));
        }
      } else {
        if (!isRecord(source) || !field) {
          messageApi.error("字段无效。\n");
          return;
        }

        nextValue = {
          ...source,
          [field]: parsed.value,
        };
      }

      const body = { [configKey]: nextValue };
      const response = await requestJson<{ config: AdminConfigResponse["config"] }>("/api/admin/config", {
        body: JSON.stringify(body),
        method: "PUT",
      });

      setConfig(response.config);
      if (createMode && configKey && draftId && typeof window !== "undefined") {
        window.sessionStorage.removeItem(getDraftStorageKey(configKey, draftId));
        const sourceList = config[configKey];
        if (Array.isArray(sourceList)) {
          const newIndex = sourceList.length;
          router.replace(
            `/admin/config/${encodeURIComponent(configKey)}/${encodeURIComponent(itemKey)}?index=${newIndex}`,
          );
        }
      }
      messageApi.success(createMode ? "新增并保存成功。" : "单项保存成功。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  if (!configKey) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        无效配置 key：{rawConfigKey}
      </section>
    );
  }

  const renderFormEditor = () => {
    const singleFieldName = field ?? itemKey;

    if (!isRecord(formValue)) {
      const doc = getFieldDoc(configKey, singleFieldName);
      const enumOptions = getEnumOptions(singleFieldName);

      return (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900">{doc.label}</p>
          <p className="mb-2 text-xs text-slate-500">{doc.hint}</p>

          {enumOptions && typeof formValue === "string" ? (
            <Select
              className="w-full"
              onChange={(value) => {
                setFormValue(value);
                setDraft(pretty(value));
              }}
              options={enumOptions}
              value={formValue}
            />
          ) : typeof formValue === "boolean" ? (
            <Switch
              checked={formValue}
              onChange={(checked) => {
                setFormValue(checked);
                setDraft(pretty(checked));
              }}
            />
          ) : typeof formValue === "number" ? (
            <InputNumber
              className="w-full"
              onChange={(value) => {
                const next = typeof value === "number" ? value : 0;
                setFormValue(next);
                setDraft(pretty(next));
              }}
              value={normalizeNumberValue(formValue)}
            />
          ) : (
            <Input
              onChange={(event) => {
                const next = event.target.value;
                setFormValue(next);
                setDraft(pretty(next));
              }}
              value={normalizeStringValue(formValue)}
            />
          )}
        </div>
      );
    }

    const keys = Object.keys(formValue);

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {keys.map((fieldKey) => {
          const value = formValue[fieldKey];
          const doc = getFieldDoc(configKey, fieldKey);
          const enumOptions = getEnumOptions(fieldKey);
          const jsonHint = getJsonFieldHint(configKey, fieldKey);
          const isComplexField = Array.isArray(value) || isRecord(value);
          const structuredNumericDescriptor = isComplexField
            ? getStructuredNumericFieldDescriptor(configKey, fieldKey)
            : null;

          return (
            <div
              className={`rounded-lg border border-slate-200 p-3 ${isComplexField ? "md:col-span-2 xl:col-span-3" : ""}`}
              key={fieldKey}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{doc.label}</p>
                {jsonHint ? (
                  <Tooltip
                    title={(
                      <div className="max-w-[360px] space-y-2">
                        <div>
                          <p className="text-xs font-semibold">可配置字段</p>
                          <div className="mt-1 space-y-1">
                            {jsonHint.fields.map((entry) => (
                              <p className="text-xs" key={entry}>{entry}</p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold">示例</p>
                          <pre className="mt-1 whitespace-pre-wrap text-xs">{jsonHint.example}</pre>
                        </div>
                      </div>
                    )}
                  >
                    <Button size="small" type="link">查看 JSON 提示</Button>
                  </Tooltip>
                ) : null}
              </div>
              <p className="mb-2 text-xs text-slate-500">{doc.hint}</p>

              {enumOptions && typeof value === "string" ? (
                <Select
                  className="w-full"
                  onChange={(nextValue) => setTopLevelField(fieldKey, nextValue)}
                  options={enumOptions}
                  value={value}
                />
              ) : typeof value === "boolean" ? (
                <Switch checked={value} onChange={(checked) => setTopLevelField(fieldKey, checked)} />
              ) : typeof value === "number" ? (
                <InputNumber
                  className="w-full"
                  onChange={(nextValue) => setTopLevelField(fieldKey, typeof nextValue === "number" ? nextValue : 0)}
                  value={normalizeNumberValue(value)}
                />
              ) : structuredNumericDescriptor && isRecord(value) ? (
                <div className="space-y-2">
                  <div className={`grid gap-2 ${structuredNumericDescriptor.columnsClassName}`}>
                    {structuredNumericDescriptor.fields.map((entry) => {
                      const currentNumber = normalizeNumberValue(value[entry.key]);

                      return (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-2" key={entry.key}>
                          <p className="mb-1 text-xs text-slate-500">{entry.label}</p>
                          <InputNumber
                            className="w-full"
                            min={structuredNumericDescriptor.min}
                            onChange={(nextValue) => {
                              const nextRecord = {
                                ...value,
                                [entry.key]: typeof nextValue === "number" ? nextValue : 0,
                              };
                              setTopLevelField(fieldKey, nextRecord);
                              setComplexFieldDrafts((prev) => ({ ...prev, [fieldKey]: pretty(nextRecord) }));
                            }}
                            precision={structuredNumericDescriptor.integer ? 0 : undefined}
                            step={structuredNumericDescriptor.step}
                            value={currentNumber}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={() => {
                      setAdvancedJsonFieldEditors((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
                    }}
                    size="small"
                    type="link"
                  >
                    {advancedJsonFieldEditors[fieldKey] ? "收起高级 JSON 编辑" : "高级 JSON 编辑"}
                  </Button>

                  {advancedJsonFieldEditors[fieldKey] ? (
                    <div className="space-y-2">
                      <Input.TextArea
                        autoSize={{ minRows: 4, maxRows: 12 }}
                        onChange={(event) => {
                          const text = event.target.value;
                          setComplexFieldDrafts((prev) => ({ ...prev, [fieldKey]: text }));
                        }}
                        value={complexFieldDrafts[fieldKey] ?? pretty(value)}
                      />
                      <Button onClick={() => applyComplexFieldJson(fieldKey)} size="small">应用该字段 JSON</Button>
                    </div>
                  ) : null}
                </div>
              ) : isComplexField ? (
                <div className="space-y-2">
                  <Input.TextArea
                    autoSize={{ minRows: 4, maxRows: 12 }}
                    onChange={(event) => {
                      const text = event.target.value;
                      setComplexFieldDrafts((prev) => ({ ...prev, [fieldKey]: text }));
                    }}
                    value={complexFieldDrafts[fieldKey] ?? pretty(value)}
                  />
                  <Button onClick={() => applyComplexFieldJson(fieldKey)} size="small">应用该字段 JSON</Button>
                </div>
              ) : (
                <Input
                  onChange={(event) => setTopLevelField(fieldKey, event.target.value)}
                  value={normalizeStringValue(value)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const tabItems: TabsProps["items"] = [
    {
      children: (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            默认表单模式：优先提供可读字段和用途提示。复杂嵌套字段可先局部 JSON 编辑，也可切换到完整 JSON 模式。
          </div>
          {renderFormEditor()}
        </div>
      ),
      key: "form",
      label: "表单模式",
    },
    {
      children: (
        <div className="space-y-3">
          {enumReadableEntries.length > 0 ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-medium text-sky-700">枚举释义（便于阅读）</p>
              <div className="mt-2 grid gap-1">
                {enumReadableEntries.map((entry) => (
                  <p className="text-xs text-sky-800" key={`${entry.path}:${entry.raw}`}>
                    {entry.path}: {entry.raw} {"=>"} {entry.label}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <Input.TextArea
            autoSize={{ minRows: 16, maxRows: 26 }}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
        </div>
      ),
      key: "json",
      label: "JSON 模式",
    },
  ];

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">编辑配置项</h2>
            <p className="text-xs text-slate-500">
              {CONFIG_LABELS[configKey]} / {itemKey}
            </p>
          </div>
          <Space>
            <Link href={`/admin/config/${encodeURIComponent(configKey)}`}>
              <Button>返回列表</Button>
            </Link>
            <Button loading={loading} onClick={() => { void load(); }}>刷新</Button>
          </Space>
        </div>

        {loading || (createMode && !draftSourceReady) ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : currentValue === null ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {createMode ? "新建草稿已失效，请返回列表重新新增。" : "未找到该配置项。"}
          </div>
        ) : (
          <div className="space-y-3">
            <Tabs activeKey={activeTab} items={tabItems} onChange={handleTabChange} />

            <Space>
              <Button loading={saving} onClick={() => setDraft(pretty(formValue))}>重置</Button>
              <Button loading={saving} onClick={() => { void save(); }} type="primary">
                单独保存该项
              </Button>
            </Space>
          </div>
        )}
      </div>
    </section>
  );
}
