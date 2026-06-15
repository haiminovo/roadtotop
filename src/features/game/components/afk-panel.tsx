'use client';

import React, { useState } from 'react';
import type { SessionSnapshot, ActivityKey } from '../types';
import { SectionCard } from './ui/section-card';
import { StatusChip } from './ui/status-chip';
import { BattleView } from './battle-view';
import { formatNumber } from '@/lib/game-config';

interface AfkPanelProps {
  snapshot: SessionSnapshot;
  onStart: (activityKey: ActivityKey, mapKey: string) => void;
  onStop: () => void;
  onClaim: () => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  combat: '⚔️',
  gathering: '⛏️',
  fishing: '🎣',
};

export function AfkPanel({ snapshot, onStart, onStop, onClaim }: AfkPanelProps) {
  const { afk, config, role } = snapshot;
  const [selectedActivity, setSelectedActivity] = useState<ActivityKey | ''>('');

  const statusLabel = afk.status === 'idle' ? '空闲' : afk.status === 'afk' ? '挂机中' : '战斗中';
  const statusVariant = afk.status === 'idle' ? 'default' : afk.status === 'afk' ? 'success' : 'danger';
  const currentMap = config.maps.find(m => m.key === afk.mapKey);
  const currentActivity = config.activities.find(a => a.key === afk.activityKey);

  return (
    <div className="space-y-3">
      {/* 当前挂机状态 */}
      {afk.status !== 'idle' && (
        <SectionCard
          title="当前活动"
          action={
            <button onClick={onStop} className="text-xs text-accent-red hover:text-accent-red/80 px-2 py-0.5 rounded hover:bg-accent-red/10">
              停止
            </button>
          }
        >
          <div className="flex items-center gap-2 mb-2">
            <StatusChip status={statusLabel} variant={statusVariant} />
            <span className="text-xs text-text-muted">
              {ACTIVITY_ICONS[afk.activityKey] || ''} {currentActivity?.name || afk.activityKey}
            </span>
            <span className="text-xs text-text-muted">·</span>
            <span className="text-xs text-text-muted">{currentMap?.name || afk.mapKey}</span>
          </div>

          {/* 挂机进度条 */}
          {(afk.status === 'afk' || afk.status === 'battle') && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-muted">任务进度</span>
                <span className="text-text-secondary">{afk.accruedSeconds}s / 10s</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(afk.accruedSeconds / 10) * 100}%`, background: '#3fb950' }}
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

          <div className="text-xs text-text-muted">
            预估每小时：
            <span className="text-accent-orange ml-1">金 {formatNumber(afk.estimatedHourlyReward.gold)}</span>
            <span className="text-accent-purple ml-2">水晶 {formatNumber(afk.estimatedHourlyReward.aether)}</span>
            <span className="text-accent-blue ml-2">经验 {formatNumber(afk.estimatedHourlyReward.exp)}</span>
          </div>
        </SectionCard>
      )}

      {/* 战斗视图 */}
      {afk.battle && <BattleView battle={afk.battle} classKey={snapshot.role.classKey} />}



      {/* 选择活动（空闲时显示） */}
      {afk.status === 'idle' && (
        <>
          {/* 第一步：选择活动类型 */}
          {!selectedActivity && (
            <SectionCard title="选择活动">
              <div className="space-y-2">
                {config.activities.map(activity => (
                  <button
                    key={activity.key}
                    onClick={() => setSelectedActivity(activity.key as ActivityKey)}
                    className="w-full flex items-center gap-3 p-3 rounded bg-bg-tertiary border border-border-primary hover:bg-bg-hover cursor-pointer transition-colors text-left"
                  >
                    <span className="text-2xl">{ACTIVITY_ICONS[activity.key] || '📋'}</span>
                    <div>
                      <div className="text-sm font-medium text-text-primary">{activity.name}</div>
                      <div className="text-xs text-text-muted">{activity.description}</div>
                    </div>
                    <span className="ml-auto text-xs text-accent-blue">→</span>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* 第二步：选择地图 */}
          {selectedActivity && (
            <SectionCard
              title={`${ACTIVITY_ICONS[selectedActivity] || ''} ${config.activities.find(a => a.key === selectedActivity)?.name || ''} - 选择地图`}
              action={
                <button onClick={() => setSelectedActivity('')} className="text-xs text-text-muted hover:text-text-secondary px-2 py-0.5 rounded hover:bg-bg-hover">
                  ← 返回
                </button>
              }
            >
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
                      onClick={() => unlocked && onStart(selectedActivity, map.key)}
                    >
                      <div>
                        <div className="text-sm font-medium text-text-primary">{map.name}</div>
                        <div className="text-xs text-text-muted">{map.description} · 需要Lv.{map.levelRequired}</div>
                        <div className="text-xs mt-0.5">
                          <span className="text-accent-orange">金+{map.goldPerTask}</span>
                          <span className="text-accent-blue ml-2">EXP+{map.expPerTask}</span>
                          {map.aetherPerTask > 0 && <span className="text-accent-purple ml-2">水晶+{map.aetherPerTask}</span>}
                        </div>
                      </div>
                      {unlocked && <span className="text-xs text-accent-blue">点击开始 →</span>}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
