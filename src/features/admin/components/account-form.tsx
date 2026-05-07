'use client';

import { Button, Form, Input, Radio, Space } from "antd";
import type { AdminAccountDraft } from "@/features/admin/types";

type AccountFormProps = {
  initialValue: AdminAccountDraft;
  isEdit?: boolean;
  onSubmit: (value: AdminAccountDraft) => Promise<void> | void;
  submitText: string;
  submitting?: boolean;
};

export function AccountForm({
  initialValue,
  isEdit = false,
  onSubmit,
  submitText,
  submitting = false,
}: AccountFormProps) {
  const [form] = Form.useForm<AdminAccountDraft>();

  return (
    <Form<AdminAccountDraft>
      form={form}
      initialValues={initialValue}
      layout="vertical"
      onFinish={onSubmit}
      onValuesChange={(_, allValues) => {
        if (allValues.accountType === "guest") {
          form.setFieldValue("username", "");
        }
      }}
      key={JSON.stringify(initialValue)}
    >
      <Form.Item<AdminAccountDraft>
        label="账号类型"
        name="accountType"
        rules={[{ required: true, message: "请选择账号类型" }]}
      >
        <Radio.Group
          optionType="button"
          options={[
            { label: "游客", value: "guest" },
            { label: "账号", value: "account" },
          ]}
        />
      </Form.Item>

      <Form.Item<AdminAccountDraft> label="Guest Token" name="guestToken">
        <Input placeholder="留空将自动生成" />
      </Form.Item>

      <Form.Item shouldUpdate noStyle>
        {({ getFieldValue }) => getFieldValue("accountType") === "account" ? (
          <Form.Item<AdminAccountDraft>
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>
        ) : null}
      </Form.Item>

      <Form.Item shouldUpdate noStyle>
        {({ getFieldValue }) => {
          const accountType = getFieldValue("accountType") as AdminAccountDraft["accountType"] | undefined;
          const needPassword = accountType === "account" && !isEdit;

          return (
            <Form.Item<AdminAccountDraft>
              extra={isEdit ? "留空表示不修改密码" : "账号类型为“账号”时必填"}
              label="密码"
              name="password"
              rules={needPassword ? [{ required: true, message: "请输入密码" }] : []}
            >
              <Input.Password placeholder="输入密码" />
            </Form.Item>
          );
        }}
      </Form.Item>

      <Space>
        <Button htmlType="submit" loading={submitting} type="primary">
          {submitText}
        </Button>
      </Space>
    </Form>
  );
}
