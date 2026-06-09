'use client';

import React from 'react';
import { SectionCard } from '@/features/game/components/ui/section-card';

export default function EventsAdmin() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">事件规则管理</h2>
      <SectionCard>
        <p className="text-text-muted text-sm">事件规则通过「系统参数」页面的 JSON 编辑器管理。</p>
        <p className="text-text-muted text-xs mt-2">支持 afk_tick 和 enemy_kill 两种触发器类型，可配置奖励金币、水晶、经验、物品等。</p>
      </SectionCard>
    </div>
  );
}
