'use client';

import React, { useRef } from 'react';
import type { BattleSnapshot } from '../types';
import type { ClassKey } from '@/lib/game-config';
import { BattleCanvas } from './battle-canvas';

interface BattleViewProps {
  battle: BattleSnapshot;
  classKey: ClassKey;
}

function EntityCard({ name, icon, hp, maxHp, ap, effects, alive, side, entityIndex }: {
  name: string; icon: string; hp: number; maxHp: number; ap: number;
  effects: { type: string; duration: number }[]; alive: boolean; side: 'player' | 'enemy';
  entityIndex: number;
}) {
  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
  const hpPercent = clampPercent(maxHp > 0 ? (hp / maxHp) * 100 : 0);
  const apPercent = clampPercent(ap);
  const apLabel = Math.round(apPercent);
  const borderColor = side === 'player' ? '#238636' : '#f8514940';
  const hpColor = side === 'player' ? '#3fb950' : '#f85149';
  const nameColor = side === 'player' ? '#3fb950' : '#f85149';

  return (
    <div data-entity-index={entityIndex} className="rounded-lg p-2 flex flex-col" style={{
      background: alive ? '#161b22' : '#0d1117',
      border: `2px solid ${alive ? borderColor : '#21262d'}`,
      opacity: alive ? 1 : 0.4,
      height: 140,
    }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div data-entity-avatar className="w-7 h-7 rounded flex items-center justify-center text-sm shrink-0" style={{ background: side === 'player' ? '#238636' : '#f8514920' }}>
          {alive ? icon : '💀'}
        </div>
        <div className="text-xs font-bold truncate" data-entity-name={name} style={{ color: alive ? nameColor : '#6e7681' }}>{name}</div>
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span style={{ color: '#8b949e' }}>HP</span>
          <span style={{ color: '#e6edf3' }}>{hp}/{maxHp}</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${hpPercent}%`, background: hpColor }} />
        </div>
      </div>
      <div className="mb-1">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span style={{ color: '#8b949e' }}>ATB</span>
          <span style={{ color: '#e6edf3' }}>{apLabel}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
          <div className="h-full rounded-full transition-all duration-200" style={{ width: `${apPercent}%`, background: '#58a6ff' }} />
        </div>
      </div>
      <div className="flex gap-0.5 flex-wrap mt-auto" style={{ minHeight: 16 }}>
        {effects.map((eff, i) => (
          <span key={i} className="text-[9px] px-1 py-0.5 rounded" style={{ background: '#a371f720', color: '#bc8cff' }}>
            {eff.type}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BattleView({ battle, classKey }: BattleViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalSlots = 1 + battle.enemies.length;

  return (
    <div ref={containerRef} className="relative rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '2px solid #f8514930' }}>
      {/* 标题 */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: '#f85149' }}>⚔️ 战斗</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#21262d', color: '#8b949e' }}>
            {battle.defeatedCount}/{battle.totalEnemies}
          </span>
        </div>
        <span className="text-xs font-bold" style={{
          color: battle.result === 'win' ? '#3fb950' : battle.result === 'lose' ? '#f85149' : '#8b949e'
        }}>
          {battle.result === 'ongoing' ? '战斗中...' : battle.result === 'win' ? '🎉 胜利！' : '💀 战败...'}
        </span>
      </div>

      {/* 对战区域 */}
      <div className="p-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${totalSlots}, 1fr)` }}>
          <EntityCard
            name="你" icon="🧙"
            hp={battle.playerHealth} maxHp={battle.playerMaxHealth}
            ap={battle.playerActionPoints} effects={battle.playerEffects}
            alive={battle.playerHealth > 0} side="player" entityIndex={-1}
          />
          {battle.enemies.map((enemy, i) => (
            <EntityCard
              key={i} name={enemy.name} icon="👹"
              hp={enemy.health} maxHp={enemy.maxHealth}
              ap={enemy.actionPoints} effects={enemy.effects}
              alive={enemy.alive} side="enemy" entityIndex={i}
            />
          ))}
        </div>
      </div>

      {/* Canvas 特效层 */}
      <BattleCanvas battle={battle} classKey={classKey} containerRef={containerRef} />
    </div>
  );
}
