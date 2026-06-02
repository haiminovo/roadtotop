'use client';

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Popconfirm, Segmented, Space, Spin, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { requestJson } from "@/features/admin/components/admin-utils";
import {
  EVENT_RULE_FILTER_LABELS,
  CONFIG_LABELS,
  createConfigArrayItem,
  getEventRuleTriggerType,
  getArrayItemKey,
  getArrayItemSubtitle,
  getArrayItemTitle,
  isArrayConfigKey,
  isConfigKey,
  pretty,
  type EventRuleFilter,
  type AdminConfigResponse,
  type ConfigEditorKey,
} from "@/features/admin/components/config-admin";

type RowItem = {
  id: string;
  index: number;
  itemKey: string;
  title: string;
  subtitle: string;
};

function normalizeNewConfigItem(configKey: ConfigEditorKey, item: unknown) {
  if (configKey !== "itemCatalog" || !item || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }

  const source = item as Record<string, unknown>;

  return {
    ...source,
    itemType: typeof source.itemType === "string" ? source.itemType : "equipment",
    skillKey: source.skillKey === undefined ? null : source.skillKey,
  };
}

function persistDraftConfigItem(configKey: ConfigEditorKey, value: unknown) {
  if (typeof window === "undefined") {
    return null;
  }

  const draftId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storageKey = `admin-config-draft:${configKey}:${draftId}`;

  window.sessionStorage.setItem(storageKey, JSON.stringify(value));

  return draftId;
}

export default function ConfigKeyPage() {
  const params = useParams<{ configKey: string }>();
  const router = useRouter();
  const rawConfigKey = decodeURIComponent(params.configKey);
  const [config, setConfig] = useState<AdminConfigResponse["config"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [eventFilter, setEventFilter] = useState<EventRuleFilter>("all");
  const [messageApi, contextHolder] = message.useMessage();

  const configKey: ConfigEditorKey | null = isConfigKey(rawConfigKey) ? rawConfigKey : null;

  const loadConfig = useCallback(async () => {
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
    void loadConfig();
  }, [loadConfig]);

  const sourceValue = useMemo(() => {
    if (!configKey || !config) {
      return null;
    }

    return config[configKey];
  }, [config, configKey]);

  const listRows = useMemo<RowItem[]>(() => {
    if (!configKey || !isArrayConfigKey(configKey) || !Array.isArray(sourceValue)) {
      return [];
    }

    return sourceValue
      .map((item, index) => {
        const itemKey = getArrayItemKey(item, index);
        return {
          id: `${index}-${itemKey}`,
          index,
          itemKey,
          title: getArrayItemTitle(item, index),
          subtitle: getArrayItemSubtitle(item),
        };
      })
      .filter((row) => {
        if (configKey === "eventRules" && eventFilter !== "all") {
          const sourceItem = sourceValue[row.index];
          const triggerType = getEventRuleTriggerType(sourceItem);
          if (triggerType !== eventFilter) {
            return false;
          }
        }

        const normalized = keyword.trim().toLowerCase();

        if (!normalized) {
          return true;
        }

        return row.title.toLowerCase().includes(normalized)
          || row.subtitle.toLowerCase().includes(normalized)
          || row.itemKey.toLowerCase().includes(normalized);
      });
  }, [configKey, eventFilter, keyword, sourceValue]);

  const saveConfigValue = async (nextValue: unknown) => {
    if (!configKey) {
      return;
    }

    try {
      setSaving(true);
      const body = { [configKey]: nextValue };
      const response = await requestJson<{ config: AdminConfigResponse["config"] }>("/api/admin/config", {
        body: JSON.stringify(body),
        method: "PUT",
      });
      setConfig(response.config);
      messageApi.success("保存成功。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  const addItem = async () => {
    if (!configKey || !isArrayConfigKey(configKey) || !Array.isArray(sourceValue)) {
      return;
    }

    const draftItem = normalizeNewConfigItem(configKey, createConfigArrayItem(configKey));
    const draftId = persistDraftConfigItem(configKey, draftItem);

    if (!draftId) {
      messageApi.error("创建草稿失败，请重试。");
      return;
    }

    const itemKey = getArrayItemKey(draftItem, sourceValue.length);
    router.push(
      `/admin/config/${encodeURIComponent(configKey)}/${encodeURIComponent(itemKey)}?create=1&draftId=${encodeURIComponent(draftId)}`,
    );
  };

  const removeItem = async (index: number) => {
    if (!configKey || !isArrayConfigKey(configKey) || !Array.isArray(sourceValue)) {
      return;
    }

    const nextItems = sourceValue.filter((_, itemIndex) => itemIndex !== index);
    await saveConfigValue(nextItems);
  };

  const objectEntries = useMemo(() => {
    if (!sourceValue || Array.isArray(sourceValue) || typeof sourceValue !== "object") {
      return [] as Array<{ key: string; value: unknown }>;
    }

    return Object.entries(sourceValue).map(([entryKey, entryValue]) => ({ key: entryKey, value: entryValue }));
  }, [sourceValue]);

  const columns: ColumnsType<RowItem> = [
    { dataIndex: "itemKey", key: "itemKey", title: "键", width: 260 },
    { dataIndex: "title", key: "title", title: "名称", width: 260 },
    { dataIndex: "subtitle", key: "subtitle", title: "说明" },
    {
      key: "actions",
      title: "操作",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Link href={`/admin/config/${encodeURIComponent(configKey ?? "")}/${encodeURIComponent(record.itemKey)}?index=${record.index}`}>
            <Button size="small" type="link">编辑</Button>
          </Link>
          <Popconfirm
            okButtonProps={{ danger: true, loading: saving }}
            okText="删除"
            onConfirm={() => { void removeItem(record.index); }}
            title="确认删除该配置项？"
          >
            <Button danger size="small" type="link">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!configKey) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        无效配置 key：{rawConfigKey}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{CONFIG_LABELS[configKey]}</h2>
            <p className="text-xs text-slate-500">key: {configKey}</p>
          </div>
          <Space>
            <Button onClick={() => router.push("/admin/config")}>返回配置列表</Button>
            <Button loading={loading} onClick={() => { void loadConfig(); }}>刷新</Button>
          </Space>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : isArrayConfigKey(configKey) ? (
          <div className="space-y-3">
            {configKey === "eventRules" ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                事件池按活动和地图隔离。行动触发规则必须指定一个 activityKeys 和一个 mapKeys；击杀触发规则按怪物配置。
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {configKey === "eventRules" ? (
                  <Segmented<EventRuleFilter>
                    onChange={(value) => setEventFilter(value)}
                    options={[
                      { label: EVENT_RULE_FILTER_LABELS.all, value: "all" },
                      { label: EVENT_RULE_FILTER_LABELS.afk_tick, value: "afk_tick" },
                      { label: EVENT_RULE_FILTER_LABELS.enemy_kill, value: "enemy_kill" },
                    ]}
                    value={eventFilter}
                  />
                ) : null}
                <Input
                  allowClear
                  className="w-full md:w-80"
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={configKey === "eventRules" ? "搜索 key / 名称 / 触发类型" : "搜索 key / 名称"}
                  value={keyword}
                />
              </div>
              <Button loading={saving} onClick={() => { void addItem(); }} type="primary">新增配置项</Button>
            </div>

            <Table<RowItem>
              columns={columns}
              dataSource={listRows}
              pagination={{ pageSize: 12 }}
              rowKey="id"
              scroll={{ x: 1100 }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              当前是对象配置，支持字段级跳转编辑。
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {objectEntries.map((entry) => {
                const text = typeof entry.value === "object" ? pretty(entry.value) : String(entry.value);
                const preview = text.length > 120 ? `${text.slice(0, 120)}...` : text;

                return (
                  <div className="rounded-lg border border-slate-200 p-3" key={entry.key}>
                    <div className="flex items-center justify-between gap-2">
                      <Tag>{entry.key}</Tag>
                      <Link href={`/admin/config/${encodeURIComponent(configKey)}/${encodeURIComponent(entry.key)}?field=${encodeURIComponent(entry.key)}`}>
                        <Button size="small" type="link">编辑</Button>
                      </Link>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-600">{preview}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
