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
  onConfigureSkillLoadout: (skillKeys: string[]) => void;
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

const SKILL_CATEGORY_LABELS: Record<string, string> = {
  attack: '攻击',
  spell: '法术',
  guard: '防御',
};

function formatEffectType(type: string) {
  if (type === 'damage_over_time') return '持续伤害';
  if (type === 'stun') return '眩晕';
  if (type === 'defense_up') return '防御提升';
  if (type === 'attack_up') return '攻击提升';
  return type;
}

function formatDurability(value: number | string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatStats(stats: Record<string, number>) {
  return Object.entries(stats).map(([key, value]) => `${STAT_LABELS[key] || key}+${value}`).join(' ');
}

function formatStatBreakdown(base: number, level: number, equipment: number) {
  const parts = [`基础${base}`];
  if (level > 0) parts.push(`等级+${level}`);
  if (equipment > 0) parts.push(`装备+${equipment}`);
  return parts.join(' / ');
}

export function RolePanel({ snapshot, onUnequip, onConfigureSkillLoadout }: RolePanelProps) {
  const { role } = snapshot;
  const skillByKey = new Map(snapshot.config.skills.map(skill => [skill.key, skill]));
  const learnedSkills = role.learnedSkills
    .map(key => skillByKey.get(key))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));
  const equippedSet = new Set(role.equippedSkills);
  const canEquipMore = role.equippedSkills.length < role.secondaryStats.skillSlots;

  function toggleSkill(skillKey: string) {
    if (equippedSet.has(skillKey)) {
      onConfigureSkillLoadout(role.equippedSkills.filter(key => key !== skillKey));
      return;
    }
    if (!canEquipMore) return;
    onConfigureSkillLoadout([...role.equippedSkills, skillKey]);
  }

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
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-text-muted">
          <div>力 {formatStatBreakdown(role.baseStats.strength, role.levelBonusStats.strength, role.equipmentStats.strength)}</div>
          <div>智 {formatStatBreakdown(role.baseStats.intelligence, role.levelBonusStats.intelligence, role.equipmentStats.intelligence)}</div>
          <div>敏 {formatStatBreakdown(role.baseStats.agility, role.levelBonusStats.agility, role.equipmentStats.agility)}</div>
          <div>体 {formatStatBreakdown(role.baseStats.vitality, role.levelBonusStats.vitality, role.equipmentStats.vitality)}</div>
        </div>
        <div className="mt-2 pt-2 border-t border-border-primary grid grid-cols-2 gap-2 text-xs">
          <div className="text-text-muted">行动速度: <span className="text-text-primary">{role.secondaryStats.actionSpeed}</span></div>
          <div className="text-text-muted">技能槽: <span className="text-text-primary">{role.secondaryStats.skillSlots}</span></div>
          <div className="text-text-muted">PVP评分: <span className="text-accent-purple">{role.pvpRating}</span></div>
          <div className="text-text-muted">胜/负: <span className="text-text-primary">{role.pvpWins}/{role.pvpLosses}</span></div>
        </div>
      </SectionCard>

      {/* 技能栏 */}
      <SectionCard title="技能">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-text-muted">已装备</span>
          <span className="text-text-primary">{role.equippedSkills.length}/{role.secondaryStats.skillSlots}</span>
        </div>
        {learnedSkills.length === 0 ? (
          <div className="text-xs text-text-muted italic">尚未学习技能书</div>
        ) : (
          <div className="space-y-1.5">
            {learnedSkills.map(skill => {
              const equipped = equippedSet.has(skill.key);
              const disabled = !equipped && !canEquipMore;
              return (
                <div
                  key={skill.key}
                  className="flex items-start gap-2 rounded border border-border-primary bg-bg-tertiary px-2 py-1.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-text-primary">{skill.name}</span>
                      <span className="text-[10px] text-text-muted">[{SKILL_CATEGORY_LABELS[skill.category] || skill.category}]</span>
                    </div>
                    <div className="text-[10px] text-text-muted leading-relaxed">{skill.description}</div>
                    <div className="text-[10px] text-text-muted">
                      次数 {skill.maxUses} · 冷却 {skill.cooldown}
                      {skill.effects.length > 0 && (
                        <span> · {skill.effects.map(effect => formatEffectType(effect.type)).join(' / ')}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSkill(skill.key)}
                    disabled={disabled}
                    className={`shrink-0 px-2 py-1 rounded text-xs ${
                      equipped
                        ? 'bg-accent-red/20 text-accent-red hover:bg-accent-red/30'
                        : 'bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                    title={disabled ? '技能槽已满' : undefined}
                  >
                    {equipped ? '卸下' : '装备'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
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
