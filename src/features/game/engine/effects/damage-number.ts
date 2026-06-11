// ============================================================
// 浮动伤害数字
// ============================================================

import type { DamageNumber } from '../types';

export function createDamageNumber(x: number, y: number, text: string, color: string, isCrit = false): DamageNumber {
  return {
    x: x + (Math.random() - 0.5) * 10,
    y, text, vy: -2.5, alpha: 1, age: 0, maxAge: 50,
    color, fontSize: isCrit ? 22 : 16, isCrit,
  };
}

export function updateDamageNumber(dn: DamageNumber): boolean {
  dn.age++;
  dn.y += dn.vy;
  dn.vy *= 0.97;
  dn.alpha = 1 - (dn.age / dn.maxAge);
  if (dn.age < 5) dn.fontSize = (dn.isCrit ? 26 : 20) - dn.age * 0.8;
  if (dn.isCrit && dn.age < 8) dn.x += (Math.random() - 0.5) * 2;
  return dn.age < dn.maxAge;
}

export function drawDamageNumber(ctx: CanvasRenderingContext2D, dn: DamageNumber) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, dn.alpha);
  ctx.font = `bold ${Math.floor(dn.fontSize)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(dn.text, dn.x, dn.y);
  ctx.fillStyle = dn.color;
  ctx.fillText(dn.text, dn.x, dn.y);
  ctx.restore();
}
