'use client';

import React from 'react';
import type { BattleSnapshot } from '../types';

interface BattleViewProps {
  battle: BattleSnapshot;
}

function EntityCard({ name, icon, hp, maxHp, ap, effects, alive, side }: {
  name: string; icon: string; hp: number; maxHp: number; ap: number;
  effects: { type: string; duration: number }[]; alive: boolean; side: 'player' | 'enemy';
}) {
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
  const borderColor = side === 'player' ? '#238636' : '#f8514940';
  const hpColor = side === 'player' ? '#3fb950' : '#f85149';
  const nameColor = side === 'player' ? '#3fb950' : '#f85149';

  return (
    <div className="rounded-lg p-3 flex flex-col" style={{
      background: alive ? '#161b22' : '#0d1117',
      border: `2px solid ${alive ? borderColor : '#21262d'}`,
      opacity: alive ? 1 : 0.4,
      flex: '1 1 0',
      minWidth: 120,
      minHeight: 140,
    }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: side === 'player' ? '#238636' : '#f8514920' }}>
          {alive ? icon : '💀'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: alive ? nameColor : '#6e7681' }}>{name}</div>
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: '#8b949e' }}>HP</span>
          <span style={{ color: '#e6edf3' }}>{hp}/{maxHp}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${hpPercent}%`, background: hpColor }} />
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: '#8b949e' }}>ATB</span>
          <span style={{ color: '#e6edf3' }}>{ap}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${ap}%`, background: '#58a6ff' }} />
        </div>
      </div>
      {effects.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-auto">
          {effects.map((eff, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#a371f720', color: '#bc8cff' }}>
              {eff.type} {eff.duration}s
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BattleView({ battle }: BattleViewProps) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '2px solid #f8514930' }}>
      {/* 标题 */}
      <div className="flex items-center justify-between px-4 py-2" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold" style={{ color: '#f85149' }}>⚔️ 战斗</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#21262d', color: '#8b949e' }}>
            击败 {battle.defeatedCount}/{battle.totalEnemies}
          </span>
        </div>
        <span className="text-sm font-bold" style={{
          color: battle.result === 'win' ? '#3fb950' : battle.result === 'lose' ? '#f85149' : '#8b949e'
        }}>
          {battle.result === 'ongoing' ? '战斗中...' : battle.result === 'win' ? '🎉 胜利！' : '💀 战败...'}
        </span>
      </div>

      {/* 对战区域 - 自动撑满 */}
      <div className="p-4" style={{ background: '#0d1117' }}>
        <div className="flex items-stretch gap-4">
          {/* 玩家 */}
          <EntityCard
            name="你" icon="🧙"
            hp={battle.playerHealth} maxHp={battle.playerMaxHealth}
            ap={battle.playerActionPoints} effects={battle.playerEffects}
            alive={battle.playerHealth > 0} side="player"
          />

          {/* VS */}
          <div className="flex items-center justify-center px-2">
            <span className="text-2xl font-black" style={{ color: '#30363d' }}>VS</span>
          </div>

          {/* 敌人 - 等宽网格 */}
          <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(battle.enemies.length, 4)}, 1fr)` }}>
            {battle.enemies.map((enemy, i) => (
              <EntityCard
                key={i} name={enemy.name} icon="👹"
                hp={enemy.health} maxHp={enemy.maxHealth}
                ap={enemy.actionPoints} effects={enemy.effects}
                alive={enemy.alive} side="enemy"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
