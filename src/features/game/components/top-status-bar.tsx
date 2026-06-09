'use client';

import React from 'react';
import type { SessionSnapshot } from '../types';
import { formatNumber } from '@/lib/game-config';
import { DataPill } from './ui/data-pill';

interface TopStatusBarProps {
  snapshot: SessionSnapshot;
}

export function TopStatusBar({ snapshot }: TopStatusBarProps) {
  const { role } = snapshot;
  const expPercent = (role.currentExp / role.requiredExp) * 100;
  const hpPercent = (role.currentHealth / role.secondaryStats.maxHealth) * 100;

  return (
    <div className="bg-bg-secondary border-b border-border-primary px-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* 角色基本信息 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-text-primary">{role.name}</span>
          <span className="text-xs text-text-muted">Lv.{role.level}</span>
          <span className="text-xs text-text-secondary">{role.raceKey} · {role.classKey}</span>
        </div>

        {/* 货币 */}
        <div className="flex items-center gap-2">
          <DataPill label="金币" value={formatNumber(role.gold)} color="var(--accent-orange)" />
          <DataPill label="水晶" value={formatNumber(role.aetherCrystal)} color="var(--accent-purple)" />
        </div>
      </div>

      {/* 状态条 */}
      <div className="mt-2 flex gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-text-muted">HP</span>
            <span className="text-text-secondary">{role.currentHealth}/{role.secondaryStats.maxHealth}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-accent-green" style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-text-muted">EXP</span>
            <span className="text-text-secondary">{role.currentExp}/{role.requiredExp}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-accent-blue" style={{ width: `${expPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
