'use client';

import React from 'react';
import type { SessionSnapshot, ActivityKey } from '../types';
import { SectionCard } from './ui/section-card';
import { CommandButton } from './ui/command-button';
import { StatusChip } from './ui/status-chip';
import { BattleView } from './battle-view';
import { formatNumber } from '@/lib/game-config';

interface AfkPanelProps {
  snapshot: SessionSnapshot;
  onStart: (activityKey: ActivityKey, mapKey: string) => void;
  onStop: () => void;
  onClaim: () => void;
}

export function AfkPanel({ snapshot, onStart, onStop, onClaim }: AfkPanelProps) {
  const { afk, config, role } = snapshot;

  const statusLabel = afk.status === 'idle' ? '空闲' : afk.status === 'afk' ? '挂机中' : '战斗中';
  const statusVariant = afk.status === 'idle' ? 'default' : afk.status === 'afk' ? 'success' : 'danger';

  const currentMap = config.maps.find(m => m.key === afk.mapKey);

  return (
    <div className="space-y-3">
      {/* 当前挂机状态 */}
      {afk.status !== 'idle' && (
        <SectionCard title="挂机状态">
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={statusLabel} variant={statusVariant} />
            <span className="text-xs text-text-muted">{currentMap?.name || afk.mapKey}</span>
          </div>

          {/* 挂机进度条 */}
          {afk.status === 'afk' && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-muted">任务进度</span>
                <span className="text-text-secondary">{afk.accruedSeconds}s / 10s</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill bg-accent-green"
                  style={{ width: `${(afk.accruedSeconds / 10) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 实时收益统计 */}
          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div className="bg-bg-tertiary rounded p-1.5">
              <div className="text-xs text-text-muted">金币</div>
              <div className="text-sm font-bold text-accent-orange">{formatNumber(afk.pendingReward.gold)}</div>
            </div>
            <div className="bg-bg-tertiary rounded p-1.5">
              <div className="text-xs text-text-muted">水晶</div>
              <div className="text-sm font-bold text-accent-purple">{formatNumber(afk.pendingReward.aether)}</div>
            </div>
            <div className="bg-bg-tertiary rounded p-1.5">
              <div className="text-xs text-text-muted">经验</div>
              <div className="text-sm font-bold text-accent-blue">{formatNumber(afk.pendingReward.exp)}</div>
            </div>
          </div>

          {/* 每小时收益预估 */}
          <div className="text-xs text-text-muted">
            预估每小时：
            <span className="text-accent-orange ml-1">金 {formatNumber(afk.estimatedHourlyReward.gold)}</span>
            <span className="text-accent-purple ml-2">水晶 {formatNumber(afk.estimatedHourlyReward.aether)}</span>
            <span className="text-accent-blue ml-2">经验 {formatNumber(afk.estimatedHourlyReward.exp)}</span>
          </div>

          <CommandButton variant="danger" onClick={onStop} className="w-full mt-2">
            停止挂机
          </CommandButton>
        </SectionCard>
      )}

      {/* 战斗实时视图 */}
      {afk.battle && (
        <BattleView battle={afk.battle} />
      )}

      {/* 最近遭遇 */}
      {afk.recentEncounters.length > 0 && (
        <SectionCard title="最近遭遇">
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {afk.recentEncounters.slice().reverse().map((enc, i) => (
              <div key={i} className="text-xs flex items-center gap-1">
                <StatusChip
                  status={enc.tier === 'legendary' ? '传说' : enc.tier === 'rare' ? '稀有' : '普通'}
                  variant={enc.tier === 'legendary' ? 'warning' : enc.tier === 'rare' ? 'success' : 'default'}
                />
                <span className="text-text-primary">{enc.title}</span>
                <span className="text-text-muted">- {enc.description}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 地图选择（空闲时显示） */}
      {afk.status === 'idle' && (
        <SectionCard title="选择地图开始挂机">
          <div className="space-y-1.5">
            {config.maps.map(map => {
              const unlocked = role.level >= map.levelRequired;
              return (
                <div
                  key={map.key}
                  className={`flex items-center justify-between p-2 rounded border ${
                    unlocked
                      ? 'bg-bg-tertiary border-border-primary hover:bg-bg-hover cursor-pointer'
                      : 'bg-bg-secondary border-border-secondary opacity-50'
                  }`}
                  onClick={() => unlocked && onStart('combat', map.key)}
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">{map.name}</div>
                    <div className="text-xs text-text-muted">
                      {map.description} · 需要Lv.{map.levelRequired}
                    </div>
                    <div className="text-xs mt-0.5">
                      <span className="text-accent-orange">金+{map.goldPerTask}</span>
                      <span className="text-accent-blue ml-2">EXP+{map.expPerTask}</span>
                      {map.aetherPerTask > 0 && <span className="text-accent-purple ml-2">水晶+{map.aetherPerTask}</span>}
                    </div>
                  </div>
                  {unlocked && (
                    <span className="text-xs text-accent-blue">点击开始 →</span>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
