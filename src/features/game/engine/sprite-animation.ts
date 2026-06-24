'use client';

// ============================================================
// 精灵动画系统 - 像素风格
// ============================================================

export interface CombatEntity {
  id: string;
  type: 'hero' | 'monster';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: string;
  hitFlash: number;
  attackProgress: number;
  classKey?: string;
  monsterKey?: string;
  hp: number;
  maxHp: number;
  stateTime: number;
  invulnerableTime?: number;
}

// 像素绘制辅助函数
type PixelPattern = (string | null)[];

const CLASS_COLORS: Record<string, { main: string; light: string; dark: string; skin: string; hair: string }> = {
  warrior: { main: '#c74b3a', light: '#e86b5a', dark: '#8b2a1a', skin: '#f5c6a0', hair: '#5c3a21' },
  mage: { main: '#7b5aa6', light: '#9d7bc8', dark: '#4a2a76', skin: '#f5c6a0', hair: '#2a1a3a' },
  ranger: { main: '#4a8b3a', light: '#6bab5a', dark: '#2a5a1a', skin: '#f5c6a0', hair: '#8b6a3a' },
  rogue: { main: '#8b7a3a', light: '#ab9a5a', dark: '#5a4a1a', skin: '#f5c6a0', hair: '#2a2a2a' },
  priest: { main: '#4a7ab8', light: '#6a9ad8', dark: '#2a4a88', skin: '#f5c6a0', hair: '#c9b89a' },
  farmer: { main: '#5a9a7a', light: '#7aba9a', dark: '#3a6a4a', skin: '#f5c6a0', hair: '#7a5a3a' },
};

const MONSTER_COLORS: Record<string, { main: string; light: string; dark: string; eye: string }> = {
  slime: { main: '#4ab86a', light: '#6ad88a', dark: '#2a884a', eye: '#ffffff' },
  goblin: { main: '#8b9a4a', light: '#abba6a', dark: '#5b6a2a', eye: '#ff4444' },
  skeleton: { main: '#e8e0d0', light: '#ffffff', dark: '#b8b0a0', eye: '#222222' },
  wolf: { main: '#7a7a8a', light: '#9a9aaa', dark: '#5a5a6a', eye: '#ffcc44' },
  bear: { main: '#8b5a3a', light: '#ab7a5a', dark: '#5b3a1a', eye: '#444444' },
  fire_elemental: { main: '#ff6b3a', light: '#ffab5a', dark: '#cc3a1a', eye: '#ffffff' },
  dragon_whelp: { main: '#9b5ab8', light: '#bb7ad8', dark: '#6b2a88', eye: '#ffcc44' },
  void_walker: { main: '#3a3a5a', light: '#5a5a8a', dark: '#1a1a3a', eye: '#aa66ff' },
};

// 像素角色图案 - 16x16 网格
const HERO_PIXELS: Record<string, PixelPattern> = {
  warrior: [
    null, null, null, null, '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', null, null, null, null, null, null,
    null, null, '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', '#5c3a21', null, null, null, null,
    null, null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#222222', '#f5c6a0', '#f5c6a0', '#222222', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#dab090', null, null, null, null, null, null,
    null, null, null, null, null, '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', null, null, null, null, null, null, null,
    null, null, '#e86b5a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#e86b5a', null, null, null, null, null,
    null, null, '#e86b5a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#e86b5a', null, null, null, null, null,
    null, null, '#f5c6a0', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#8b2a1a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#c74b3a', '#8b2a1a', null, null, null, null, null, null,
    null, null, null, '#8b2a1a', '#8b2a1a', '#8b2a1a', null, null, '#8b2a1a', '#8b2a1a', '#8b2a1a', null, null, null, null, null,
    null, null, null, '#8b2a1a', '#8b2a1a', '#8b2a1a', null, null, '#8b2a1a', '#8b2a1a', '#8b2a1a', null, null, null, null, null,
    null, null, null, '#5a5a5a', '#5a5a5a', '#5a5a5a', null, null, '#5a5a5a', '#5a5a5a', '#5a5a5a', null, null, null, null, null,
    null, null, null, '#3a3a3a', '#3a3a3a', '#3a3a3a', null, null, '#3a3a3a', '#3a3a3a', '#3a3a3a', null, null, null, null, null,
    null, null, null, '#222222', '#222222', '#222222', null, null, '#222222', '#222222', '#222222', null, null, null, null, null,
  ],
  mage: [
    null, null, null, null, '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', null, null, null, null, null, null,
    null, null, '#7b5aa6', '#2a1a3a', '#2a1a3a', '#2a1a3a', '#2a1a3a', '#2a1a3a', '#2a1a3a', '#2a1a3a', '#2a1a3a', '#7b5aa6', null, null, null, null,
    null, null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#222222', '#f5c6a0', '#f5c6a0', '#222222', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#dab090', null, null, null, null, null, null,
    null, null, null, null, null, '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', null, null, null, null, null, null, null,
    null, '#9d7bc8', '#9d7bc8', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#9d7bc8', '#9d7bc8', null, null, null, null,
    null, '#9d7bc8', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#9d7bc8', null, null, null, null,
    null, null, '#f5c6a0', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#f5c6a0', null, null, null, null, null,
    null, null, '#ffcc44', '#4a2a76', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#7b5aa6', '#4a2a76', '#ffcc44', null, null, null, null, null,
    null, null, null, '#4a2a76', '#4a2a76', '#4a2a76', null, null, '#4a2a76', '#4a2a76', '#4a2a76', null, null, null, null, null,
    null, null, null, '#4a2a76', '#4a2a76', '#4a2a76', null, null, '#4a2a76', '#4a2a76', '#4a2a76', null, null, null, null, null,
    null, null, null, '#7b5aa6', '#7b5aa6', '#7b5aa6', null, null, '#7b5aa6', '#7b5aa6', '#7b5aa6', null, null, null, null, null,
    null, null, null, '#4a2a76', '#4a2a76', '#4a2a76', null, null, '#4a2a76', '#4a2a76', '#4a2a76', null, null, null, null, null,
    null, null, null, '#222222', '#222222', '#222222', null, null, '#222222', '#222222', '#222222', null, null, null, null, null,
  ],
  ranger: [
    null, null, null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, null, null, null, null,
    null, null, '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', '#8b6a3a', null, null, null, null,
    null, null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#222222', '#f5c6a0', '#f5c6a0', '#222222', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#dab090', null, null, null, null, null, null,
    null, null, null, null, null, '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', null, null, null, null, null, null, null,
    null, null, '#8b6a3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#6ab85a', null, null, null, null, null,
    null, null, '#8b6a3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#6ab85a', null, null, null, null, null,
    null, null, '#f5c6a0', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#2a5a1a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#4a8b3a', '#2a5a1a', null, null, null, null, null, null,
    null, null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, null, null, null,
    null, null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, null, null, null,
    null, null, null, '#4a8b3a', '#4a8b3a', '#4a8b3a', null, null, '#4a8b3a', '#4a8b3a', '#4a8b3a', null, null, null, null, null,
    null, null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, '#2a5a1a', '#2a5a1a', '#2a5a1a', null, null, null, null, null,
    null, null, null, '#222222', '#222222', '#222222', null, null, '#222222', '#222222', '#222222', null, null, null, null, null,
  ],
  rogue: [
    null, null, null, null, '#222222', '#222222', '#222222', '#222222', '#222222', '#222222', null, null, null, null, null, null,
    null, null, '#222222', '#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a', '#2a2a2a', '#222222', null, null, null, null,
    null, null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#222222', '#f5c6a0', '#f5c6a0', '#222222', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#dab090', null, null, null, null, null, null,
    null, null, null, null, null, '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', null, null, null, null, null, null, null,
    null, null, '#222222', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#222222', null, null, null, null, null,
    null, null, '#222222', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#222222', null, null, null, null, null,
    null, null, '#f5c6a0', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#5a4a1a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#8b7a3a', '#5a4a1a', null, null, null, null, null, null,
    null, null, null, '#5a4a1a', '#5a4a1a', '#5a4a1a', null, null, '#5a4a1a', '#5a4a1a', '#5a4a1a', null, null, null, null, null,
    null, null, null, '#5a4a1a', '#5a4a1a', '#5a4a1a', null, null, '#5a4a1a', '#5a4a1a', '#5a4a1a', null, null, null, null, null,
    null, null, null, '#8b7a3a', '#8b7a3a', '#8b7a3a', null, null, '#8b7a3a', '#8b7a3a', '#8b7a3a', null, null, null, null, null,
    null, null, null, '#5a4a1a', '#5a4a1a', '#5a4a1a', null, null, '#5a4a1a', '#5a4a1a', '#5a4a1a', null, null, null, null, null,
    null, null, null, '#222222', '#222222', '#222222', null, null, '#222222', '#222222', '#222222', null, null, null, null, null,
  ],
  priest: [
    null, null, null, null, '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', null, null, null, null, null, null,
    null, null, '#fff', '#c9b89a', '#c9b89a', '#c9b89a', '#c9b89a', '#c9b89a', '#c9b89a', '#c9b89a', '#c9b89a', '#fff', null, null, null, null,
    null, null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#2266ff', '#f5c6a0', '#f5c6a0', '#2266ff', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#dab090', null, null, null, null, null, null,
    null, null, null, null, null, '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', null, null, null, null, null, null, null,
    null, '#fff', '#fff', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#fff', '#fff', null, null, null, null,
    null, '#fff', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#fff', null, null, null, null,
    null, null, '#f5c6a0', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#f5c6a0', null, null, null, null, null,
    null, null, '#ffcc44', '#2a4a88', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#4a7ab8', '#2a4a88', '#ffcc44', null, null, null, null, null,
    null, null, null, '#2a4a88', '#2a4a88', '#2a4a88', null, null, '#2a4a88', '#2a4a88', '#2a4a88', null, null, null, null, null,
    null, null, null, '#2a4a88', '#2a4a88', '#2a4a88', null, null, '#2a4a88', '#2a4a88', '#2a4a88', null, null, null, null, null,
    null, null, null, '#4a7ab8', '#4a7ab8', '#4a7ab8', null, null, '#4a7ab8', '#4a7ab8', '#4a7ab8', null, null, null, null, null,
    null, null, null, '#2a4a88', '#2a4a88', '#2a4a88', null, null, '#2a4a88', '#2a4a88', '#2a4a88', null, null, null, null, null,
    null, null, null, '#222222', '#222222', '#222222', null, null, '#222222', '#222222', '#222222', null, null, null, null, null,
  ],
  farmer: [
    null, null, null, null, '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', null, null, null, null, null, null,
    null, null, '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', '#7a5a3a', null, null, null, null,
    null, null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#222222', '#f5c6a0', '#f5c6a0', '#222222', '#f5c6a0', '#f5c6a0', '#f5c6a0', null, null, null, null, null, null,
    null, null, null, '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#f5c6a0', '#dab090', null, null, null, null, null, null,
    null, null, null, null, null, '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', null, null, null, null, null, null, null,
    null, null, '#7aba9a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#7aba9a', null, null, null, null, null,
    null, null, '#7aba9a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#7aba9a', null, null, null, null, null,
    null, null, '#f5c6a0', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#f5c6a0', null, null, null, null, null,
    null, null, null, '#3a6a4a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#5a9a7a', '#3a6a4a', null, null, null, null, null, null,
    null, null, null, '#6b5a3a', '#6b5a3a', '#6b5a3a', null, null, '#6b5a3a', '#6b5a3a', '#6b5a3a', null, null, null, null, null,
    null, null, null, '#8b7a5a', '#8b7a5a', '#8b7a5a', null, null, '#8b7a5a', '#8b7a5a', '#8b7a5a', null, null, null, null, null,
    null, null, null, '#5a9a7a', '#5a9a7a', '#5a9a7a', null, null, '#5a9a7a', '#5a9a7a', '#5a9a7a', null, null, null, null, null,
    null, null, null, '#3a6a4a', '#3a6a4a', '#3a6a4a', null, null, '#3a6a4a', '#3a6a4a', '#3a6a4a', null, null, null, null, null,
    null, null, null, '#222222', '#222222', '#222222', null, null, '#222222', '#222222', '#222222', null, null, null, null, null,
  ],
};

// 怪物像素图案 - 16x16
const MONSTER_PIXELS: Record<string, PixelPattern> = {
  slime: [
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', null, null, null, null, null,
    null, null, null, '#4ab86a', '#4ab86a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#4ab86a', null, null, null, null,
    null, null, '#4ab86a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#4ab86a', null, null, null,
    null, '#4ab86a', '#6ad88a', '#6ad88a', '#ffffff', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#ffffff', '#6ad88a', '#6ad88a', '#4ab86a', null, null, null,
    null, '#4ab86a', '#6ad88a', '#ffffff', '#222222', '#ffffff', '#6ad88a', '#6ad88a', '#ffffff', '#222222', '#ffffff', '#6ad88a', '#4ab86a', null, null, null,
    '#4ab86a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#4ab86a', null, null,
    '#4ab86a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#4ab86a', null, null,
    '#2a884a', '#4ab86a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#4ab86a', '#2a884a', null, null,
    null, '#2a884a', '#4ab86a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#6ad88a', '#4ab86a', '#2a884a', null, null, null,
    null, null, '#2a884a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#2a884a', null, null, null, null,
    null, null, null, '#2a884a', '#2a884a', '#2a884a', '#4ab86a', '#4ab86a', '#2a884a', '#2a884a', '#2a884a', null, null, null, null, null,
    null, null, null, null, null, null, '#2a884a', '#2a884a', '#2a884a', null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  goblin: [
    null, null, null, null, null, '#5b6a2a', '#5b6a2a', '#5b6a2a', '#5b6a2a', '#5b6a2a', '#5b6a2a', null, null, null, null, null,
    null, null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null, null,
    null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null,
    null, '#5b6a2a', '#8b9a4a', '#ff4444', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#ff4444', '#8b9a4a', '#5b6a2a', null, null, null,
    null, '#5b6a2a', '#8b9a4a', '#ff4444', '#222222', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#222222', '#ff4444', '#8b9a4a', '#5b6a2a', null, null, null,
    null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#abba6a', '#abba6a', '#abba6a', '#abba6a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null,
    null, null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null, null,
    null, null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null, null, null,
    null, null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null, null,
    null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null,
    null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', null, null, null, null, '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null, null,
    null, null, '#5b6a2a', '#5b6a2a', null, null, null, null, null, null, '#5b6a2a', '#5b6a2a', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  skeleton: [
    null, null, null, null, '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', null, null, null, null, null, null,
    null, null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, '#e8e0d0', '#ffffff', '#222222', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#222222', '#ffffff', '#e8e0d0', null, null, null,
    null, '#e8e0d0', '#ffffff', '#222222', '#222222', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#222222', '#222222', '#ffffff', '#e8e0d0', null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#222222', '#222222', '#222222', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null, null,
    null, null, null, null, '#b8b0a0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#b8b0a0', null, null, null, null, null, null,
    null, null, null, null, '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', null, null, null, null, null, null,
    null, null, null, '#e8e0d0', '#ffffff', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#ffffff', '#e8e0d0', null, null, null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, null,
    null, null, null, '#b8b0a0', '#b8b0a0', null, null, null, null, '#b8b0a0', '#b8b0a0', null, null, null, null, null,
    null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, null,
    null, null, null, '#222222', '#222222', null, null, null, null, '#222222', '#222222', null, null, null, null, null,
  ],
  wolf: [
    null, null, null, '#5a5a6a', null, null, null, null, null, null, null, '#5a5a6a', null, null, null, null,
    null, null, '#5a5a6a', '#7a7a8a', '#7a7a8a', null, null, null, null, null, '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null,
    null, '#5a5a6a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null,
    null, '#5a5a6a', '#7a7a8a', '#ffcc44', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#ffcc44', '#7a7a8a', '#5a5a6a', null, null, null,
    null, null, '#9a9aaa', '#ffcc44', '#222222', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#222222', '#ffcc44', '#9a9aaa', null, null, null, null,
    null, null, '#9a9aaa', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#222222', '#222222', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#9a9aaa', null, null, null, null,
    null, null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, null, null, null,
    null, null, null, '#5a5a6a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null, null, null,
    null, null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, null, null, null,
    null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, null, null,
    null, null, '#5a5a6a', '#7a7a8a', '#7a7a8a', null, null, null, null, '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null, null,
    null, null, '#5a5a6a', '#5a5a6a', null, null, null, null, null, null, '#5a5a6a', '#5a5a6a', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  bear: [
    null, null, '#5b3a1a', '#5b3a1a', null, null, null, null, null, null, null, '#5b3a1a', '#5b3a1a', null, null, null,
    null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null, null, '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null,
    null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null,
    null, null, '#8b5a3a', '#444444', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#444444', '#8b5a3a', null, null, null, null,
    null, null, '#ab7a5a', '#444444', '#222222', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#222222', '#444444', '#ab7a5a', null, null, null, null,
    null, null, '#ab7a5a', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#222222', '#222222', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#ab7a5a', null, null, null, null,
    null, null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null, null,
    null, null, null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null, null, null,
    null, null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null, null,
    null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null,
    null, null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null, null,
    null, null, '#5b3a1a', '#5b3a1a', '#5b3a1a', null, null, null, null, '#5b3a1a', '#5b3a1a', '#5b3a1a', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  fire_elemental: [
    null, null, null, null, null, null, '#ffab5a', '#ffab5a', '#ffab5a', '#ffab5a', null, null, null, null, null, null,
    null, null, null, null, '#ffab5a', '#ffab5a', '#ffab5a', '#ff6b3a', '#ffab5a', '#ffab5a', '#ffab5a', null, null, null, null, null,
    null, null, null, '#ffab5a', '#ffab5a', '#ffab5a', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ffab5a', '#ffab5a', null, null, null, null,
    null, null, '#ffab5a', '#ff6b3a', '#ffffff', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ffffff', '#ff6b3a', '#ffab5a', null, null, null,
    null, null, '#ff6b3a', '#ffffff', '#222222', '#ffffff', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffffff', '#222222', '#ffffff', '#ff6b3a', null, null, null,
    null, '#ffab5a', '#ff6b3a', '#ffab5a', '#ffffff', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ffffff', '#ffab5a', '#ff6b3a', '#ffab5a', null, null,
    null, '#ffab5a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ffab5a', null, null,
    null, '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', null, null,
    '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', null, null,
    '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', null, null,
    null, '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', null, null, null,
    null, null, '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', null, null, null, null,
    null, null, null, '#cc3a1a', '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', '#cc3a1a', null, null, null, null, null,
    null, null, null, null, '#cc3a1a', '#cc3a1a', '#cc3a1a', '#cc3a1a', '#cc3a1a', '#cc3a1a', null, null, null, null, null, null,
    null, null, null, null, null, '#cc3a1a', '#cc3a1a', '#cc3a1a', '#cc3a1a', null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  dragon_whelp: [
    null, null, '#6b2a88', null, null, null, null, null, null, null, null, null, '#6b2a88', null, null, null,
    null, '#6b2a88', '#9b5ab8', '#9b5ab8', null, null, null, null, null, null, null, '#9b5ab8', '#9b5ab8', '#6b2a88', null, null,
    null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null,
    null, null, '#9b5ab8', '#ffcc44', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#ffcc44', '#9b5ab8', '#9b5ab8', null, null, null,
    null, null, '#bb7ad8', '#ffcc44', '#222222', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#222222', '#ffcc44', '#bb7ad8', '#bb7ad8', null, null, null,
    null, null, '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#ffcc44', '#ffcc44', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', null, null, null,
    null, null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null, null,
    null, null, null, '#6b2a88', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#6b2a88', null, null, null, null,
    null, null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null, null,
    null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null,
    null, null, '#6b2a88', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#6b2a88', null, null, null, null,
    null, null, '#6b2a88', '#6b2a88', '#6b2a88', null, null, null, null, '#6b2a88', '#6b2a88', '#6b2a88', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  void_walker: [
    null, null, null, null, null, null, '#aa66ff', '#aa66ff', '#aa66ff', '#aa66ff', null, null, null, null, null, null,
    null, null, null, null, '#aa66ff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#aa66ff', null, null, null, null, null,
    null, null, null, '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', null, null, null, null,
    null, null, '#5a5a8a', '#aa66ff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#aa66ff', '#5a5a8a', '#5a5a8a', null, null, null,
    null, null, '#5a5a8a', '#aa66ff', '#ffffff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#ffffff', '#aa66ff', '#5a5a8a', null, null, null, null,
    null, '#5a5a8a', '#5a5a8a', '#5a5a8a', '#ffffff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', null, null, null,
    null, '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', null, null,
    null, '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', null, null,
    '#1a1a3a', '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', '#1a1a3a', null,
    null, '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', null, null,
    null, null, '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', null, null, null, null,
    null, null, '#3a3a5a', '#3a3a5a', '#5a5a8a', '#5a5a8a', null, null, '#5a5a8a', '#5a5a8a', '#3a3a5a', '#3a3a5a', null, null, null, null,
    null, null, null, '#3a3a5a', '#3a3a5a', null, null, null, null, '#3a3a5a', '#3a3a5a', null, null, null, null, null,
    null, null, null, '#1a1a3a', '#1a1a3a', null, null, null, null, '#1a1a3a', '#1a1a3a', null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
};

export class SpriteRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private drawPixels(pattern: PixelPattern, x: number, y: number, width: number, height: number, flip: boolean = false) {
    const ctx = this.ctx;
    const pixelWidth = width / 16;
    const pixelHeight = height / 16;

    ctx.save();
    if (flip) {
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }

    for (let i = 0; i < pattern.length; i++) {
      const color = pattern[i];
      if (color) {
        const px = x + (i % 16) * pixelWidth;
        const py = y + Math.floor(i / 16) * pixelHeight;
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(pixelWidth), Math.ceil(pixelHeight));
      }
    }
    ctx.restore();
  }

  drawEntity(entity: CombatEntity, dt: number): void {
    const ctx = this.ctx;

    ctx.save();

    let alpha = 1;
    let yOffset = 0;
    let scale = 1;

    if (entity.state === 'dying' || entity.state === 'dead') {
      const fadeTime = entity.stateTime;
      alpha = Math.max(0, 1 - fadeTime / 0.8);
      yOffset = fadeTime * 30;
      scale = 1 - fadeTime * 0.3;
    } else if (entity.hitFlash > 0) {
      alpha *= 0.5 + Math.sin(Date.now() * 0.05) * 0.5;
    } else if (entity.invulnerableTime && entity.invulnerableTime > 0) {
      alpha *= 0.4 + Math.sin(Date.now() * 0.02) * 0.3;
    }

    if (entity.attackProgress > 0) {
      scale *= 1 + Math.sin(entity.attackProgress * Math.PI) * 0.2;
    }

    ctx.globalAlpha = alpha;

    const centerX = entity.x + entity.width / 2;
    const centerY = entity.y + entity.height / 2 + yOffset;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    if (entity.type === 'hero') {
      const classKey = entity.classKey || 'warrior';
      const pattern = HERO_PIXELS[classKey] || HERO_PIXELS.warrior;
      this.drawPixels(pattern, entity.x, entity.y, entity.width, entity.height, false);
    } else {
      const monsterKey = entity.monsterKey || 'slime';
      const pattern = MONSTER_PIXELS[monsterKey] || MONSTER_PIXELS.slime;
      this.drawPixels(pattern, entity.x, entity.y, entity.width, entity.height, true);
    }

    if (entity.attackProgress > 0 && entity.attackProgress < 1 && entity.state !== 'dying' && entity.state !== 'dead') {
      this.drawAttackIndicator(entity);
    }

    ctx.restore();

    if (entity.state !== 'dying' && entity.state !== 'dead') {
      this.drawHealthBar(entity);
    }
  }

  private drawAttackIndicator(entity: CombatEntity): void {
    const ctx = this.ctx;
    const t = entity.attackProgress;
    const direction = entity.type === 'hero' ? -1 : 1;

    ctx.save();
    ctx.globalAlpha = 1 - t;

    const startX = entity.x + entity.width / 2;
    const startY = entity.y + entity.height / 2;

    const pixelSize = 6;
    const maxLength = 7;
    const currentLength = Math.floor(maxLength * t);

    const colors = entity.type === 'hero'
      ? ['#ffffff', '#dddddd', '#bbbbbb', '#999999', '#777777', '#555555', '#333333']
      : ['#ff6b6b', '#ff5555', '#ff4444', '#dd3333', '#bb2222', '#991111', '#770000'];

    for (let i = 0; i < currentLength; i++) {
      const px = startX + direction * i * pixelSize;
      const colorIndex = Math.min(i, colors.length - 1);
      ctx.fillStyle = colors[colorIndex];

      const spread = t > 0.3 ? 1 : 0;
      const alpha = 1 - (i / maxLength);
      ctx.globalAlpha = (1 - t) * alpha;

      ctx.fillRect(px - pixelSize / 2, startY - pixelSize / 2, pixelSize, pixelSize);

      if (spread > 0) {
        ctx.globalAlpha = (1 - t) * alpha * 0.5;
        ctx.fillRect(px - pixelSize / 2, startY - pixelSize / 2 - pixelSize, pixelSize, pixelSize);
        ctx.fillRect(px - pixelSize / 2, startY - pixelSize / 2 + pixelSize, pixelSize, pixelSize);
      }
    }

    ctx.restore();
  }

  private drawHealthBar(entity: CombatEntity): void {
    const ctx = this.ctx;
    const { x, y, width, hp, maxHp } = entity;

    const barWidth = width + 10;
    const barHeight = 6;
    const barX = x + (width - barWidth) / 2;
    const barY = y - 15;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, hp / maxHp);
    let hpColor = '#2ecc71';
    if (hpPercent <= 0.3) hpColor = '#e74c3c';
    else if (hpPercent <= 0.6) hpColor = '#f39c12';

    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entity.name, x + width / 2, barY - 4);
  }
}
