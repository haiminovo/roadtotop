'use client';

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Popconfirm, Spin, message } from "antd";
import { AccountForm } from "@/features/admin/components/account-form";
import { requestJson } from "@/features/admin/components/admin-utils";
import type { AdminAccountDraft, AdminAccountRecord } from "@/features/admin/types";

export default function EditAdminAccountPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const userId = decodeURIComponent(params.userId);
  const [account, setAccount] = useState<AdminAccountRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadAccount = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts");
      const target = response.accounts.find((item) => item.userId === userId) ?? null;
      setAccount(target);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载账号失败。");
    } finally {
      setLoading(false);
    }
  }, [messageApi, userId]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const initialValue = useMemo<AdminAccountDraft>(() => ({
    accountType: account?.accountType ?? "guest",
    guestToken: account?.guestToken ?? "",
    password: "",
    username: account?.username ?? "",
  }), [account]);

  const saveAccount = async (value: AdminAccountDraft) => {
    if (!account) {
      return;
    }

    try {
      setSaving(true);
      const body = {
        userId: account.userId,
        accountType: value.accountType,
        guestToken: value.guestToken.trim() || undefined,
        password: value.password.trim() || undefined,
        ...(value.accountType === "account" ? { username: value.username.trim() } : { username: null }),
      };

      const response = await requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts", {
        body: JSON.stringify(body),
        method: "PUT",
      });

      const next = response.accounts.find((item) => item.userId === account.userId) ?? null;
      setAccount(next);
      messageApi.success("账号已保存。");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存账号失败。");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!account) {
      return;
    }

    try {
      setDeleting(true);
      await requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts", {
        body: JSON.stringify({ userId: account.userId }),
        method: "DELETE",
      });
      messageApi.success("账号已删除。");
      router.push("/admin/accounts");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除账号失败。");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">编辑账号</h2>
          <div className="flex items-center gap-2">
            <Link href="/admin/accounts">
              <Button>返回列表</Button>
            </Link>
            <Popconfirm
              okButtonProps={{ danger: true, loading: deleting }}
              okText="删除"
              onConfirm={() => { void deleteAccount(); }}
              title="确认删除该账号？"
            >
              <Button danger>删除账号</Button>
            </Popconfirm>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center"><Spin /></div>
        ) : !account ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            未找到该账号。
          </div>
        ) : (
          <AccountForm
            initialValue={initialValue}
            isEdit
            onSubmit={saveAccount}
            submitText="单独保存该账号"
            submitting={saving}
          />
        )}
      </div>
    </section>
  );
}
