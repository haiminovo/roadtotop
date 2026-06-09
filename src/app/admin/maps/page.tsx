'use client';

import React from 'react';
import { SectionCard } from '@/features/game/components/ui/section-card';

export default function MapsAdmin() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">地图管理</h2>
      <SectionCard>
        <p className="text-text-muted text-sm">地图配置通过「系统参数」页面的 JSON 编辑器管理。</p>
        <p className="text-text-muted text-xs mt-2">每张地图可配置等级要求、金币/经验/水晶产出。</p>
      </SectionCard>
    </div>
  );
}
