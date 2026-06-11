'use client';

import React from 'react';
import type { BattleSnapshot } from '../types';

interface BattleViewProps {
  battle: BattleSnapshot;
}

export function BattleView({ battle }: BattleViewProps) {
  const playerHpPct = battle.playerMaxHealth > 0 ? (battle.playerHealth / battle.playerMaxHealth) * 100 : 0;
  const playerHpColor = playerHpPct > 60 ? '#3fb950' : playerHpPct > 30 ? '#d29922' : '#f85149';

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
      {/* 顶部标题栏 */}
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

      {/* 对战区域 */}
      <div className="p-2" style={{ background: '#0d1117' }}>
        <div className="flex gap-2">
          {/* 左侧：玩家 */}
          <div className="rounded-md p-2" style={{ background: '#161b22', border: '1px solid #238636', width: 120 }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-xs" style={{ background: '#238636' }}>🧙</div>
              <div className="text-xs font-bold truncate" style={{ color: '#3fb950' }}>你</div>
            </div>
            <div className="mb-1.5">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span style={{ color: '#8b949e' }}>HP</span>
                <span style={{ color: '#e6edf3' }}>{battle.playerHealth}/{battle.playerMaxHealth}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${playerHpPct}%`, background: playerHpColor }} />
              </div>
            </div>
            <div className="mb-1">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span style={{ color: '#8b949e' }}>ATB</span>
                <span style={{ color: '#e6edf3' }}>{battle.playerActionPoints}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${battle.playerActionPoints}%`, background: '#58a6ff' }} />
              </div>
            </div>
            {battle.playerEffects.length > 0 && (
              <div className="flex gap-0.5 flex-wrap">
                {battle.playerEffects.map((eff, i) => (
                  <span key={i} className="text-[9px] px-1 rounded" style={{ background: '#a371f720', color: '#bc8cff' }}>
                    {eff.type}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* VS */}
          <div className="flex items-center justify-center px-0.5">
            <span className="text-sm font-black" style={{ color: '#30363d' }}>VS</span>
          </div>

          {/* 右侧：敌人（等宽等高网格） */}
          <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(battle.enemies.length, 4)}, 1fr)` }}>
            {battle.enemies.map((enemy, i) => {
              const hpPct = enemy.maxHealth > 0 ? (enemy.health / enemy.maxHealth) * 100 : 0;
              return (
                <div key={i} className="rounded-md p-2" style={{
                  background: enemy.alive ? '#161b22' : '#0d1117',
                  border: `1px solid ${enemy.alive ? '#f8514940' : '#21262d'}`,
                  opacity: enemy.alive ? 1 : 0.4,
                  width: 120,
                }}>
                  <div className="flex items-center gap-1 mb-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-xs" style={{ background: '#f8514920' }}>
                      {enemy.alive ? '👹' : '💀'}
                    </div>
                    <div className="text-xs font-bold truncate" style={{ color: enemy.alive ? '#f85149' : '#6e7681' }}>{enemy.name}</div>
                  </div>
                  <div className="mb-1.5">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span style={{ color: '#8b949e' }}>HP</span>
                      <span style={{ color: '#e6edf3' }}>{enemy.health}/{enemy.maxHealth}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${hpPct}%`, background: '#f85149' }} />
                    </div>
                  </div>
                  <div className="mb-1">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span style={{ color: '#8b949e' }}>ATB</span>
                      <span style={{ color: '#e6edf3' }}>{enemy.actionPoints}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
                      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${enemy.actionPoints}%`, background: '#d29922' }} />
                    </div>
                  </div>
                  {enemy.effects.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap">
                      {enemy.effects.map((eff, i) => (
                        <span key={i} className="text-[8px] px-0.5 rounded" style={{ background: '#d2992220', color: '#d29922' }}>
                          {eff.type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
