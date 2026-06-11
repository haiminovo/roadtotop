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
  const [editing, setEditing] = useState(false);
  const [jsonStr, setJsonStr] = useState('');

  useEffect(() => { loadMaps(); }, []);

  async function loadMaps() {
    const res = await fetch('/api/admin/config?action=maps');
    const data = await res.json();
    setMaps(data.maps || []);
  }

  async function saveMaps() {
    try {
      const parsed = JSON.parse(jsonStr);
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_maps', maps: parsed }),
      });
      loadMaps();
      setEditing(false);
    } catch { alert('JSON 格式错误'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">地图管理</h2>
        <button
          onClick={() => { setJsonStr(JSON.stringify(maps, null, 2)); setEditing(true); }}
          className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm"
        >
          编辑 JSON
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">编辑地图配置 (JSON)</h3>
            <textarea
              value={jsonStr}
              onChange={e => setJsonStr(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded font-mono h-96"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
              <button onClick={saveMaps} className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
