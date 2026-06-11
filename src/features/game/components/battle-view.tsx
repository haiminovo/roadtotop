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
    <div className="rounded-md p-2" style={{
      background: alive ? '#161b22' : '#0d1117',
      border: `1px solid ${alive ? borderColor : '#21262d'}`,
      opacity: alive ? 1 : 0.4,
      width: 110,
    }}>
      <div className="flex items-center gap-1 mb-2">
        <div className="w-6 h-6 rounded flex items-center justify-center text-xs" style={{ background: side === 'player' ? '#238636' : '#f8514920' }}>
          {alive ? icon : '💀'}
        </div>
        <div className="text-xs font-bold truncate" style={{ color: alive ? nameColor : '#6e7681' }}>{name}</div>
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span style={{ color: '#8b949e' }}>HP</span>
          <span style={{ color: '#e6edf3' }}>{hp}/{maxHp}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${hpPercent}%`, background: hpColor }} />
        </div>
      </div>
      <div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${ap}%`, background: '#58a6ff' }} />
        </div>
      </div>
      {effects.length > 0 && (
        <div className="flex gap-0.5 flex-wrap mt-1">
          {effects.map((eff, i) => (
            <span key={i} className="text-[8px] px-0.5 rounded" style={{ background: '#a371f720', color: '#bc8cff' }}>
              {eff.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BattleView({ battle }: BattleViewProps) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
      {/* 标题 */}
      <div className="flex items-center justify-between px-3 py-1" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: '#f85149' }}>⚔️ 战斗</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#21262d', color: '#8b949e' }}>
            {battle.defeatedCount}/{battle.totalEnemies}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: '#6e7681' }}>
          {battle.result === 'ongoing' ? '进行中' : battle.result === 'win' ? '🎉 胜利' : '💀 战败'}
        </span>
      </div>

      {/* 对战区域 - 居中 */}
      <div className="p-3 flex justify-center" style={{ background: '#0d1117' }}>
        <div className="flex items-center gap-3">
          {/* 玩家 */}
          <EntityCard
            name="你" icon="🧙"
            hp={battle.playerHealth} maxHp={battle.playerMaxHealth}
            ap={battle.playerActionPoints} effects={battle.playerEffects}
            alive={battle.playerHealth > 0} side="player"
          />

          {/* VS */}
          <span className="text-lg font-black" style={{ color: '#30363d' }}>VS</span>

          {/* 敌人 */}
          <div className="flex gap-2">
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
