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

  return (
    <div className="space-y-3">
      {/* 当前状态 */}
      <SectionCard title="挂机状态">
        <div className="flex items-center gap-2 mb-3">
          <StatusChip status={statusLabel} variant={statusVariant} />
          {afk.status !== 'idle' && (
            <span className="text-xs text-text-muted">
              {config.maps.find(m => m.key === afk.mapKey)?.name || afk.mapKey}
            </span>
          )}
        </div>

        {/* 挂机进度条 */}
        {afk.status === 'afk' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-muted">挂机进度</span>
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

        {/* 待领取奖励 */}
        {(afk.pendingReward.gold > 0 || afk.pendingReward.aether > 0 || afk.pendingReward.exp > 0) && (
          <div className="mb-3 p-2 rounded bg-bg-tertiary border border-accent-green/30">
            <div className="text-xs text-accent-green mb-1">待领取奖励</div>
            <div className="flex gap-3 text-xs">
              {afk.pendingReward.gold > 0 && <span className="text-accent-orange">金币 +{formatNumber(afk.pendingReward.gold)}</span>}
              {afk.pendingReward.aether > 0 && <span className="text-accent-purple">水晶 +{formatNumber(afk.pendingReward.aether)}</span>}
              {afk.pendingReward.exp > 0 && <span className="text-accent-blue">经验 +{formatNumber(afk.pendingReward.exp)}</span>}
            </div>
            <CommandButton size="sm" variant="success" onClick={onClaim} className="mt-2 w-full">
              领取奖励
            </CommandButton>
          </div>
        )}

        {/* 每小时收益预估 */}
        {afk.status !== 'idle' && (
          <div className="text-xs text-text-muted">
            预估每小时：
            <span className="text-accent-orange ml-1">金 {formatNumber(afk.estimatedHourlyReward.gold)}</span>
            <span className="text-accent-purple ml-2">水晶 {formatNumber(afk.estimatedHourlyReward.aether)}</span>
            <span className="text-accent-blue ml-2">经验 {formatNumber(afk.estimatedHourlyReward.exp)}</span>
          </div>
        )}
      </SectionCard>

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

      {/* 活动选择 */}
      {afk.status === 'idle' && (
        <SectionCard title="选择活动">
          <div className="flex gap-2">
            {config.activities.map(activity => (
              <button
                key={activity.key}
                className="flex-1 p-2 rounded bg-bg-tertiary border border-border-primary hover:bg-bg-hover text-center transition-colors"
              >
                <div className="text-sm font-medium text-text-primary">{activity.name}</div>
                <div className="text-xs text-text-muted mt-0.5">{activity.description}</div>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* 地图选择 */}
      <SectionCard title="选择地图">
        <div className="space-y-1.5">
          {config.maps.map(map => {
            const unlocked = role.level >= map.levelRequired;
            const isActive = afk.status !== 'idle' && afk.mapKey === map.key;
            return (
              <div
                key={map.key}
                className={`flex items-center justify-between p-2 rounded border ${
                  isActive
                    ? 'bg-accent-green/10 border-accent-green/30'
                    : unlocked
                      ? 'bg-bg-tertiary border-border-primary'
                      : 'bg-bg-secondary border-border-secondary opacity-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{map.name}</span>
                    {isActive && <StatusChip status="挂机中" variant="success" />}
                  </div>
                  <div className="text-xs text-text-muted">
                    {map.description} · 需要Lv.{map.levelRequired}
                  </div>
                  <div className="text-xs mt-0.5">
                    <span className="text-accent-orange">金+{map.goldPerTask}</span>
                    <span className="text-accent-blue ml-2">EXP+{map.expPerTask}</span>
                    {map.aetherPerTask > 0 && <span className="text-accent-purple ml-2">水晶+{map.aetherPerTask}</span>}
                  </div>
                </div>
                {unlocked && afk.status === 'idle' && (
                  <CommandButton size="sm" variant="primary" onClick={() => onStart('combat', map.key)}>
                    开始
                  </CommandButton>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 操作按钮 */}
      {afk.status !== 'idle' && (
        <CommandButton variant="danger" onClick={onStop} className="w-full">
          停止挂机
        </CommandButton>
      )}
    </div>
  );
}
