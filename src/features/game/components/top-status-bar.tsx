'use client';

import React from 'react';
import type { SessionSnapshot } from '../types';
import { formatNumber } from '@/lib/game-config';

interface TopStatusBarProps {
  snapshot: SessionSnapshot;
}

export function TopStatusBar({ snapshot }: TopStatusBarProps) {
  const { role } = snapshot;
  const expPercent = role.requiredExp > 0 ? (role.currentExp / role.requiredExp) * 100 : 0;

  return (
    <div className="px-3 py-1.5" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold" style={{ color: '#e6edf3' }}>{role.name}</span>
        <span style={{ color: '#8b949e' }}>Lv.{role.level}</span>
        {/* 经验条 */}
        <div className="flex items-center gap-1.5 flex-1 max-w-48">
          <span style={{ color: '#8b949e' }}>EXP</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${expPercent}%`, background: '#58a6ff' }} />
          </div>
          <span style={{ color: '#8b949e' }}>{formatNumber(role.currentExp)}/{formatNumber(role.requiredExp)}</span>
        </div>
        {/* 货币 */}
        <span style={{ color: '#d29922' }}>💰 {formatNumber(role.gold)}</span>
        <span style={{ color: '#bc8cff' }}>💎 {formatNumber(role.aetherCrystal)}</span>
      </div>
    </div>
  );
}
