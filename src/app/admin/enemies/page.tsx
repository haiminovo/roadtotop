'use client';

import React, { useEffect, useState } from 'react';
import { SectionCard } from '@/features/game/components/ui/section-card';

export default function EnemiesAdmin() {
  const [enemies, setEnemies] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadEnemies(); }, []);

  async function loadEnemies() {
    const res = await fetch('/api/admin/config?action=items');
    const data = await res.json();
    // enemies from game_config
    const configRes = await fetch('/api/admin/config?action=system_balance');
    // We'll load from a dedicated endpoint later
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">怪物管理</h2>
        <button onClick={() => setShowNew(true)} className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm">
          新增怪物
        </button>
      </div>
      <SectionCard>
        <p className="text-text-muted text-sm">怪物配置通过「系统参数」页面的 JSON 编辑器管理，或通过 API 批量导入。</p>
        <p className="text-text-muted text-xs mt-2">后续版本将提供可视化编辑器。</p>
      </SectionCard>
    </div>
  );
}
