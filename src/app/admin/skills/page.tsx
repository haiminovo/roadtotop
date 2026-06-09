'use client';

import React from 'react';
import { SectionCard } from '@/features/game/components/ui/section-card';

export default function SkillsAdmin() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">技能管理</h2>
      <SectionCard>
        <p className="text-text-muted text-sm">技能配置通过「系统参数」页面的 JSON 编辑器管理。</p>
        <p className="text-text-muted text-xs mt-2">支持 attack/spell/guard 三种类型，可配置伤害、冷却、效果等。</p>
      </SectionCard>
    </div>
  );
}
