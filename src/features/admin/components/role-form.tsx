'use client';

import { Button, Form, Input, InputNumber, Select, Space } from "antd";
import type { AdminRoleDraft } from "@/features/admin/types";

type BasicOption = {
  label: string;
  value: string;
};

type RoleFormProps = {
  initialValue: AdminRoleDraft;
  onSubmit: (value: AdminRoleDraft) => Promise<void> | void;
  raceOptions: BasicOption[];
  classOptions: BasicOption[];
  userOptions?: BasicOption[];
  disableUserId?: boolean;
  submitText: string;
  submitting?: boolean;
};

const numberFieldRules = [{ required: true, message: "请输入数值" }];

export function RoleForm({
  initialValue,
  onSubmit,
  raceOptions,
  classOptions,
  userOptions = [],
  disableUserId = false,
  submitText,
  submitting = false,
}: RoleFormProps) {
  const [form] = Form.useForm<AdminRoleDraft>();

  return (
    <Form<AdminRoleDraft>
      className="[&_.ant-form-item]:mb-2.5 [&_.ant-form-item-label]:pb-0.5 [&_.ant-form-item-label>label]:text-xs [&_.ant-form-item-label>label]:text-slate-500"
      colon={false}
      form={form}
      initialValues={initialValue}
      layout="vertical"
      onFinish={onSubmit}
      key={JSON.stringify(initialValue)}
      requiredMark={false}
      size="small"
    >
      <Form.Item<AdminRoleDraft>
        label="所属账号"
        name="userId"
        rules={[{ required: true, message: "请选择账号" }]}
      >
        <Select
          disabled={disableUserId}
          options={userOptions}
          placeholder="选择一个账号"
          showSearch
        />
      </Form.Item>

      <Form.Item<AdminRoleDraft>
        label="角色名"
        name="name"
        rules={[{ required: true, message: "请输入角色名" }]}
      >
        <Input />
      </Form.Item>

      <div className="grid gap-2 md:grid-cols-2">
        <Form.Item<AdminRoleDraft>
          label="种族"
          name="raceKey"
          rules={[{ required: true, message: "请选择种族" }]}
        >
          <Select options={raceOptions} />
        </Form.Item>

        <Form.Item<AdminRoleDraft>
          label="职业"
          name="classKey"
          rules={[{ required: true, message: "请选择职业" }]}
        >
          <Select options={classOptions} />
        </Form.Item>
      </div>

      <Form.Item<AdminRoleDraft> label="头像种子" name="avatarSeed" rules={[{ required: true, message: "请输入头像种子" }]}>
        <Input />
      </Form.Item>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">数值面板</p>
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Form.Item<AdminRoleDraft> label="等级" name="level" rules={numberFieldRules}>
          <InputNumber className="w-full" min={1} precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="经验" name="exp" rules={numberFieldRules}>
          <InputNumber className="w-full" min={0} precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="金币" name="gold" rules={numberFieldRules}>
          <InputNumber className="w-full" min={0} precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="以太" name="aetherCrystal" rules={numberFieldRules}>
          <InputNumber className="w-full" min={0} precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="当前生命" name="currentHealth" rules={numberFieldRules}>
          <InputNumber className="w-full" min={1} precision={0} />
        </Form.Item>

        <Form.Item<AdminRoleDraft> label="力量" name="strength" rules={numberFieldRules}>
          <InputNumber className="w-full" precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="敏捷" name="agility" rules={numberFieldRules}>
          <InputNumber className="w-full" precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="智力" name="intelligence" rules={numberFieldRules}>
          <InputNumber className="w-full" precision={0} />
        </Form.Item>
        <Form.Item<AdminRoleDraft> label="体质" name="vitality" rules={numberFieldRules}>
          <InputNumber className="w-full" precision={0} />
        </Form.Item>
        </div>
      </div>

      <Space className="mt-2">
        <Button htmlType="submit" loading={submitting} type="primary">
          {submitText}
        </Button>
      </Space>
    </Form>
  );
}
