'use client';

import React, { useRef, useEffect } from 'react';
import type { BattleSnapshot } from '../types';

interface BattleViewProps {
  battle: BattleSnapshot;
}

const LOG_COLORS: Record<string, string> = {
  damage: 'text-accent-red',
  heal: 'text-accent-green',
  effect: 'text-accent-purple',
  info: 'text-accent-blue',
};

const LOG_ICONS: Record<string, string> = {
  damage: '⚔️',
  heal: '💚',
  effect: '✨',
  info: '📢',
};

export function BattleView({ battle }: BattleViewProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [battle.logs]);

  const playerHpPercent = (battle.playerHealth / battle.playerMaxHealth) * 100;
  const enemyHpPercent = (battle.enemyHealth / battle.enemyMaxHealth) * 100;

  const playerHpColor = playerHpPercent > 60 ? 'bg-accent-green' : playerHpPercent > 30 ? 'bg-accent-orange' : 'bg-accent-red';
  const enemyHpColor = enemyHpPercent > 60 ? 'bg-accent-red' : enemyHpPercent > 30 ? 'bg-accent-orange' : 'bg-accent-red';

  return (
    <div className="bg-bg-secondary border border-accent-red/30 rounded-lg overflow-hidden">
      {/* 战斗标题 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-accent-red/10 border-b border-accent-red/20">
        <span className="text-sm font-bold text-accent-red">⚔️ 战斗中</span>
        <span className="text-xs text-text-muted">
          {battle.result === 'ongoing' ? '进行中...' : battle.result === 'win' ? '🎉 胜利！' : '💀 战败...'}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* 对战区域 */}
        <div className="flex items-stretch gap-3">
          {/* 玩家侧 */}
          <div className="flex-1 bg-bg-tertiary rounded-lg p-2 border border-accent-green/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center text-sm">
                🧙
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-accent-green truncate">你</div>
                <div className="text-[10px] text-text-muted">
                  力{battle.playerMaxHealth > 0 ? Math.floor(battle.playerMaxHealth * 0.1) : 0}
                </div>
              </div>
            </div>
            {/* 血条 */}
            <div className="mb-1">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-text-muted">HP</span>
                <span className="text-text-secondary">{battle.playerHealth}/{battle.playerMaxHealth}</span>
              </div>
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${playerHpColor}`}
                  style={{ width: `${playerHpPercent}%` }}
                />
              </div>
            </div>
            {/* 行动条 */}
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-text-muted">行动</span>
                <span className="text-text-secondary">{battle.playerActionPoints}%</span>
              </div>
              <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-blue transition-all duration-200"
                  style={{ width: `${battle.playerActionPoints}%` }}
                />
              </div>
            </div>
            {/* 状态效果 */}
            {battle.playerEffects.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {battle.playerEffects.map((eff, i) => (
                  <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-accent-purple/20 text-accent-purple">
                    {eff.type} {eff.duration}s
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* VS 分隔 */}
          <div className="flex items-center">
            <span className="text-lg font-black text-text-muted">VS</span>
          </div>

          {/* 敌人侧 */}
          <div className="flex-1 bg-bg-tertiary rounded-lg p-2 border border-accent-red/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-accent-red/20 flex items-center justify-center text-sm">
                👹
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-accent-red truncate">{battle.enemyName}</div>
                <div className="text-[10px] text-text-muted">
                  力{Math.floor(battle.enemyStats.strength)}
                </div>
              </div>
            </div>
            {/* 血条 */}
            <div className="mb-1">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-text-muted">HP</span>
                <span className="text-text-secondary">{battle.enemyHealth}/{battle.enemyMaxHealth}</span>
              </div>
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${enemyHpColor}`}
                  style={{ width: `${enemyHpPercent}%` }}
                />
              </div>
            </div>
            {/* 行动条 */}
            <div>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-text-muted">行动</span>
                <span className="text-text-secondary">{battle.enemyActionPoints}%</span>
              </div>
              <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-orange transition-all duration-200"
                  style={{ width: `${battle.enemyActionPoints}%` }}
                />
              </div>
            </div>
            {/* 状态效果 */}
            {battle.enemyEffects.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {battle.enemyEffects.map((eff, i) => (
                  <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-accent-orange/20 text-accent-orange">
                    {eff.type} {eff.duration}s
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 战斗日志 */}
        <div
          ref={logRef}
          className="bg-bg-primary rounded-lg p-2 max-h-28 overflow-y-auto space-y-0.5"
        >
          {battle.logs.map((log, i) => (
            <div key={i} className={`text-xs leading-5 ${LOG_COLORS[log.type] || 'text-text-secondary'}`}>
              <span className="mr-1">{LOG_ICONS[log.type] || '•'}</span>
              {log.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
