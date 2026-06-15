'use client';

import React from 'react';
import type { SessionSnapshot, BodySlotType } from '../types';
import { SectionCard } from './ui/section-card';
import { CompactStat } from './ui/compact-stat';
import { RARITY_COLORS } from '@/lib/game-config';
import { getIcon } from '@/lib/ui/icons';

interface RolePanelProps {
  snapshot: SessionSnapshot;
  onUnequip: (backpackId: number) => void;
}

const SLOT_NAMES: Record<BodySlotType, string> = {
  head: '头部', hand: '手部', torso: '躯干', legs: '腿部', feet: '脚部', neck: '颈部', accessory: '饰品',
};

const STAT_LABELS: Record<string, string> = {
  strength: '力量',
  intelligence: '智力',
  agility: '敏捷',
  vitality: '体力',
  maxHealth: '生命',
  actionSpeed: '行动速度',
};

function formatDurability(value: number | string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatStats(stats: Record<string, number>) {
  return Object.entries(stats).map(([key, value]) => `${STAT_LABELS[key] || key}+${value}`).join(' ');
}

export function RolePanel({ snapshot, onUnequip }: RolePanelProps) {
  const { role } = snapshot;

  return (
    <div className="space-y-3">
      {/* 属性面板 */}
      <SectionCard title="角色属性">
        <div className="grid grid-cols-2 gap-2">
          <CompactStat label="力量" value={role.stats.strength} color="var(--accent-red)" />
          <CompactStat label="智力" value={role.stats.intelligence} color="var(--accent-blue)" />
          <CompactStat label="敏捷" value={role.stats.agility} color="var(--accent-green)" />
          <CompactStat label="体力" value={role.stats.vitality} color="var(--accent-orange)" />
        </div>
        <div className="mt-2 pt-2 border-t border-border-primary grid grid-cols-2 gap-2 text-xs">
          <div className="text-text-muted">行动速度: <span className="text-text-primary">{role.secondaryStats.actionSpeed}</span></div>
          <div className="text-text-muted">技能槽: <span className="text-text-primary">{role.secondaryStats.skillSlots}</span></div>
          <div className="text-text-muted">PVP评分: <span className="text-accent-purple">{role.pvpRating}</span></div>
          <div className="text-text-muted">胜/负: <span className="text-text-primary">{role.pvpWins}/{role.pvpLosses}</span></div>
        </div>
      </SectionCard>

      {/* 装备槽位 */}
      <SectionCard title="装备">
        <div className="space-y-1.5">
          {(Object.keys(SLOT_NAMES) as BodySlotType[]).map(slot => {
            const items = role.bodySlots[slot] || [];
            const capacity = role.bodySlotCapacities[slot];
            return (
              <div key={slot} className="flex items-center gap-2 text-xs">
                <span className="text-text-muted w-10">{SLOT_NAMES[slot]}</span>
                <div className="flex-1 flex gap-1 flex-wrap">
                  {items.map((item, i) => {
                    const Icon = getIcon(item.iconKey) as React.ComponentType<{ size?: number }>;
                    return (
                      <button
                        key={i}
                        onClick={() => onUnequip(item.backpackId)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-tertiary border border-border-primary hover:bg-bg-hover cursor-pointer"
                        title="点击卸下"
                      >
                        <Icon size={12} />
                        <span style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</span>
                        {formatStats(item.statJson) && (
                          <span className="text-text-muted">{formatStats(item.statJson)}</span>
                        )}
                        <span className="text-text-muted">
                          {formatDurability(item.currentDurability)}/{formatDurability(item.maxDurability)}
                        </span>
                      </button>
                    );
                  })}
                  {items.length < capacity && (
                    <span className="text-text-muted italic">空</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
