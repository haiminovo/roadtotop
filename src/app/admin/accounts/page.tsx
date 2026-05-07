'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Popconfirm, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatDateTime, requestJson } from "@/features/admin/components/admin-utils";
import type { AdminAccountRecord } from "@/features/admin/types";

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts");
      setAccounts(response.accounts);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载账号失败。");
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return accounts;
    }

    return accounts.filter((account) =>
      account.userId.toLowerCase().includes(normalized)
      || account.guestToken.toLowerCase().includes(normalized)
      || (account.username ?? "").toLowerCase().includes(normalized)
      || (account.roleName ?? "").toLowerCase().includes(normalized),
    );
  }, [accounts, keyword]);

  const removeAccount = async (userId: string) => {
    try {
      setDeletingUserId(userId);
      const response = await requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts", {
        body: JSON.stringify({ userId }),
        method: "DELETE",
      });
      setAccounts(response.accounts);
      messageApi.success("账号已删除。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除账号失败。");
    } finally {
      setDeletingUserId(null);
    }
  };

  const columns: ColumnsType<AdminAccountRecord> = [
    {
      dataIndex: "userId",
      key: "userId",
      title: "User ID",
      width: 220,
    },
    {
      dataIndex: "accountType",
      key: "accountType",
      title: "类型",
      width: 90,
      render: (value: AdminAccountRecord["accountType"]) => (
        value === "account" ? <Tag color="blue">账号</Tag> : <Tag>游客</Tag>
      ),
    },
    {
      dataIndex: "username",
      key: "username",
      title: "用户名",
      width: 150,
      render: (value: string | null) => value || "-",
    },
    {
      dataIndex: "guestToken",
      key: "guestToken",
      title: "Guest Token",
      width: 250,
      ellipsis: true,
    },
    {
      dataIndex: "roleName",
      key: "roleName",
      title: "角色",
      width: 160,
      render: (value: string | null) => value || "-",
    },
    {
      dataIndex: "createdAt",
      key: "createdAt",
      title: "创建时间",
      width: 170,
      render: (value: number | null) => formatDateTime(value),
    },
    {
      dataIndex: "lastSeenAt",
      key: "lastSeenAt",
      title: "最近在线",
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
          <Link href={`/admin/accounts/${encodeURIComponent(record.userId)}`}>
            <Button size="small" type="link">编辑</Button>
          </Link>
          <Popconfirm
            okButtonProps={{ danger: true, loading: deletingUserId === record.userId }}
            okText="删除"
            onConfirm={() => {
              void removeAccount(record.userId);
            }}
            title="确认删除该账号？"
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
            <Link href="/admin/accounts/new">
              <Button type="primary">新增账号</Button>
            </Link>
            <Button loading={loading} onClick={() => { void loadAccounts(); }}>刷新</Button>
          </Space>
          <Input
            allowClear
            className="w-full md:w-80"
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索 userId / username / token / role"
            value={keyword}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Table<AdminAccountRecord>
          columns={columns}
          dataSource={filteredAccounts}
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowKey="userId"
          scroll={{ x: 1300 }}
        />
      </div>
    </section>
  );
}
