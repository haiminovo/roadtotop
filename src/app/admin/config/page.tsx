'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Spin, message } from "antd";
import { requestJson } from "@/features/admin/components/admin-utils";
import {
  CONFIG_KEYS,
  CONFIG_LABELS,
  isArrayConfigKey,
  type AdminConfigResponse,
  type ConfigEditorKey,
} from "@/features/admin/components/config-admin";

function getCount(config: AdminConfigResponse["config"], key: ConfigEditorKey) {
  const value = config[key];

  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }

  return 0;
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<AdminConfigResponse["config"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await requestJson<AdminConfigResponse>("/api/admin/config");
        setConfig(response.config);
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : "加载配置失败。");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [messageApi]);

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">配置列表</h2>
          <Button loading={loading} onClick={() => window.location.reload()}>
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : !config ? (
          <div className="text-sm text-slate-500">暂无配置数据。</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CONFIG_KEYS.map((key) => (
              <div className="rounded-xl border border-slate-200 p-4" key={key}>
                <h3 className="text-sm font-semibold text-slate-900">{CONFIG_LABELS[key]}</h3>
                <p className="mt-1 text-xs text-slate-500">key: {key}</p>
                <p className="mt-2 text-sm text-slate-700">
                  {isArrayConfigKey(key) ? "列表项" : "字段数"}: {getCount(config, key)}
                </p>
                <div className="mt-3">
                  <Link href={`/admin/config/${encodeURIComponent(key)}`}>
                    <Button size="small" type="primary">进入列表</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
