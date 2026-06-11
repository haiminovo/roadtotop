'use client';

import React, { useEffect, useState } from 'react';

interface EventAction {
  type: string;
  chance: number;
  min?: number;
  max?: number;
  itemType?: string;
  rarity?: string;
}

interface EventRule {
  key: string;
  trigger: { type: string; mapKey?: string | null; activityKey?: string | null };
  encounter: { tier: string; title: string; description: string };
  actions: EventAction[];
}

const TRIGGER_TYPES = ['afk_tick', 'enemy_kill'];
const TRIGGER_LABELS: Record<string, string> = { afk_tick: '挂机tick', enemy_kill: '击杀敌人' };
const TIERS = ['common', 'rare', 'legendary'];
const TIER_LABELS: Record<string, string> = { common: '普通', rare: '稀有', legendary: '传说' };
const ACTION_TYPES = ['grant_gold', 'grant_aether', 'grant_exp', 'grant_item', 'start_battle', 'adjust_health'];
const ACTION_LABELS: Record<string, string> = { grant_gold: '金币', grant_aether: '水晶', grant_exp: '经验', grant_item: '物品', start_battle: '开始战斗', adjust_health: '调整血量' };
const MAP_KEYS = ['', 'plains', 'forest', 'cave', 'volcano', 'ruins', 'void'];
const MAP_LABELS: Record<string, string> = { '': '(全部)', plains: '翡翠平原', forest: '迷雾森林', cave: '水晶洞穴', volcano: '烈焰火山', ruins: '远古遗迹', void: '虚空裂隙' };
const ACTIVITY_KEYS = ['', 'combat', 'gathering', 'fishing'];
const ACTIVITY_LABELS: Record<string, string> = { '': '(全部)', combat: '战斗', gathering: '采集', fishing: '钓鱼' };

export default function EventsAdmin() {
  const [rules, setRules] = useState<EventRule[]>([]);
  const [editing, setEditing] = useState<EventRule | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    const res = await fetch('/api/admin/config?action=event_rules');
    const data = await res.json();
    setRules(data.rules || []);
  }

  async function saveRule(rule: EventRule) {
    const isNew = !rules.find(r => r.key === rule.key);
    const updated = isNew
      ? [...rules, rule]
      : rules.map(r => r.key === rule.key ? rule : r);

    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_event_rules', rules: updated }),
    });
    loadRules();
    setEditing(null);
    setShowNew(false);
  }

  async function deleteRule(key: string) {
    if (!confirm('确定删除？')) return;
    const updated = rules.filter(r => r.key !== key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_event_rules', rules: updated }),
    });
    loadRules();
  }

  const tierLabel = (t: string) => t === 'legendary' ? '传说' : t === 'rare' ? '稀有' : '普通';
  const tierColor = (t: string) => t === 'legendary' ? 'text-accent-orange' : t === 'rare' ? 'text-accent-green' : 'text-text-muted';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">事件规则管理</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm"
        >
          新增规则
        </button>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">触发器</th>
              <th className="px-3 py-2 text-left">条件</th>
              <th className="px-3 py-2 text-left">等级</th>
              <th className="px-3 py-2 text-left">标题</th>
              <th className="px-3 py-2 text-left">动作</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(rule => (
              <tr key={rule.key} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{rule.key}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary">{rule.trigger.type}</span>
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {rule.trigger.mapKey && <span>地图:{rule.trigger.mapKey} </span>}
                  {rule.trigger.activityKey && <span>活动:{rule.trigger.activityKey}</span>}
                  {!rule.trigger.mapKey && !rule.trigger.activityKey && <span className="text-text-muted">全部</span>}
                </td>
                <td className={`px-3 py-2 font-medium ${tierColor(rule.encounter.tier)}`}>{tierLabel(rule.encounter.tier)}</td>
                <td className="px-3 py-2">{rule.encounter.title}</td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {rule.actions.map((a, i) => (
                    <span key={i} className="inline-block mr-1">
                      {a.type}({(a.chance * 100).toFixed(0)}%)
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(rule)} className="text-accent-blue text-xs mr-2">编辑</button>
                  <button onClick={() => deleteRule(rule.key)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || showNew) && (
        <EventEditor
          rule={editing}
          onSave={saveRule}
          onClose={() => { setEditing(null); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function EventEditor({ rule, onSave, onClose }: { rule: EventRule | null; onSave: (r: EventRule) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    key: rule?.key || '',
    triggerType: rule?.trigger.type || 'afk_tick',
    triggerMapKey: rule?.trigger.mapKey || '',
    triggerActivityKey: rule?.trigger.activityKey || '',
    tier: rule?.encounter.tier || 'common',
    title: rule?.encounter.title || '',
    description: rule?.encounter.description || '',
    actionsJson: JSON.stringify(rule?.actions || [{ type: 'grant_gold', chance: 1.0, min: 1, max: 5 }], null, 2),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{rule ? '编辑规则' : '新增规则'}</h3>
        <div className="space-y-3">
          <Field label="Key" value={form.key} onChange={v => setForm({ ...form, key: v })} disabled={!!rule} />

          <SelectField label="触发器类型" value={form.triggerType} options={TRIGGER_TYPES} labels={TRIGGER_LABELS} onChange={v => setForm({ ...form, triggerType: v })} />
          <SelectField label="地图条件" value={form.triggerMapKey} options={MAP_KEYS} labels={MAP_LABELS} onChange={v => setForm({ ...form, triggerMapKey: v })} />
          <SelectField label="活动条件" value={form.triggerActivityKey} options={ACTIVITY_KEYS} labels={ACTIVITY_LABELS} onChange={v => setForm({ ...form, triggerActivityKey: v })} />

          <SelectField label="遭遇等级" value={form.tier} options={TIERS} labels={TIER_LABELS} onChange={v => setForm({ ...form, tier: v })} />
          <Field label="标题" value={form.title} onChange={v => setForm({ ...form, title: v })} />
          <Field label="描述" value={form.description} onChange={v => setForm({ ...form, description: v })} />

          <div>
            <label className="text-xs text-text-muted block mb-1">动作 (JSON)</label>
            <textarea
              value={form.actionsJson}
              onChange={e => setForm({ ...form, actionsJson: e.target.value })}
              className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded font-mono h-32"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
          <button
            onClick={() => {
              try {
                const actions = JSON.parse(form.actionsJson);
                onSave({
                  key: form.key,
                  trigger: { type: form.triggerType, mapKey: form.triggerMapKey || null, activityKey: form.triggerActivityKey || null },
                  encounter: { tier: form.tier, title: form.title, description: form.description },
                  actions,
                });
              } catch { alert('动作 JSON 格式错误'); }
            }}
            className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary disabled:opacity-50"
      />
    </div>
  );
}

function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary"
      >
        {options.map(o => <option key={o} value={o}>{labels?.[o] || o || '(全部)'}</option>)}
      </select>
    </div>
  );
}
