'use client';

import React, { useEffect, useState } from 'react';

interface EnemyTemplate {
  key: string;
  name: string;
  mapKey: string;
  baseHealth: number;
  statWeights: { strength: number; intelligence: number; agility: number; vitality: number };
  fixedSkillKeys: string[];
  skillCaps: { attack: number; spell: number; guard: number };
  goldDrop: number;
  expDrop: number;
}

const MAP_KEYS = ['plains', 'forest', 'cave', 'volcano', 'ruins', 'void'];

export default function EnemiesAdmin() {
  const [enemies, setEnemies] = useState<EnemyTemplate[]>([]);
  const [editing, setEditing] = useState<EnemyTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadEnemies(); }, []);

  async function loadEnemies() {
    const res = await fetch('/api/admin/config?action=enemies');
    const data = await res.json();
    setEnemies(data.enemies || []);
  }

  async function saveEnemy(enemy: EnemyTemplate) {
    const isNew = !enemies.find(e => e.key === enemy.key);
    const updated = isNew
      ? [...enemies, enemy]
      : enemies.map(e => e.key === enemy.key ? enemy : e);

    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_enemies', enemies: updated }),
    });
    loadEnemies();
    setEditing(null);
    setShowNew(false);
  }

  async function deleteEnemy(key: string) {
    if (!confirm('确定删除？')) return;
    const updated = enemies.filter(e => e.key !== key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_enemies', enemies: updated }),
    });
    loadEnemies();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">怪物管理</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm"
        >
          新增怪物
        </button>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">地图</th>
              <th className="px-3 py-2 text-left">血量</th>
              <th className="px-3 py-2 text-left">力量</th>
              <th className="px-3 py-2 text-left">智力</th>
              <th className="px-3 py-2 text-left">敏捷</th>
              <th className="px-3 py-2 text-left">体力</th>
              <th className="px-3 py-2 text-left">金币</th>
              <th className="px-3 py-2 text-left">经验</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {enemies.map(enemy => (
              <tr key={enemy.key} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{enemy.key}</td>
                <td className="px-3 py-2 font-medium">{enemy.name}</td>
                <td className="px-3 py-2 text-text-secondary">{enemy.mapKey}</td>
                <td className="px-3 py-2">{enemy.baseHealth}</td>
                <td className="px-3 py-2 text-accent-red">{enemy.statWeights.strength}</td>
                <td className="px-3 py-2 text-accent-blue">{enemy.statWeights.intelligence}</td>
                <td className="px-3 py-2 text-accent-green">{enemy.statWeights.agility}</td>
                <td className="px-3 py-2 text-accent-orange">{enemy.statWeights.vitality}</td>
                <td className="px-3 py-2 text-accent-orange">{enemy.goldDrop}</td>
                <td className="px-3 py-2 text-accent-blue">{enemy.expDrop}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(enemy)} className="text-accent-blue text-xs mr-2">编辑</button>
                  <button onClick={() => deleteEnemy(enemy.key)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || showNew) && (
        <EnemyEditor
          enemy={editing}
          onSave={saveEnemy}
          onClose={() => { setEditing(null); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function EnemyEditor({ enemy, onSave, onClose }: { enemy: EnemyTemplate | null; onSave: (e: EnemyTemplate) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    key: enemy?.key || '',
    name: enemy?.name || '',
    mapKey: enemy?.mapKey || 'plains',
    baseHealth: enemy?.baseHealth || 50,
    strength: enemy?.statWeights.strength || 1,
    intelligence: enemy?.statWeights.intelligence || 1,
    agility: enemy?.statWeights.agility || 1,
    vitality: enemy?.statWeights.vitality || 1,
    goldDrop: enemy?.goldDrop || 5,
    expDrop: enemy?.expDrop || 5,
    fixedSkillKeysStr: (enemy?.fixedSkillKeys || ['slash']).join(','),
    attackCap: enemy?.skillCaps.attack || 2,
    spellCap: enemy?.skillCaps.spell || 0,
    guardCap: enemy?.skillCaps.guard || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{enemy ? '编辑怪物' : '新增怪物'}</h3>
        <div className="space-y-3">
          <Field label="Key" value={form.key} onChange={v => setForm({ ...form, key: v })} disabled={!!enemy} />
          <Field label="名称" value={form.name} onChange={v => setForm({ ...form, name: v })} />
          <SelectField label="地图" value={form.mapKey} options={MAP_KEYS} onChange={v => setForm({ ...form, mapKey: v })} />
          <Field label="基础血量" type="number" value={String(form.baseHealth)} onChange={v => setForm({ ...form, baseHealth: Number(v) })} />

          <div className="grid grid-cols-2 gap-2">
            <Field label="力量权重" type="number" value={String(form.strength)} onChange={v => setForm({ ...form, strength: Number(v) })} />
            <Field label="智力权重" type="number" value={String(form.intelligence)} onChange={v => setForm({ ...form, intelligence: Number(v) })} />
            <Field label="敏捷权重" type="number" value={String(form.agility)} onChange={v => setForm({ ...form, agility: Number(v) })} />
            <Field label="体力权重" type="number" value={String(form.vitality)} onChange={v => setForm({ ...form, vitality: Number(v) })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="金币掉落" type="number" value={String(form.goldDrop)} onChange={v => setForm({ ...form, goldDrop: Number(v) })} />
            <Field label="经验掉落" type="number" value={String(form.expDrop)} onChange={v => setForm({ ...form, expDrop: Number(v) })} />
          </div>

          <Field label="技能 (逗号分隔)" value={form.fixedSkillKeysStr} onChange={v => setForm({ ...form, fixedSkillKeysStr: v })} />

          <div className="grid grid-cols-3 gap-2">
            <Field label="攻击上限" type="number" value={String(form.attackCap)} onChange={v => setForm({ ...form, attackCap: Number(v) })} />
            <Field label="法术上限" type="number" value={String(form.spellCap)} onChange={v => setForm({ ...form, spellCap: Number(v) })} />
            <Field label="防御上限" type="number" value={String(form.guardCap)} onChange={v => setForm({ ...form, guardCap: Number(v) })} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
          <button
            onClick={() => {
              onSave({
                key: form.key,
                name: form.name,
                mapKey: form.mapKey,
                baseHealth: form.baseHealth,
                statWeights: { strength: form.strength, intelligence: form.intelligence, agility: form.agility, vitality: form.vitality },
                fixedSkillKeys: form.fixedSkillKeysStr.split(',').map(s => s.trim()).filter(Boolean),
                skillCaps: { attack: form.attackCap, spell: form.spellCap, guard: form.guardCap },
                goldDrop: form.goldDrop,
                expDrop: form.expDrop,
              });
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

function Field({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary disabled:opacity-50"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
