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

function EntityCard({ name, icon, hp, maxHp, ap, effects, alive, side }: {
  name: string; icon: string; hp: number; maxHp: number; ap: number;
  effects: { type: string; duration: number }[]; alive: boolean; side: 'player' | 'enemy';
}) {
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  const hpColor = side === 'player'
    ? (hpPercent > 60 ? 'bg-accent-green' : hpPercent > 30 ? 'bg-accent-orange' : 'bg-accent-red')
    : 'bg-accent-red';
  const borderColor = side === 'player' ? 'border-accent-green/20' : 'border-accent-red/20';
  const nameColor = side === 'player' ? 'text-accent-green' : 'text-accent-red';

  return (
    <div className={`bg-bg-tertiary rounded-lg p-2 border ${alive ? borderColor : 'border-border-secondary opacity-50'} flex flex-col`} style={{ minHeight: 100 }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${alive ? (side === 'player' ? 'bg-accent-green/20' : 'bg-accent-red/20') : 'bg-bg-hover'}`}>
          {alive ? icon : '💀'}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold truncate ${nameColor}`}>{name}</div>
        </div>
      </div>
      <div className="mb-1">
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span className="text-text-muted">HP</span>
          <span className="text-text-secondary">{hp}/{maxHp}</span>
        </div>
        <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${hpColor}`} style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
      <div className="mb-1">
        <div className="flex items-center justify-between text-[10px] mb-0.5">
          <span className="text-text-muted">行动</span>
          <span className="text-text-secondary">{ap}%</span>
        </div>
        <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-accent-blue transition-all duration-200" style={{ width: `${ap}%` }} />
        </div>
      </div>
      {effects.length > 0 && (
        <div className="flex gap-0.5 flex-wrap mt-auto">
          {effects.map((eff, i) => (
            <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-accent-purple/20 text-accent-purple">
              {eff.type} {eff.duration}s
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

  const aliveEnemies = battle.enemies.filter(e => e.alive);

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
        {/* 左右对战布局 */}
        <div className="flex items-stretch gap-3">
          {/* 玩家侧 */}
          <div className="w-36 shrink-0">
            <EntityCard
              name="你"
              icon="🧙"
              hp={battle.playerHealth}
              maxHp={battle.playerMaxHealth}
              ap={battle.playerActionPoints}
              effects={battle.playerEffects}
              alive={battle.playerHealth > 0}
              side="player"
            />
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-1">
            <span className="text-xl font-black text-text-muted">VS</span>
          </div>

          {/* 敌人侧（多个，等宽网格） */}
          <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(battle.enemies.length, 4)}, 1fr)` }}>
            {battle.enemies.map((enemy, i) => (
              <EntityCard
                key={i}
                name={enemy.name}
                icon="👹"
                hp={enemy.health}
                maxHp={enemy.maxHealth}
                ap={enemy.actionPoints}
                effects={enemy.effects}
                alive={enemy.alive}
                side="enemy"
              />
            ))}
          </div>
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
