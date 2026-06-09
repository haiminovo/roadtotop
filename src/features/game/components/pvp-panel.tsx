'use client';

import React from 'react';
import type { SessionSnapshot } from '../types';
import { SectionCard } from './ui/section-card';
import { CommandButton } from './ui/command-button';
import { StatusChip } from './ui/status-chip';
import { formatNumber } from '@/lib/game-config';

interface PvpPanelProps {
  snapshot: SessionSnapshot;
  onChallenge: (targetRoleId: number) => void;
}

export function PvpPanel({ snapshot, onChallenge }: PvpPanelProps) {
  const { pvp } = snapshot;

  return (
    <div className="space-y-3">
      {/* PVP 状态 */}
      <SectionCard title="PVP 竞技场">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <div className="text-lg font-bold text-accent-purple">{pvp.rating}</div>
            <div className="text-xs text-text-muted">评分</div>
          </div>
          <div>
            <div className="text-lg font-bold text-accent-green">{pvp.wins}</div>
            <div className="text-xs text-text-muted">胜利</div>
          </div>
          <div>
            <div className="text-lg font-bold text-accent-red">{pvp.losses}</div>
            <div className="text-xs text-text-muted">失败</div>
          </div>
        </div>
      </SectionCard>

      {/* 排行榜 */}
      <SectionCard title="排行榜">
        <div className="space-y-1">
          {pvp.leaderboard.map(entry => (
            <div
              key={entry.roleId}
              className="flex items-center gap-2 p-1.5 rounded bg-bg-tertiary text-xs"
            >
              <span className={`w-5 text-center font-bold ${
                entry.rank <= 3 ? 'text-accent-orange' : 'text-text-muted'
              }`}>
                {entry.rank}
              </span>
              <span className="flex-1 text-text-primary">{entry.name}</span>
              <span className="text-text-muted">Lv.{entry.level}</span>
              <span className="text-accent-purple font-medium w-12 text-right">{entry.rating}</span>
              {entry.roleId !== snapshot.role.roleId && (
                <CommandButton size="sm" variant="primary" onClick={() => onChallenge(entry.roleId)}>
                  挑战
                </CommandButton>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 最近战斗 */}
      {pvp.recentBattles.length > 0 && (
        <SectionCard title="最近战斗">
          <div className="space-y-1">
            {pvp.recentBattles.map(battle => (
              <div key={battle.battleId} className="flex items-center gap-2 p-1.5 rounded bg-bg-tertiary text-xs">
                <StatusChip
                  status={battle.result === 'win' ? '胜利' : '失败'}
                  variant={battle.result === 'win' ? 'success' : 'danger'}
                />
                <span className="flex-1 text-text-primary">vs {battle.opponentName} (Lv.{battle.opponentLevel})</span>
                <span className={battle.ratingChange > 0 ? 'text-accent-green' : 'text-accent-red'}>
                  {battle.ratingChange > 0 ? '+' : ''}{battle.ratingChange}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
