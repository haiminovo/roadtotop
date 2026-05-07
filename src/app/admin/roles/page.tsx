'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Popconfirm, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatDateTime, requestJson } from "@/features/admin/components/admin-utils";
import type { AdminRoleRecord } from "@/features/admin/types";

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles");
      setRoles(response.roles);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载角色失败。");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return roles;
    }

    return roles.filter((role) =>
      role.name.toLowerCase().includes(normalized)
      || role.roleId.toLowerCase().includes(normalized)
      || role.userId.toLowerCase().includes(normalized)
      || role.raceKey.toLowerCase().includes(normalized)
      || role.classKey.toLowerCase().includes(normalized)
      || (role.username ?? "").toLowerCase().includes(normalized),
    );
  }, [roles, keyword]);

  const removeRole = async (roleId: string) => {
    try {
      setDeletingRoleId(roleId);
      const response = await requestJson<{ roles: AdminRoleRecord[] }>("/api/admin/roles", {
        body: JSON.stringify({ roleId }),
        method: "DELETE",
      });
      setRoles(response.roles);
      messageApi.success("角色已删除。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除角色失败。");
    } finally {
      setDeletingRoleId(null);
    }
  };

  const columns: ColumnsType<AdminRoleRecord> = [
    { dataIndex: "name", key: "name", title: "角色名", width: 140 },
    { dataIndex: "roleId", key: "roleId", title: "Role ID", width: 220 },
    { dataIndex: "userId", key: "userId", title: "所属账号", width: 220 },
    {
      dataIndex: "username",
      key: "username",
      title: "用户名",
      width: 130,
      render: (value: string | null) => value || "-",
    },
    {
      dataIndex: "accountType",
      key: "accountType",
      title: "账号类型",
      width: 100,
      render: (value: string) => value === "account" ? <Tag color="blue">账号</Tag> : <Tag>游客</Tag>,
    },
    { dataIndex: "raceKey", key: "raceKey", title: "种族", width: 100 },
    { dataIndex: "classKey", key: "classKey", title: "职业", width: 100 },
    { dataIndex: "level", key: "level", title: "等级", width: 80 },
    { dataIndex: "exp", key: "exp", title: "经验", width: 100 },
    { dataIndex: "gold", key: "gold", title: "金币", width: 110 },
    { dataIndex: "aetherCrystal", key: "aetherCrystal", title: "以太", width: 100 },
    {
      dataIndex: "updatedAt",
      key: "updatedAt",
      title: "更新时间",
      width: 170,
      render: (value: number | null) => formatDateTime(value),
    },
    {
      key: "actions",
      title: "操作",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Link href={`/admin/roles/${encodeURIComponent(record.roleId)}`}>
            <Button size="small" type="link">编辑</Button>
          </Link>
          <Popconfirm
            okButtonProps={{ danger: true, loading: deletingRoleId === record.roleId }}
            okText="删除"
            onConfirm={() => {
              void removeRole(record.roleId);
            }}
            title="确认删除该角色？"
          >
            <Button danger size="small" type="link">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space>
            <Link href="/admin/roles/new">
              <Button type="primary">新增角色</Button>
            </Link>
            <Button loading={loading} onClick={() => { void loadRoles(); }}>刷新</Button>
          </Space>
          <Input
            allowClear
            className="w-full md:w-80"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 roleId / userId / 角色名 / 种族 / 职业"
            value={keyword}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Table<AdminRoleRecord>
          columns={columns}
          dataSource={filteredRoles}
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowKey="roleId"
          scroll={{ x: 1800 }}
        />
      </div>
    </section>
  );
}
