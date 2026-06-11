'use client';

import React, { useEffect, useState } from 'react';

interface SkillEffect {
  type: string;
  chance?: number;
  value?: number;
  duration?: number;
}

interface SkillTemplate {
  key: string;
  name: string;
  category: string;
  description: string;
  baseDamage: number;
  levelGrowth: number;
  maxUses: number;
  cooldown: number;
  effects: SkillEffect[];
}

const CATEGORIES = ['attack', 'spell', 'guard'];

export default function SkillsAdmin() {
  const [skills, setSkills] = useState<SkillTemplate[]>([]);
  const [editing, setEditing] = useState<SkillTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => { loadSkills(); }, []);

  async function loadSkills() {
    const res = await fetch('/api/admin/config?action=skills');
    const data = await res.json();
    setSkills(data.skills || []);
  }

  async function saveSkill(skill: SkillTemplate) {
    const isNew = !skills.find(s => s.key === skill.key);
    const updated = isNew ? [...skills, skill] : skills.map(s => s.key === skill.key ? skill : s);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_skills', skills: updated }),
    });
    loadSkills();
    setEditing(null);
    setShowNew(false);
  }

  async function deleteSkill(key: string) {
    if (!confirm('确定删除？')) return;
    const updated = skills.filter(s => s.key !== key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_skills', skills: updated }),
    });
    loadSkills();
  }

  const categoryLabel = (c: string) => c === 'attack' ? '攻击' : c === 'spell' ? '法术' : '防御';
  const filtered = filterCategory ? skills.filter(s => s.category === filterCategory) : skills;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">技能管理</h2>
        <button onClick={() => setShowNew(true)} className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm">
          新增技能
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => setFilterCategory('')}
          className={`px-2 py-0.5 text-xs rounded ${!filterCategory ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary'}`}>
          全部 ({skills.length})
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilterCategory(c)}
            className={`px-2 py-0.5 text-xs rounded ${filterCategory === c ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary'}`}>
            {categoryLabel(c)} ({skills.filter(s => s.category === c).length})
          </button>
        ))}
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">类型</th>
              <th className="px-3 py-2 text-left">描述</th>
              <th className="px-3 py-2 text-left">基础伤害</th>
              <th className="px-3 py-2 text-left">成长</th>
              <th className="px-3 py-2 text-left">使用次数</th>
              <th className="px-3 py-2 text-left">冷却</th>
              <th className="px-3 py-2 text-left">效果</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(skill => (
              <tr key={skill.key} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{skill.key}</td>
                <td className="px-3 py-2 font-medium">{skill.name}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    skill.category === 'attack' ? 'bg-accent-red/20 text-accent-red' :
                    skill.category === 'spell' ? 'bg-accent-blue/20 text-accent-blue' :
                    'bg-accent-green/20 text-accent-green'
                  }`}>{categoryLabel(skill.category)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-text-secondary">{skill.description}</td>
                <td className="px-3 py-2">{skill.baseDamage}</td>
                <td className="px-3 py-2">+{skill.levelGrowth}/级</td>
                <td className="px-3 py-2">{skill.maxUses}</td>
                <td className="px-3 py-2">{skill.cooldown}s</td>
                <td className="px-3 py-2 text-xs text-text-secondary">
                  {skill.effects.length > 0 ? skill.effects.map(e => e.type).join(', ') : '-'}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(skill)} className="text-accent-blue text-xs mr-2">编辑</button>
                  <button onClick={() => deleteSkill(skill.key)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || showNew) && (
        <SkillEditor skill={editing} onSave={saveSkill} onClose={() => { setEditing(null); setShowNew(false); }} />
      )}
    </div>
  );
}

function SkillEditor({ skill, onSave, onClose }: { skill: SkillTemplate | null; onSave: (s: SkillTemplate) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    key: skill?.key || '',
    name: skill?.name || '',
    category: skill?.category || 'attack',
    description: skill?.description || '',
    baseDamage: skill?.baseDamage || 10,
    levelGrowth: skill?.levelGrowth || 1,
    maxUses: skill?.maxUses || 3,
    cooldown: skill?.cooldown || 0,
    effectsJson: JSON.stringify(skill?.effects || [], null, 2),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{skill ? '编辑技能' : '新增技能'}</h3>
        <div className="space-y-3">
          <Field label="Key" value={form.key} onChange={v => setForm({ ...form, key: v })} disabled={!!skill} />
          <Field label="名称" value={form.name} onChange={v => setForm({ ...form, name: v })} />
          <SelectField label="类型" value={form.category} options={CATEGORIES} onChange={v => setForm({ ...form, category: v })} />
          <Field label="描述" value={form.description} onChange={v => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="基础伤害" type="number" value={String(form.baseDamage)} onChange={v => setForm({ ...form, baseDamage: Number(v) })} />
            <Field label="成长/级" type="number" value={String(form.levelGrowth)} onChange={v => setForm({ ...form, levelGrowth: Number(v) })} />
            <Field label="使用次数" type="number" value={String(form.maxUses)} onChange={v => setForm({ ...form, maxUses: Number(v) })} />
            <Field label="冷却(秒)" type="number" value={String(form.cooldown)} onChange={v => setForm({ ...form, cooldown: Number(v) })} />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">效果 (JSON)</label>
            <textarea value={form.effectsJson} onChange={e => setForm({ ...form, effectsJson: e.target.value })}
              className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded font-mono h-24" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
          <button onClick={() => {
            try {
              const effects = JSON.parse(form.effectsJson);
              onSave({ ...form, effects });
            } catch { alert('效果 JSON 格式错误'); }
          }} className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm">保存</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary disabled:opacity-50" />
    </div>
  );
}

function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void }) {
  const CATEGORY_LABELS: Record<string, string> = { attack: '攻击', spell: '法术', guard: '防御' };
  const allLabels = { ...CATEGORY_LABELS, ...labels };
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary">
        {options.map(o => <option key={o} value={o}>{allLabels[o] || o}</option>)}
      </select>
    </div>
  );
}
