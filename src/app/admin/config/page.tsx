'use client';

import React, { useEffect, useState } from 'react';

interface SystemBalance {
  [key: string]: number;
}

export default function ConfigAdmin() {
  const [config, setConfig] = useState<SystemBalance>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/config?action=system_balance')
      .then(r => r.json())
      .then(data => setConfig(data.balance || {}))
      .catch(console.error);
  }, []);

  async function save() {
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_system_balance', balance: config }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const LABELS: Record<string, string> = {
    maxOfflineSeconds: '最大离线时间(秒)',
    afkTaskSeconds: '挂机任务间隔(秒)',
    levelCap: '等级上限',
    expPerLevel: '每级基础经验',
    expGrowthPerLevel: '经验增长/级',
    baseHealth: '基础生命值',
    healthPerVitality: '生命/体力',
    healthPerLevel: '生命/级',
    baseSkillSlots: '基础技能槽',
    baseSkillUsesPerBattle: '基础技能次数',
    maxActionPoints: '最大行动点',
    baseActionSpeed: '基础行动速度',
    marketFeePercent: '市场手续费(%)',
    pvpRatingKFactor: 'PVP K系数',
    pvpGoldReward: 'PVP 金币奖励',
    chatMaxLen: '聊天最大字数',
    chatCooldownSeconds: '聊天冷却(秒)',
    chatHistoryLimit: '聊天历史条数',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">系统参数</h2>
        <div className="flex items-center gap-2">
          {saved && <span className="text-accent-green text-sm">已保存</span>}
          <button onClick={save} className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm">
            保存配置
          </button>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(LABELS).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-text-muted block mb-1">{label}</label>
              <input
                type="number"
                value={config[key] ?? 0}
                onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
