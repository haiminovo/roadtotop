'use client';

import React, { useEffect, useState } from 'react';

interface EventRule {
  key: string;
  trigger: { type: string; mapKey?: string; activityKey?: string };
  encounter: { tier: string; title: string; description: string };
  actions: { type: string; chance: number; min?: number; max?: number }[];
}

export default function EventsAdmin() {
  const [rules, setRules] = useState<EventRule[]>([]);
  const [editing, setEditing] = useState(false);
  const [jsonStr, setJsonStr] = useState('');

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    const res = await fetch('/api/admin/config?action=event_rules');
    const data = await res.json();
    setRules(data.rules || []);
  }

  async function saveRules() {
    try {
      const parsed = JSON.parse(jsonStr);
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_event_rules', rules: parsed }),
      });
      loadRules();
      setEditing(false);
    } catch { alert('JSON 格式错误'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">事件规则管理</h2>
        <button
          onClick={() => { setJsonStr(JSON.stringify(rules, null, 2)); setEditing(true); }}
          className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm"
        >
          编辑 JSON
        </button>
      </div>

      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.key} className="bg-bg-secondary border border-border-primary rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-text-primary">{rule.key}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">{rule.trigger.type}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                rule.encounter.tier === 'legendary' ? 'bg-accent-orange/20 text-accent-orange' :
                rule.encounter.tier === 'rare' ? 'bg-accent-green/20 text-accent-green' :
                'bg-bg-tertiary text-text-muted'
              }`}>{rule.encounter.tier}</span>
            </div>
            <div className="text-xs text-text-muted">{rule.encounter.title} - {rule.encounter.description}</div>
            <div className="text-xs text-text-secondary mt-1">
              动作: {rule.actions.map(a => `${a.type}(${(a.chance * 100).toFixed(0)}%)`).join(', ')}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">编辑事件规则 (JSON)</h3>
            <textarea
              value={jsonStr}
              onChange={e => setJsonStr(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded font-mono h-96"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
              <button onClick={saveRules} className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
