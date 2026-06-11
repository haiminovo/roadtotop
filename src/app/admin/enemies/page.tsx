'use client';

import React, { useEffect, useState } from 'react';

interface EnemyTemplate {
  key: string;
  name: string;
  mapKey: string;
  baseHealth: number;
  goldDrop: number;
  expDrop: number;
}

export default function EnemiesAdmin() {
  const [enemies, setEnemies] = useState<EnemyTemplate[]>([]);
  const [editing, setEditing] = useState<EnemyTemplate | null>(null);
  const [jsonStr, setJsonStr] = useState('');

  useEffect(() => { loadEnemies(); }, []);

  async function loadEnemies() {
    const res = await fetch('/api/admin/config?action=items');
    const data = await res.json();
    // Load from game_config
    const configRes = await fetch('/api/admin/config?action=system_balance');
    // For now, load enemies from a custom endpoint
    const enemyRes = await fetch('/api/admin/config?action=enemies');
    const enemyData = await enemyRes.json();
    setEnemies(enemyData.enemies || []);
  }

  async function saveEnemies() {
    try {
      const parsed = JSON.parse(jsonStr);
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_enemies', enemies: parsed }),
      });
      loadEnemies();
      setEditing(null);
    } catch { alert('JSON 格式错误'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">怪物管理</h2>
        <button
          onClick={() => { setJsonStr(JSON.stringify(enemies, null, 2)); setEditing({ key: '', name: '', mapKey: '', baseHealth: 0, goldDrop: 0, expDrop: 0 }); }}
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
              <th className="px-3 py-2 text-left">地图</th>
              <th className="px-3 py-2 text-left">基础血量</th>
              <th className="px-3 py-2 text-left">金币掉落</th>
              <th className="px-3 py-2 text-left">经验掉落</th>
            </tr>
          </thead>
          <tbody>
            {enemies.map(e => (
              <tr key={e.key} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{e.key}</td>
                <td className="px-3 py-2 font-medium">{e.name}</td>
                <td className="px-3 py-2 text-text-secondary">{e.mapKey}</td>
                <td className="px-3 py-2">{e.baseHealth}</td>
                <td className="px-3 py-2 text-accent-orange">{e.goldDrop}</td>
                <td className="px-3 py-2 text-accent-blue">{e.expDrop}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">编辑怪物配置 (JSON)</h3>
            <textarea
              value={jsonStr}
              onChange={e => setJsonStr(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded font-mono h-96"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(null)} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
              <button onClick={saveEnemies} className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
