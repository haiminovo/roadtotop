'use client';

import React from 'react';
import type { SessionSnapshot, BackpackEntry, BodySlotType } from '../types';
import { SectionCard } from './ui/section-card';
import { CommandButton } from './ui/command-button';
import { RARITY_COLORS, RARITY_NAMES } from '@/lib/game-config';
import { getIcon } from '@/lib/ui/icons';

interface BackpackPanelProps {
  snapshot: SessionSnapshot;
  onEquip: (backpackId: number, slot: BodySlotType) => void;
  onUnequip: (backpackId: number) => void;
  onDrop: (backpackId: number) => void;
  onLearnSkillBook: (backpackId: number) => void;
}

export function BackpackPanel({ snapshot, onEquip, onUnequip, onDrop, onLearnSkillBook }: BackpackPanelProps) {
  const items = snapshot.backpack.filter(b => !b.equipped);

  return (
    <SectionCard title={`背包 (${items.length})`}>
      {items.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-4">背包空空如也...</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => {
            const Icon = getIcon(item.iconKey) as React.ComponentType<{ size?: number }>;
            return (
              <div
                key={item.backpackId}
                className="flex items-center gap-2 p-2 rounded bg-bg-tertiary border border-border-secondary"
              >
                <Icon size={20} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium truncate" style={{ color: RARITY_COLORS[item.rarity] }}>
                      {item.name}
                    </span>
                    <span className="text-xs text-text-muted">[{RARITY_NAMES[item.rarity]}]</span>
                    {item.quantity > 1 && <span className="text-xs text-text-secondary">x{item.quantity}</span>}
                  </div>
                  {item.itemType === 'equipment' && item.slot && (
                    <div className="text-xs text-text-muted mt-0.5">
                      {Object.entries(item.statJson).map(([k, v]) => `${k}+${v}`).join(' ')}
                      {item.levelRequirement > 1 && ` · 需要Lv.${item.levelRequirement}`}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {item.itemType === 'equipment' && item.slot && (
                    <CommandButton size="sm" variant="primary" onClick={() => onEquip(item.backpackId, item.slot!)}>
                      装备
                    </CommandButton>
                  )}
                  {item.itemType === 'skill_book' && (
                    <CommandButton size="sm" variant="success" onClick={() => onLearnSkillBook(item.backpackId)}>
                      学习
                    </CommandButton>
                  )}
                  <CommandButton size="sm" variant="danger" onClick={() => onDrop(item.backpackId)}>
                    丢弃
                  </CommandButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
