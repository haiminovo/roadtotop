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

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json() as T & { error?: string; ok: boolean };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "请求失败。");
  }

  return payload;
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AdminPage() {
  const [configPayload, setConfigPayload] = useState<AdminConfigResponse | null>(null);
  const [configDrafts, setConfigDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      requestJson<AdminConfigResponse>("/api/admin/config"),
      requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles"),
    ])
      .then(([configResponse, rolesResponse]) => {
        setConfigPayload(configResponse);
        setRoles(rolesResponse.roles);
        setConfigDrafts({
          raceConfigs: pretty(configResponse.config.raceConfigs),
          classConfigs: pretty(configResponse.config.classConfigs),
          mapConfigs: pretty(configResponse.config.mapConfigs),
          itemCatalog: pretty(configResponse.config.itemCatalog),
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

  const roleColumns = useMemo(() => [
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
  ] as const, []);

  const saveConfig = async () => {
    if (!configPayload) {
      return;
    }

    try {
      setSavingKey("config");
      setError(null);

      const body = {
        raceConfigs: JSON.parse(configDrafts.raceConfigs),
        classConfigs: JSON.parse(configDrafts.classConfigs),
        mapConfigs: JSON.parse(configDrafts.mapConfigs),
        itemCatalog: JSON.parse(configDrafts.itemCatalog),
        battleEnemyTemplates: JSON.parse(configDrafts.battleEnemyTemplates),
        afkEncounterPool: JSON.parse(configDrafts.afkEncounterPool),
        afkEncounterChances: JSON.parse(configDrafts.afkEncounterChances),
        systemBalance: JSON.parse(configDrafts.systemBalance),
      };

      const response = await requestJson<{ config: AdminConfigResponse["config"] }>("/api/admin/config", {
        body: JSON.stringify(body),
        method: "PUT",
      });

      setConfigPayload((current) => current ? { ...current, config: response.config } : current);
    } catch (saveError) {
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

  if (loading) {
    return <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">后台加载中...</main>;
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,#18324a_0%,#081019_36%,#030712_100%)] px-4 py-5 text-slate-100 md:px-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="rounded-[1.4rem] border border-cyan-200/10 bg-slate-950/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/55">Admin Console</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">游戏后台</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                这里可以直接编辑角色、物品、怪物模板、挂机遭遇、地图、职业和系统数值。当前版本优先保证可扩展和可生效，复杂结构先以 JSON 方式编辑。
              </p>
            </div>
            <button
              className="rounded-[0.95rem] bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={savingKey === "config"}
              onClick={() => {
                void saveConfig();
              }}
              type="button"
            >
              {savingKey === "config" ? "保存中..." : "保存全部配置"}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        </section>

        <section className="rounded-[1.4rem] border border-white/8 bg-slate-950/45 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/50">Roles</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">角色数据</h2>
            </div>
            <p className="text-sm text-slate-400">{roles.length} 个角色</p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-2">账号</th>
                  {roleColumns.map((column) => (
                    <th key={column} className="px-2 py-2">{column}</th>
                  ))}
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.roleId} className="rounded-xl bg-white/[0.03]">
                    <td className="px-2 py-2 text-slate-300">
                      <div>{role.username ?? "guest"}</div>
                      <div className="text-xs text-slate-500">{role.accountType}</div>
                    </td>
                    {roleColumns.map((column) => (
                      <td key={column} className="px-2 py-2">
                        <input
                          className="w-28 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none"
                          onChange={(event) => updateRoleField(role.roleId, column, event.target.value)}
                          value={String(role[column] ?? "")}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <button
                        className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/18 disabled:opacity-50"
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

        <section className="grid gap-5 xl:grid-cols-2">
          {[
            ["raceConfigs", "种族配置"],
            ["classConfigs", "职业配置"],
            ["mapConfigs", "地图配置"],
            ["itemCatalog", "物品配置"],
            ["battleEnemyTemplates", "怪物模板"],
            ["afkEncounterPool", "挂机遭遇"],
            ["afkEncounterChances", "遭遇概率"],
            ["systemBalance", "系统平衡参数"],
          ].map(([key, title]) => (
            <div key={key} className="rounded-[1.35rem] border border-white/8 bg-slate-950/45 p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/50">Config</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
              <textarea
                className="mt-4 h-[360px] w-full rounded-[1rem] border border-white/10 bg-slate-950/90 px-4 py-4 font-mono text-[12px] leading-6 text-slate-100 outline-none"
                onChange={(event) => setConfigDrafts((current) => ({ ...current, [key]: event.target.value }))}
                spellCheck={false}
                value={configDrafts[key] ?? ""}
              />
            </div>
          ))}
        </section>

        {configPayload?.meta ? (
          <section className="rounded-[1.35rem] border border-white/8 bg-slate-950/45 p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/50">Reference</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">运行时常量参考</h2>
            <pre className="mt-4 overflow-x-auto rounded-[1rem] border border-white/8 bg-slate-950/90 p-4 text-[12px] leading-6 text-slate-300">
              {pretty(configPayload.meta)}
            </pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
