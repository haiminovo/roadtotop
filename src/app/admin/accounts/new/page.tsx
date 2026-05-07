'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, message } from "antd";
import { AccountForm } from "@/features/admin/components/account-form";
import { requestJson } from "@/features/admin/components/admin-utils";
import type { AdminAccountDraft, AdminAccountRecord } from "@/features/admin/types";

const defaultDraft: AdminAccountDraft = {
  accountType: "guest",
  guestToken: "",
  password: "",
  username: "",
};

export default function NewAdminAccountPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async (value: AdminAccountDraft) => {
    try {
      setSaving(true);
      const body = {
        accountType: value.accountType,
        guestToken: value.guestToken.trim() || undefined,
        password: value.password.trim() || undefined,
        ...(value.accountType === "account" ? { username: value.username.trim() } : { username: null }),
      };

      const response = await requestJson<{ accounts: AdminAccountRecord[] }>("/api/admin/accounts", {
        body: JSON.stringify(body),
        method: "POST",
      });

      const created = response.accounts[0];
      messageApi.success("账号创建成功。");

      if (created) {
        router.push(`/admin/accounts/${encodeURIComponent(created.userId)}`);
        return;
      }

      router.push("/admin/accounts");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "创建账号失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      {contextHolder}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">新增账号</h2>
          <Link href="/admin/accounts">
            <Button>返回列表</Button>
          </Link>
        </div>

        <AccountForm
          initialValue={defaultDraft}
          onSubmit={handleSubmit}
          submitText="创建账号"
          submitting={saving}
        />
      </div>
    </section>
  );
}
