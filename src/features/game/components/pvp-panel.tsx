'use client';

import React from 'react';
import type { SessionSnapshot, PvpChallengeResult } from '../types';
import { SectionCard } from './ui/section-card';
import { CommandButton } from './ui/command-button';
import { StatusChip } from './ui/status-chip';
import { formatNumber } from '@/lib/game-config';

interface PvpPanelProps {
  snapshot: SessionSnapshot;
  onChallenge: (targetRoleId: number) => void;
  pvpResult: PvpChallengeResult | null;
  onDismissResult: () => void;
}

function PvpResultOverlay({ result, onDismiss }: { result: PvpChallengeResult; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onDismiss}>
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-6 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-3xl mb-2">{result.challengerWins ? '🎉' : '💀'}</div>
        <div className="text-lg font-bold mb-1" style={{ color: result.challengerWins ? '#3fb950' : '#f85149' }}>
          {result.challengerWins ? '胜利！' : '战败...'}
        </div>
        <div className="text-sm text-text-secondary mb-3">vs {result.defenderName}</div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-bg-tertiary rounded p-2">
            <div className="text-xs text-text-muted">评分变化</div>
            <div className={`text-sm font-bold ${result.ratingChange > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {result.ratingChange > 0 ? '+' : ''}{result.ratingChange}
            </div>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <div className="text-xs text-text-muted">新评分</div>
            <div className="text-sm font-bold text-accent-purple">{result.challengerNewRating}</div>
          </div>
        </div>
        {result.goldReward > 0 && (
          <div className="text-sm text-accent-orange mb-3">💰 获得 {formatNumber(result.goldReward)} 金币</div>
        )}
        <button onClick={onDismiss} className="px-6 py-1.5 text-sm bg-accent-blue text-white rounded hover:brightness-110">
          确定
        </button>
      </div>
    </div>
  );
}

export function PvpPanel({ snapshot, onChallenge, pvpResult, onDismissResult }: PvpPanelProps) {
  const { pvp } = snapshot;

  return (
    <>
      {pvpResult && <PvpResultOverlay result={pvpResult} onDismiss={onDismissResult} />}
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
    </>
  );
}
