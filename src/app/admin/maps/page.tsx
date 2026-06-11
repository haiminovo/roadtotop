'use client';

import React, { useEffect, useState } from 'react';

interface MapConfig {
  key: string;
  name: string;
  description: string;
  levelRequired: number;
  goldPerTask: number;
  expPerTask: number;
  aetherPerTask: number;
}

export default function MapsAdmin() {
  const [maps, setMaps] = useState<MapConfig[]>([]);
  const [editing, setEditing] = useState<MapConfig | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadMaps(); }, []);

  async function loadMaps() {
    const res = await fetch('/api/admin/config?action=maps');
    const data = await res.json();
    setMaps(data.maps || []);
  }

  async function saveMap(map: MapConfig) {
    const isNew = !maps.find(m => m.key === map.key);
    const updated = isNew ? [...maps, map] : maps.map(m => m.key === map.key ? map : m);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_maps', maps: updated }),
    });
    loadMaps();
    setEditing(null);
    setShowNew(false);
  }

  async function deleteMap(key: string) {
    if (!confirm('确定删除？')) return;
    const updated = maps.filter(m => m.key !== key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_maps', maps: updated }),
    });
    loadMaps();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">地图管理</h2>
        <button onClick={() => setShowNew(true)} className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm">
          新增地图
        </button>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">描述</th>
              <th className="px-3 py-2 text-left">等级要求</th>
              <th className="px-3 py-2 text-left">金币/次</th>
              <th className="px-3 py-2 text-left">经验/次</th>
              <th className="px-3 py-2 text-left">水晶/次</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {maps.map(m => (
              <tr key={m.key} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{m.key}</td>
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 text-text-secondary text-xs">{m.description}</td>
                <td className="px-3 py-2">Lv.{m.levelRequired}</td>
                <td className="px-3 py-2 text-accent-orange">{m.goldPerTask}</td>
                <td className="px-3 py-2 text-accent-blue">{m.expPerTask}</td>
                <td className="px-3 py-2 text-accent-purple">{m.aetherPerTask}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(m)} className="text-accent-blue text-xs mr-2">编辑</button>
                  <button onClick={() => deleteMap(m.key)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || showNew) && (
        <MapEditor map={editing} onSave={saveMap} onClose={() => { setEditing(null); setShowNew(false); }} />
      )}
    </div>
  );
}

function MapEditor({ map, onSave, onClose }: { map: MapConfig | null; onSave: (m: MapConfig) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    key: map?.key || '',
    name: map?.name || '',
    description: map?.description || '',
    levelRequired: map?.levelRequired || 1,
    goldPerTask: map?.goldPerTask || 5,
    expPerTask: map?.expPerTask || 5,
    aetherPerTask: map?.aetherPerTask || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{map ? '编辑地图' : '新增地图'}</h3>
        <div className="space-y-3">
          <Field label="Key" value={form.key} onChange={v => setForm({ ...form, key: v })} disabled={!!map} />
          <Field label="名称" value={form.name} onChange={v => setForm({ ...form, name: v })} />
          <Field label="描述" value={form.description} onChange={v => setForm({ ...form, description: v })} />
          <Field label="等级要求" type="number" value={String(form.levelRequired)} onChange={v => setForm({ ...form, levelRequired: Number(v) })} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="金币/次" type="number" value={String(form.goldPerTask)} onChange={v => setForm({ ...form, goldPerTask: Number(v) })} />
            <Field label="经验/次" type="number" value={String(form.expPerTask)} onChange={v => setForm({ ...form, expPerTask: Number(v) })} />
            <Field label="水晶/次" type="number" value={String(form.aetherPerTask)} onChange={v => setForm({ ...form, aetherPerTask: Number(v) })} />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
          <button onClick={() => onSave(form)} className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm">保存</button>
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
