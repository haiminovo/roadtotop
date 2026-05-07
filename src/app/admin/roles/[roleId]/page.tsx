'use client';

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Popconfirm, Spin, message } from "antd";
import { requestJson } from "@/features/admin/components/admin-utils";
import { RoleForm } from "@/features/admin/components/role-form";
import type { AdminRoleDraft, AdminRoleRecord } from "@/features/admin/types";

type ConfigResponse = {
  config: {
    raceConfigs: Array<{ key: string; label: string }>;
    classConfigs: Array<{ key: string; label: string }>;
  };
};

export default function EditAdminRolePage() {
  const params = useParams<{ roleId: string }>();
  const router = useRouter();
  const roleId = decodeURIComponent(params.roleId);
  const [role, setRole] = useState<AdminRoleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [raceOptions, setRaceOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [classOptions, setClassOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesResponse, configResponse] = await Promise.all([
        requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles"),
        requestJson<ConfigResponse>("/api/admin/config"),
      ]);

      const target = rolesResponse.roles.find((item) => item.roleId === roleId) ?? null;
      setRole(target);
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
      messageApi.error(error instanceof Error ? error.message : "加载角色失败。");
    } finally {
      setLoading(false);
    }
  }, [messageApi, roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const initialValue = useMemo<AdminRoleDraft>(() => ({
    userId: role?.userId ?? "",
    name: role?.name ?? "",
    raceKey: role?.raceKey ?? "human",
    classKey: role?.classKey ?? "warrior",
    level: role?.level ?? 1,
    exp: role?.exp ?? 0,
    gold: role?.gold ?? 0,
    aetherCrystal: role?.aetherCrystal ?? 0,
    currentHealth: role?.currentHealth ?? 1,
    strength: role?.strength ?? 0,
    agility: role?.agility ?? 0,
    intelligence: role?.intelligence ?? 0,
    vitality: role?.vitality ?? 0,
    avatarSeed: role?.avatarSeed ?? "",
  }), [role]);

  const saveRole = async (value: AdminRoleDraft) => {
    if (!role) {
      return;
    }

    try {
      setSaving(true);
      const body: AdminRoleRecord = {
        roleId: role.roleId,
        userId: role.userId,
        name: value.name,
        raceKey: value.raceKey,
        classKey: value.classKey,
        level: value.level,
        exp: value.exp,
        gold: value.gold,
        aetherCrystal: value.aetherCrystal,
        currentHealth: value.currentHealth,
        strength: value.strength,
        agility: value.agility,
        intelligence: value.intelligence,
        vitality: value.vitality,
        avatarSeed: value.avatarSeed,
        username: role.username,
        accountType: role.accountType,
        updatedAt: role.updatedAt,
      };

      const response = await requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles", {
        body: JSON.stringify(body),
        method: "PUT",
      });

      const next = response.roles.find((item) => item.roleId === role.roleId) ?? null;
      setRole(next);
      messageApi.success("角色已保存。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存角色失败。");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!role) {
      return;
    }

    try {
      setDeleting(true);
      await requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles", {
        body: JSON.stringify({ roleId: role.roleId }),
        method: "DELETE",
      });
      messageApi.success("角色已删除。");
      router.push("/admin/roles");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除角色失败。");
    } finally {
      setDeleting(false);
    }
  };

  const userOptions = useMemo(
    () => (role ? [{ label: `${role.username || "游客"} (${role.userId})`, value: role.userId }] : []),
    [role],
  );

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">编辑角色</h2>
          <div className="flex items-center gap-2">
            <Link href="/admin/roles">
              <Button>返回列表</Button>
            </Link>
            <Popconfirm
              okButtonProps={{ danger: true, loading: deleting }}
              okText="删除"
              onConfirm={() => { void deleteRole(); }}
              title="确认删除该角色？"
            >
              <Button danger>删除角色</Button>
            </Popconfirm>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : !role ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            未找到该角色。
          </div>
        ) : (
          <RoleForm
            classOptions={classOptions}
            disableUserId
            initialValue={initialValue}
            onSubmit={saveRole}
            raceOptions={raceOptions}
            submitText="单独保存该角色"
            submitting={saving}
            userOptions={userOptions}
          />
        )}
      </div>
    </section>
  );
}
