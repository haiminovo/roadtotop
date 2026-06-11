// ============================================================
// 闪电特效
// ============================================================

import type { LightningEffect } from '../types';

export function createLightning(sx: number, sy: number, tx: number, ty: number): LightningEffect {
  const segments: { x: number; y: number }[] = [];
  const steps = 8;
  const dx = tx - sx;
  const dy = ty - sy;
  const perpX = -dy;
  const perpY = dx;
  const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const offset = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 30;
    segments.push({
      x: sx + dx * t + (perpX / len) * offset,
      y: sy + dy * t + (perpY / len) * offset,
    });
  }
  return { type: 'lightning', sx, sy, tx, ty, segments, alpha: 1, age: 0, maxAge: 12, done: false };
}

export function updateLightning(l: LightningEffect): boolean {
  if (l.done) return false;
  l.age++;
  l.alpha = 1 - (l.age / l.maxAge);
  if (l.age >= l.maxAge) l.done = true;
  return !l.done;
}

export function drawLightning(ctx: CanvasRenderingContext2D, l: LightningEffect) {
  if (l.done || l.segments.length < 2) return;
  ctx.save();
  ctx.globalAlpha = l.alpha;
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#88ccff';
  ctx.strokeStyle = '#aaddff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(l.segments[0].x, l.segments[0].y);
  for (let i = 1; i < l.segments.length; i++) {
    ctx.lineTo(l.segments[i].x, l.segments[i].y);
  }
  ctx.stroke();
  // 内层亮白
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(l.segments[0].x, l.segments[0].y);
  for (let i = 1; i < l.segments.length; i++) {
    ctx.lineTo(l.segments[i].x, l.segments[i].y);
  }
  ctx.stroke();
  ctx.restore();
}
