'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Spin, message } from "antd";
import { requestJson } from "@/features/admin/components/admin-utils";
import { RoleForm } from "@/features/admin/components/role-form";
import type { AdminAccountRecord, AdminRoleDraft, AdminRoleRecord } from "@/features/admin/types";

const defaultRoleDraft: AdminRoleDraft = {
  userId: "",
  name: "",
  raceKey: "human",
  classKey: "warrior",
  level: 1,
  exp: 0,
  gold: 0,
  aetherCrystal: 0,
  currentHealth: 100,
  strength: 8,
  agility: 8,
  intelligence: 8,
  vitality: 8,
  avatarSeed: "",
};

type ConfigResponse = {
  config: {
    raceConfigs: Array<{ key: string; label: string }>;
    classConfigs: Array<{ key: string; label: string }>;
  };
};

export default function NewAdminRolePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [raceOptions, setRaceOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [classOptions, setClassOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [accountsResponse, configResponse, rolesResponse] = await Promise.all([
        requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts"),
        requestJson<ConfigResponse>("/api/admin/config"),
        requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles"),
      ]);

      const usedUserIdSet = new Set(rolesResponse.roles.map((role) => role.userId));
      const availableAccounts = accountsResponse.accounts.filter((account) => !usedUserIdSet.has(account.userId));

      setAccounts(availableAccounts);
      setRaceOptions(
        configResponse.config.raceConfigs.map((item) => ({
          label: `${item.label} (${item.key})`,
          value: item.key,
        })),
      );
      setClassOptions(
        configResponse.config.classConfigs.map((item) => ({
          label: `${item.label} (${item.key})`,
          value: item.key,
        })),
      );
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载数据失败。");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const userOptions = useMemo(
    () => accounts.map((account) => ({
      label: `${account.username || "游客"} (${account.userId})`,
      value: account.userId,
    })),
    [accounts],
  );

  const initialValue = useMemo<AdminRoleDraft>(() => ({
    ...defaultRoleDraft,
    userId: accounts[0]?.userId ?? "",
    avatarSeed: `avatar-${Date.now()}`,
  }), [accounts]);

  const submit = async (value: AdminRoleDraft) => {
    try {
      setSaving(true);
      const response = await requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles", {
        body: JSON.stringify(value),
        method: "POST",
      });

      const created = response.roles.find((item) => item.userId === value.userId);
      messageApi.success("角色创建成功。");

      if (created) {
        router.push(`/admin/roles/${encodeURIComponent(created.roleId)}`);
        return;
      }

      router.push("/admin/roles");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "创建角色失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">新增角色</h2>
          <Link href="/admin/roles">
            <Button>返回列表</Button>
          </Link>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : userOptions.length === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            当前没有可用账号（每个账号仅允许一个角色）。
          </div>
        ) : (
          <RoleForm
            classOptions={classOptions}
            initialValue={initialValue}
            onSubmit={submit}
            raceOptions={raceOptions}
            submitText="创建角色"
            submitting={saving}
            userOptions={userOptions}
          />
        )}
      </div>
    </section>
  );
}
