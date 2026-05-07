'use client';

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Space, Spin, message } from "antd";
import { requestJson } from "@/features/admin/components/admin-utils";
import {
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

export default function ConfigItemEditorPage() {
  const params = useParams<{ configKey: string; itemKey: string }>();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<AdminConfigResponse["config"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const rawConfigKey = decodeURIComponent(params.configKey);
  const itemKey = decodeURIComponent(params.itemKey);
  const indexText = searchParams.get("index");
  const field = searchParams.get("field");
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

  const currentValue = useMemo(() => {
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
  }, [config, configKey, field, indexText]);

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

        const idx = Number(indexText);

        if (!Number.isInteger(idx) || idx < 0 || idx >= source.length) {
          messageApi.error("索引无效。\n");
          return;
        }

        nextValue = source.map((item, index) => (index === idx ? parsed.value : item));
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
      messageApi.success("单项保存成功。");
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

        {loading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : currentValue === null ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            未找到该配置项。
          </div>
        ) : (
          <div className="space-y-3">
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
