'use client';

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Space, Spin, message } from "antd";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getDraftStorageKey(configKey: ConfigEditorKey, draftId: string) {
  return `admin-config-draft:${configKey}:${draftId}`;
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
    if (currentValue !== null) {
      setDraft(pretty(currentValue));
    }
  }, [currentValue]);

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
        const source = config[configKey];
        if (Array.isArray(source)) {
          const newIndex = source.length;
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

            <Space>
              <Button loading={saving} onClick={() => setDraft(pretty(currentValue))}>重置</Button>
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
