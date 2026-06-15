'use client';

import React from 'react';
import type { SessionSnapshot, BodySlotType, BackpackEntry, BodySlotItem } from '../types';
import { SectionCard } from './ui/section-card';
import { CommandButton } from './ui/command-button';
import { RARITY_COLORS, RARITY_NAMES } from '@/lib/game-config';
import { getIcon } from '@/lib/ui/icons';

interface BackpackPanelProps {
  snapshot: SessionSnapshot;
  onEquip: (backpackId: number, slot: BodySlotType, replaceBackpackId?: number) => void;
  onDrop: (backpackId: number) => void;
  onRepair: (backpackId: number) => void;
  onSell: (backpackId: number) => void;
  onLearnSkillBook: (backpackId: number) => void;
}

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
  const entries = Object.entries(stats);
  if (entries.length === 0) return '无属性';
  return entries.map(([key, value]) => `${STAT_LABELS[key] || key}+${value}`).join(' ');
}

function EquipmentCard({ item, selected, onClick }: {
  item: BackpackEntry | BodySlotItem;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Icon = getIcon(item.iconKey) as React.ComponentType<{ size?: number }>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-2 rounded border bg-bg-tertiary ${
        selected ? 'border-accent-blue' : 'border-border-secondary'
      } ${onClick ? 'hover:bg-bg-hover' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Icon size={20} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</div>
          <div className="text-xs text-text-muted">{formatStats(item.statJson)}</div>
          <div className="text-xs text-text-muted">
            耐久 {formatDurability(item.currentDurability)}/{formatDurability(item.maxDurability)}
          </div>
        </div>
      </div>
    </button>
  );
}

export function BackpackPanel({ snapshot, onEquip, onDrop, onRepair, onSell, onLearnSkillBook }: BackpackPanelProps) {
  const items = snapshot.backpack.filter(b => !b.equipped);
  const [pendingEquip, setPendingEquip] = React.useState<{ item: BackpackEntry; slot: BodySlotType } | null>(null);
  const [selectedReplaceId, setSelectedReplaceId] = React.useState<number | null>(null);

  const handleEquip = (item: BackpackEntry) => {
    if (!item.slot) return;
    const equippedItems = snapshot.role.bodySlots[item.slot] || [];
    const capacity = snapshot.role.bodySlotCapacities[item.slot];
    if (equippedItems.length >= capacity) {
      setPendingEquip({ item, slot: item.slot });
      setSelectedReplaceId(equippedItems[0]?.backpackId ?? null);
      return;
    }
    onEquip(item.backpackId, item.slot);
  };

  const confirmReplace = () => {
    if (!pendingEquip || !selectedReplaceId) return;
    onEquip(pendingEquip.item.backpackId, pendingEquip.slot, selectedReplaceId);
    setPendingEquip(null);
    setSelectedReplaceId(null);
  };

  const equippedToReplace = pendingEquip ? snapshot.role.bodySlots[pendingEquip.slot] || [] : [];

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
                      {formatStats(item.statJson)}
                      {item.levelRequirement > 1 && ` · 需要Lv.${item.levelRequirement}`}
                      {` · 耐久 ${formatDurability(item.currentDurability)}/${formatDurability(item.maxDurability)}`}
                      {item.repairCount > 0 && ` · 修理 ${item.repairCount} 次`}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {item.itemType === 'equipment' && item.slot && (
                    <>
                      {item.currentDurability < item.maxDurability && (
                        <CommandButton size="sm" variant="neutral" onClick={() => onRepair(item.backpackId)}>
                          修理
                        </CommandButton>
                      )}
                      <CommandButton size="sm" variant="primary" onClick={() => handleEquip(item)}>
                        装备
                      </CommandButton>
                    </>
                  )}
                  {item.itemType === 'skill_book' && (
                    <CommandButton size="sm" variant="success" onClick={() => onLearnSkillBook(item.backpackId)}>
                      学习
                    </CommandButton>
                  )}
                  <CommandButton size="sm" variant="success" onClick={() => onSell(item.backpackId)}>
                    出售 💰{item.sellPrice}
                  </CommandButton>
                  <CommandButton size="sm" variant="danger" onClick={() => onDrop(item.backpackId)}>
                    丢弃
                  </CommandButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {pendingEquip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border-primary bg-bg-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-text-primary">替换装备</h3>
              <button
                type="button"
                className="text-sm text-text-muted hover:text-text-primary"
                onClick={() => setPendingEquip(null)}
              >
                关闭
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs text-text-muted">当前装备</div>
                <div className="space-y-2">
                  {equippedToReplace.map(item => (
                    <EquipmentCard
                      key={item.backpackId}
                      item={item}
                      selected={selectedReplaceId === item.backpackId}
                      onClick={() => setSelectedReplaceId(item.backpackId)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-text-muted">将要装备</div>
                <EquipmentCard item={pendingEquip.item} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <CommandButton variant="neutral" onClick={() => setPendingEquip(null)}>
                取消
              </CommandButton>
              <CommandButton variant="primary" disabled={!selectedReplaceId} onClick={confirmReplace}>
                确认替换
              </CommandButton>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
