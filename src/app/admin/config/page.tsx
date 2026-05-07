import Link from "next/link";

export default function AdminConfigPage() {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">配置中心</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前版本已优先完成账号与角色的后台管理列表化改造。配置中心建议后续按同样模式拆分为“列表 + 独立编辑页”。
        </p>
        <div className="mt-4 text-sm">
          <Link className="text-[#1677ff] hover:underline" href="/api/admin/config">
            查看当前配置接口 JSON
          </Link>
        </div>
      </div>
    </section>
  );
}
