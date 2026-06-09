// ============================================================
// 静态游戏配置 + 类型定义 + 辅助函数
// ============================================================

// --- 基础类型 ---
export type RaceKey = 'human' | 'elf' | 'dwarf' | 'orc' | 'lizardfolk' | 'moonkin';
export type ClassKey = 'warrior' | 'mage' | 'farmer' | 'ranger' | 'priest' | 'rogue';
export type BodySlotType = 'head' | 'hand' | 'torso' | 'legs' | 'feet' | 'neck' | 'accessory';
export type ItemRarity = 'white' | 'green' | 'blue' | 'purple' | 'orange';
export type GameItemType = 'equipment' | 'skill_book' | 'material';
export type EncounterTier = 'common' | 'rare' | 'legendary';
export type ActivityKey = 'combat' | 'gathering' | 'fishing';
export type AfkStatus = 'idle' | 'afk' | 'battle';

// --- 常量 ---
export const MAX_OFFLINE_SECONDS = 86400; // 24小时
export const AFK_TASK_SECONDS = 10;
export const LEVEL_CAP = 50;
export const EXP_PER_LEVEL = 100;
export const EXP_GROWTH_PER_LEVEL = 10;
export const BASE_HEALTH = 50;
export const HEALTH_PER_VITALITY = 12;
export const HEALTH_PER_LEVEL = 2;
export const BASE_SKILL_SLOTS = 4;
export const SKILL_SLOTS_PER_5_INT = 1;
export const BASE_SKILL_USES = 3;
export const SKILL_USES_PER_5_INT = 1;
export const MAX_ACTION_POINTS = 100;
export const BASE_ACTION_SPEED = 10;
export const ACTION_SPEED_PER_5_AGI = 1;
export const MARKET_FEE_PERCENT = 10;
export const PVP_RATING_K = 32;
export const PVP_GOLD_REWARD = 50;

// --- 属性计算 ---
export function getExpRequiredForLevel(level: number): number {
  return EXP_PER_LEVEL + (level - 1) * EXP_GROWTH_PER_LEVEL;
}

export function getLevelFromExp(totalExp: number): { level: number; currentExp: number; requiredExp: number } {
  let remaining = totalExp;
  let level = 1;
  while (level < LEVEL_CAP) {
    const required = getExpRequiredForLevel(level);
    if (remaining < required) break;
    remaining -= required;
    level++;
  }
  return { level, currentExp: remaining, requiredExp: getExpRequiredForLevel(level) };
}

export function getMaxHealth(level: number, vitality: number): number {
  return BASE_HEALTH + vitality * HEALTH_PER_VITALITY + (level - 1) * HEALTH_PER_LEVEL;
}

export function getSkillSlots(intelligence: number): number {
  return BASE_SKILL_SLOTS + Math.floor(intelligence / SKILL_SLOTS_PER_5_INT);
}

export function getSkillUsesPerBattle(intelligence: number): number {
  return BASE_SKILL_USES + Math.floor(intelligence / SKILL_USES_PER_5_INT);
}

export function getActionSpeed(agility: number): number {
  return BASE_ACTION_SPEED + Math.floor(agility / ACTION_SPEED_PER_5_AGI);
}

// --- 装备槽容量 ---
export const DEFAULT_BODY_SLOT_CAPACITIES: Record<BodySlotType, number> = {
  head: 1,
  hand: 2,
  torso: 1,
  legs: 1,
  feet: 1,
  neck: 1,
  accessory: 2,
};

export function getBodySlotCapacities(raceKey: RaceKey): Record<BodySlotType, number> {
  return { ...DEFAULT_BODY_SLOT_CAPACITIES };
}

// --- 稀有度颜色 ---
export const RARITY_COLORS: Record<ItemRarity, string> = {
  white: '#9ca3af',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  orange: '#f97316',
};

export const RARITY_NAMES: Record<ItemRarity, string> = {
  white: '普通',
  green: '优秀',
  blue: '稀有',
  purple: '史诗',
  orange: '传说',
};

// --- 种族/职业配置接口 ---
export interface RaceConfig {
  key: RaceKey;
  name: string;
  description: string;
  statBonus: { strength: number; intelligence: number; agility: number; vitality: number };
}

export interface ClassConfig {
  key: ClassKey;
  name: string;
  description: string;
  baseStats: { strength: number; intelligence: number; agility: number; vitality: number };
}

export interface MapConfig {
  key: string;
  name: string;
  description: string;
  levelRequired: number;
  goldPerTask: number;
  expPerTask: number;
  aetherPerTask: number;
}

export interface SkillTemplate {
  key: string;
  name: string;
  category: 'attack' | 'spell' | 'guard';
  description: string;
  baseDamage: number;
  levelGrowth: number;
  maxUses: number;
  cooldown: number;
  effects: SkillEffect[];
}

export interface SkillEffect {
  type: string;
  chance?: number;
  value?: number;
  duration?: number;
}

export interface EnemyTemplate {
  key: string;
  name: string;
  mapKey: string;
  baseHealth: number;
  statWeights: { strength: number; intelligence: number; agility: number; vitality: number };
  fixedSkillKeys: string[];
  skillCaps: { attack: number; spell: number; guard: number };
  goldDrop: number;
  expDrop: number;
}

export interface EventRule {
  key: string;
  trigger: { type: 'afk_tick' | 'enemy_kill'; mapKey?: string | null; activityKey?: string | null };
  encounter: { tier: EncounterTier; title: string; description: string };
  actions: EventAction[];
}

export interface EventAction {
  type: 'grant_gold' | 'grant_aether' | 'grant_exp' | 'grant_item' | 'start_battle' | 'adjust_health';
  chance: number;
  min?: number;
  max?: number;
  itemType?: string;
  rarity?: string;
}

// --- 辅助函数 ---
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN');
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}
