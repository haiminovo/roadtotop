'use client';

import React, { useRef, useEffect } from 'react';
import type { BattleSnapshot, EnemySnapshot } from '../types';

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

function EnemyCard({ enemy, index, total }: { enemy: EnemySnapshot; index: number; total: number }) {
  const hpPercent = enemy.maxHealth > 0 ? (enemy.health / enemy.maxHealth) * 100 : 0;
  const hpColor = hpPercent > 60 ? 'bg-accent-red' : hpPercent > 30 ? 'bg-accent-orange' : 'bg-accent-red';

  return (
    <div className={`bg-bg-tertiary rounded-lg p-2 border ${enemy.alive ? 'border-accent-red/20' : 'border-border-secondary opacity-50'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${enemy.alive ? 'bg-accent-red/20' : 'bg-bg-hover'}`}>
          {enemy.alive ? '👹' : '💀'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-accent-red truncate">{enemy.name}</div>
          <div className="text-[10px] text-text-muted">#{index + 1}/{total}</div>
        </div>
      </div>
      <div className="mb-1">
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span className="text-text-muted">HP</span>
          <span className="text-text-secondary">{enemy.health}/{enemy.maxHealth}</span>
        </div>
        <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${hpColor}`} style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span className="text-text-muted">行动</span>
          <span className="text-text-secondary">{enemy.actionPoints}%</span>
        </div>
        <div className="h-1 bg-bg-primary rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-accent-orange transition-all duration-200" style={{ width: `${enemy.actionPoints}%` }} />
        </div>
      </div>
      {enemy.effects.length > 0 && (
        <div className="flex gap-0.5 mt-1 flex-wrap">
          {enemy.effects.map((eff, i) => (
            <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-accent-orange/20 text-accent-orange">
              {eff.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BattleView({ battle }: BattleViewProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [battle.logs]);

  const playerHpPercent = battle.playerMaxHealth > 0 ? (battle.playerHealth / battle.playerMaxHealth) * 100 : 0;
  const playerHpColor = playerHpPercent > 60 ? 'bg-accent-green' : playerHpPercent > 30 ? 'bg-accent-orange' : 'bg-accent-red';

  return (
    <div className="bg-bg-secondary border border-accent-red/30 rounded-lg overflow-hidden">
      {/* 战斗标题 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-accent-red/10 border-b border-accent-red/20">
        <span className="text-sm font-bold text-accent-red">
          ⚔️ 战斗中 ({battle.defeatedCount}/{battle.totalEnemies})
        </span>
        <span className="text-xs text-text-muted">
          {battle.result === 'ongoing' ? '进行中...' : battle.result === 'win' ? '🎉 胜利！' : '💀 战败...'}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* 敌人区域（多个） */}
        <div className="grid grid-cols-2 gap-2">
          {battle.enemies.map((enemy, i) => (
            <EnemyCard key={i} enemy={enemy} index={i} total={battle.totalEnemies} />
          ))}
        </div>

        {/* VS */}
        <div className="text-center">
          <span className="text-lg font-black text-text-muted">VS</span>
        </div>

        {/* 玩家区域 */}
        <div className="bg-bg-tertiary rounded-lg p-2 border border-accent-green/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center text-sm">🧙</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-accent-green">你</div>
            </div>
          </div>
          <div className="mb-1">
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-text-muted">HP</span>
              <span className="text-text-secondary">{battle.playerHealth}/{battle.playerMaxHealth}</span>
            </div>
            <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${playerHpColor}`} style={{ width: `${playerHpPercent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-text-muted">行动</span>
              <span className="text-text-secondary">{battle.playerActionPoints}%</span>
            </div>
            <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-accent-blue transition-all duration-200" style={{ width: `${battle.playerActionPoints}%` }} />
            </div>
          </div>
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

        {/* 战斗日志 */}
        <div ref={logRef} className="bg-bg-primary rounded-lg p-2 max-h-28 overflow-y-auto space-y-0.5">
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
