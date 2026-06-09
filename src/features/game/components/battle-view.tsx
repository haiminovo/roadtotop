'use client';

import React from 'react';
import type { BattleSnapshot } from '../types';
import { SectionCard } from './ui/section-card';
import { StatusChip } from './ui/status-chip';

interface BattleViewProps {
  battle: BattleSnapshot;
}

export function BattleView({ battle }: BattleViewProps) {
  const playerHpPercent = (battle.playerHealth / battle.playerMaxHealth) * 100;
  const enemyHpPercent = (battle.enemyHealth / battle.enemyMaxHealth) * 100;

  return (
    <SectionCard title="⚔️ 战斗中" className="border-accent-red/30">
      <div className="space-y-3">
        {/* 敌人信息 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-accent-red">{battle.enemyName}</span>
            <span className="text-xs text-text-secondary">{battle.enemyHealth}/{battle.enemyMaxHealth}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-accent-red" style={{ width: `${enemyHpPercent}%` }} />
          </div>
          {/* 行动条 */}
          <div className="progress-bar mt-1">
            <div className="progress-bar-fill bg-accent-orange" style={{ width: `${battle.enemyActionPoints}%` }} />
          </div>
        </div>

        {/* 玩家信息 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-accent-green">你</span>
            <span className="text-xs text-text-secondary">{battle.playerHealth}/{battle.playerMaxHealth}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-accent-green" style={{ width: `${playerHpPercent}%` }} />
          </div>
          {/* 行动条 */}
          <div className="progress-bar mt-1">
            <div className="progress-bar-fill bg-accent-blue" style={{ width: `${battle.playerActionPoints}%` }} />
          </div>
        </div>

        {/* 战斗状态 */}
        <div className="flex gap-1 flex-wrap">
          {battle.playerEffects.map((eff, i) => (
            <StatusChip key={`p${i}`} status={`${eff.type} ${eff.duration}回合`} variant="success" />
          ))}
          {battle.enemyEffects.map((eff, i) => (
            <StatusChip key={`e${i}`} status={`${eff.type} ${eff.duration}回合`} variant="warning" />
          ))}
        </div>

        {/* 战斗日志 */}
        <div className="battle-log bg-bg-tertiary rounded p-2">
          {battle.logs.map((log, i) => (
            <div key={i} className={`py-0.5 ${
              log.type === 'damage' ? 'text-accent-red' :
              log.type === 'heal' ? 'text-accent-green' :
              'text-text-secondary'
            }`}>
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
