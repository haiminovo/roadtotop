// ============================================================
// 护盾闪光特效
// ============================================================

import type { ShieldFlashEffect } from '../types';

export function createShieldFlash(x: number, y: number): ShieldFlashEffect {
  return { type: 'shield_flash', x, y, radius: 5, maxRadius: 40, alpha: 1, done: false };
}

export function updateShieldFlash(s: ShieldFlashEffect): boolean {
  if (s.done) return false;
  s.radius += 2;
  s.alpha = 1 - (s.radius / s.maxRadius);
  if (s.radius >= s.maxRadius) s.done = true;
  return !s.done;
}

export function drawShieldFlash(ctx: CanvasRenderingContext2D, s: ShieldFlashEffect) {
  if (s.done) return;
  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#58a6ff';
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
