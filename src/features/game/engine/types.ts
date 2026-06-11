// ============================================================
// 特效引擎类型定义
// ============================================================

export interface Particle {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  alpha: number;
  gravity: number;
  drag: number;
  shrink: number;
}

export interface DamageNumber {
  x: number; y: number;
  text: string;
  vy: number;
  alpha: number;
  age: number;
  maxAge: number;
  color: string;
  fontSize: number;
  isCrit: boolean;
}

export interface SlashEffect {
  type: 'slash';
  cx: number; cy: number;
  tx: number; ty: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  progress: number;
  speed: number;
  trail: { x: number; y: number; alpha: number }[];
  color: string;
  done: boolean;
}

export interface ProjectileEffect {
  type: 'projectile';
  sx: number; sy: number;
  tx: number; ty: number;
  progress: number;
  speed: number;
  style: 'arrow' | 'fireball' | 'lightning' | 'heal_bolt' | 'stab';
  hitFired: boolean;
  done: boolean;
}

export interface LightningEffect {
  type: 'lightning';
  sx: number; sy: number;
  tx: number; ty: number;
  segments: { x: number; y: number }[];
  alpha: number;
  age: number;
  maxAge: number;
  done: boolean;
}

export interface ShieldFlashEffect {
  type: 'shield_flash';
  x: number; y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  done: boolean;
}

export interface HealAuraEffect {
  type: 'heal_aura';
  x: number; y: number;
  age: number;
  maxAge: number;
  done: boolean;
}

export type Effect = SlashEffect | ProjectileEffect | LightningEffect | ShieldFlashEffect | HealAuraEffect;
